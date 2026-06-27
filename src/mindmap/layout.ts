import type { Mindmap, MindmapNode, PositionedMindmap, PositionedMindmapNode, MindmapConnector } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Mindmap layout engine
//
// A self-contained recursive tree layout — NO ELK. The root sits in the CENTER
// and its top-level children are split into a LEFT group and a RIGHT group, so
// the diagram is double-sided like a real mind map. Right subtrees grow
// rightward; left subtrees grow leftward (mirrored). Each node is centered
// vertically on the span of its subtree, so siblings stack and parents align to
// the middle of their children.
//
//   right: x(child) = x(parent) + width(parent) + hGap   (grows →)
//   left:  x(child) = x(parent) - width(child)  - hGap   (grows ←)
//   y(node) = centered on the vertical span of its subtree
//
// Top-level children are split first ceil(n/2) to the right, the rest to the
// left. After placing, both sides are vertically centered on the root, and the
// whole bounding box is normalized (shifted to a uniform padding) so the SVG
// expands to fit both sides and nothing is clipped.
// ============================================================================

const M = {
  padding: 24,
  /** Horizontal gap between a parent's edge and its children's near edge. */
  hGap: 52,
  /** Vertical gap between sibling subtrees. */
  vGap: 18,
  nodeHeight: 38,
  /** Horizontal text padding inside a node box. */
  hPad: 16,
  minWidth: 44,
  fontSize: 14,
  fontWeight: 500,
} as const

/** Direction a subtree grows in: +1 rightward, -1 leftward. */
type Dir = 1 | -1

/**
 * Lay out a parsed mindmap as a centered, double-sided tree.
 */
export function layoutMindmap(mindmap: Mindmap, _options: RenderOptions = {}): PositionedMindmap {
  const positioned: PositionedMindmapNode[] = []
  const connectors: MindmapConnector[] = []

  // A synthetic root (empty id/label, holding a forest) has no single center to
  // pivot around — lay each forest tree out single-sided, stacked vertically.
  const isSynthetic = mindmap.root.id === '' && mindmap.root.label === ''
  if (isSynthetic) {
    let cursorY = M.padding
    for (const top of mindmap.root.children) {
      cursorY += place(top, M.padding, cursorY, 1, positioned, connectors)
    }
  } else {
    layoutDoubleSided(mindmap.root, positioned, connectors)
  }

  // Normalize the bounding box: shift everything so the content sits at a
  // uniform `padding` from the top-left, and size the canvas to fit both sides.
  let minX = Infinity
  let minY = Infinity
  let maxRight = -Infinity
  let maxBottom = -Infinity
  for (const n of positioned) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxRight = Math.max(maxRight, n.x + n.width)
    maxBottom = Math.max(maxBottom, n.y + n.height)
  }
  if (positioned.length === 0) {
    minX = 0
    minY = 0
    maxRight = 0
    maxBottom = 0
  }

  const dx = M.padding - minX
  const dy = M.padding - minY
  if (dx !== 0 || dy !== 0) {
    for (const n of positioned) {
      n.x += dx
      n.y += dy
    }
    for (const c of connectors) {
      c.x1 += dx
      c.x2 += dx
      c.y1 += dy
      c.y2 += dy
    }
  }

  return {
    width: (maxRight - minX) + M.padding * 2,
    height: Math.max((maxBottom - minY) + M.padding * 2, M.padding * 2 + M.nodeHeight),
    nodes: positioned,
    connectors,
  }
}

/**
 * Lay out a real (non-synthetic) root in the center, splitting its top-level
 * children into a right group (first ceil(n/2)) and a left group (the rest).
 * Each side is vertically centered on the root.
 */
function layoutDoubleSided(
  root: MindmapNode,
  out: PositionedMindmapNode[],
  connectors: MindmapConnector[],
): void {
  const rootWidth = nodeWidth(root.label)
  const rootPn: PositionedMindmapNode = {
    id: root.id,
    label: root.label,
    shape: root.shape,
    depth: root.depth,
    x: 0,
    y: 0, // assigned once both sides' heights are known
    width: rootWidth,
    height: M.nodeHeight,
  }
  out.push(rootPn) // root first → nodes stay parent-before-children (pre-order)

  const children = root.children
  const splitIdx = Math.ceil(children.length / 2)
  const rightChildren = children.slice(0, splitIdx)
  const leftChildren = children.slice(splitIdx)

  const rightAnchor = rootPn.x + rootWidth + M.hGap
  const leftAnchor = rootPn.x - M.hGap

  // Place the right group, then the left group, tracking the index ranges each
  // produced so we can vertically center them independently afterwards.
  const rNodeStart = out.length
  const rConnStart = connectors.length
  let ry = M.padding
  for (const c of rightChildren) ry += place(c, rightAnchor, ry, 1, out, connectors)
  const rightHeight = ry - M.padding

  const lNodeStart = out.length
  const lConnStart = connectors.length
  let ly = M.padding
  for (const c of leftChildren) ly += place(c, leftAnchor, ly, -1, out, connectors)
  const leftHeight = ly - M.padding

  const lNodeEnd = out.length
  const lConnEnd = connectors.length

  const groupsHeight = Math.max(rightHeight, leftHeight, M.nodeHeight)
  shiftRange(out, connectors, rNodeStart, lNodeStart, rConnStart, lConnStart, (groupsHeight - rightHeight) / 2)
  shiftRange(out, connectors, lNodeStart, lNodeEnd, lConnStart, lConnEnd, (groupsHeight - leftHeight) / 2)

  rootPn.y = M.padding + groupsHeight / 2 - M.nodeHeight / 2

  // Connectors from the root to each top-level child, routed from the correct
  // edge: right edge → right children, left edge → left children.
  const rightSet = new Set(rightChildren)
  for (const c of children) {
    const cpn = out.find(o => o.id === c.id)!
    const onRight = rightSet.has(c)
    connectors.push({
      from: root.id,
      to: c.id,
      x1: onRight ? rootPn.x + rootPn.width : rootPn.x,
      y1: rootPn.y + rootPn.height / 2,
      x2: onRight ? cpn.x : cpn.x + cpn.width,
      y2: cpn.y + cpn.height / 2,
    })
  }
}

/** Shift a contiguous range of nodes and connectors vertically by `dy`. */
function shiftRange(
  nodes: PositionedMindmapNode[],
  connectors: MindmapConnector[],
  nStart: number,
  nEnd: number,
  cStart: number,
  cEnd: number,
  dy: number,
): void {
  if (dy === 0) return
  for (let i = nStart; i < nEnd; i++) nodes[i]!.y += dy
  for (let i = cStart; i < cEnd; i++) {
    connectors[i]!.y1 += dy
    connectors[i]!.y2 += dy
  }
}

/**
 * Recursively place a subtree growing in direction `dir`. Returns the total
 * vertical slot height the subtree occupies (so callers can stack siblings).
 * Pushes positioned nodes and parent→child connectors as a side effect.
 *
 * `anchorX` is the x of the node edge facing the root: for rightward subtrees it
 * is the node's LEFT edge; for leftward subtrees it is the node's RIGHT edge.
 */
function place(
  node: MindmapNode,
  anchorX: number,
  yTop: number,
  dir: Dir,
  out: PositionedMindmapNode[],
  connectors: MindmapConnector[],
): number {
  const width = nodeWidth(node.label)
  const x = dir > 0 ? anchorX : anchorX - width
  const pn: PositionedMindmapNode = {
    id: node.id,
    label: node.label,
    shape: node.shape,
    depth: node.depth,
    x,
    width,
    height: M.nodeHeight,
    y: 0, // assigned below
  }
  out.push(pn)

  if (node.children.length === 0) {
    // Leaf: occupy one slot (node height + gap), centered within it.
    const slot = M.nodeHeight + M.vGap
    pn.y = yTop + M.vGap / 2
    return slot
  }

  // Place children stacked vertically, just past this node's outward edge.
  const childAnchor = dir > 0 ? x + width + M.hGap : x - M.hGap
  let cy = yTop
  for (const child of node.children) {
    cy += place(child, childAnchor, cy, dir, out, connectors)
  }
  const childrenHeight = cy - yTop

  // Center this node on the vertical span of its children.
  pn.y = yTop + childrenHeight / 2 - M.nodeHeight / 2

  // Connector from this node's outward edge to each child's near edge.
  for (const child of node.children) {
    const cpn = out.find(o => o.id === child.id)!
    connectors.push({
      from: node.id,
      to: child.id,
      x1: dir > 0 ? pn.x + pn.width : pn.x,
      y1: pn.y + pn.height / 2,
      x2: dir > 0 ? cpn.x : cpn.x + cpn.width,
      y2: cpn.y + cpn.height / 2,
    })
  }

  return childrenHeight
}

function nodeWidth(label: string): number {
  return Math.max(M.minWidth, Math.round(estimateTextWidth(label, M.fontSize, M.fontWeight) + 2 * M.hPad))
}

export const MINDMAP_LAYOUT = M
