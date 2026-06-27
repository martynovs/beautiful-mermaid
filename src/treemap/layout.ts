import type { Treemap, TreemapNode, PositionedTreemap, PositionedCell } from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Treemap layout engine
//
// Computes pixel geometry for a treemap over a fixed canvas (600x400, plus an
// optional title strip). Children of each node are packed into their parent's
// inner rectangle using the squarified algorithm (Bruls, Huizing & van Wijk),
// which keeps cells close to square for legibility. No ELK needed — areas map
// directly from value.
//
// Branch nodes reserve a header strip for their label and recurse into the
// remaining area; leaves are filled cells. Cells are emitted parents-first so
// the renderer draws containers behind their contents.
// ============================================================================

const T = {
  width: 600,
  height: 400,
  padding: 16,
  titleHeight: 40,
  titleFontSize: 18,
  /** Header strip reserved on a branch for its label. */
  headerHeight: 20,
  /** Inset between a branch's inner area and its children. */
  cellPad: 3,
} as const

interface Rect { x: number; y: number; w: number; h: number }

/**
 * Lay out a parsed treemap by computing pixel geometry for every node.
 */
export function layoutTreemap(tree: Treemap, _options: RenderOptions = {}): PositionedTreemap {
  const hasTitle = !!tree.title
  const top = T.padding + (hasTitle ? T.titleHeight : 0)
  const content: Rect = {
    x: T.padding,
    y: top,
    w: T.width - 2 * T.padding,
    h: T.height - top - T.padding,
  }

  const cells: PositionedCell[] = []
  const root = tree.root

  if (root.label) {
    // Single named root — render it as the outermost cell.
    place(root, content, 0, cells)
  } else {
    // Forest — lay the top-level nodes directly into the content rect.
    squarifyInto(root.children, content, (child, r) => place(child, r, 0, cells))
  }

  return {
    width: T.width,
    height: T.height,
    title: hasTitle
      ? { text: tree.title!, x: T.width / 2, y: T.padding + T.titleFontSize }
      : undefined,
    cells,
  }
}

// ----------------------------------------------------------------------------
// Recursive placement
// ----------------------------------------------------------------------------

function place(node: TreemapNode, rect: Rect, depth: number, out: PositionedCell[]): void {
  out.push({
    path: node.path,
    label: node.label,
    value: node.value,
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    depth,
    isLeaf: node.children.length === 0,
    colorIndex: node.colorIndex,
  })

  if (node.children.length === 0) return

  // Inset for the header label + padding, then pack children inside.
  const headerH = rect.h > T.headerHeight * 2 ? T.headerHeight : 0
  const inner: Rect = {
    x: rect.x + T.cellPad,
    y: rect.y + headerH,
    w: rect.w - 2 * T.cellPad,
    h: rect.h - headerH - T.cellPad,
  }
  if (inner.w <= 2 || inner.h <= 2) return

  squarifyInto(node.children, inner, (child, r) => place(child, r, depth + 1, out))
}

// ----------------------------------------------------------------------------
// Squarified treemap packing
// ----------------------------------------------------------------------------

/** Scale child values to fill `rect` by area, then squarify into it. */
function squarifyInto(children: TreemapNode[], rect: Rect, assign: (node: TreemapNode, r: Rect) => void): void {
  const valued = children.map(c => ({ node: c, value: Math.max(c.value, 0) }))
  const total = valued.reduce((s, v) => s + v.value, 0)
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return

  const scale = (rect.w * rect.h) / total
  const items = valued.map(v => ({ node: v.node, area: v.value * scale }))
  squarify(items, { ...rect }, assign)
}

interface AreaItem { node: TreemapNode; area: number }

function squarify(items: AreaItem[], rect: Rect, assign: (node: TreemapNode, r: Rect) => void): void {
  const remaining = items.filter(i => i.area > 0)
  let { x, y, w, h } = rect

  while (remaining.length > 0 && w > 0 && h > 0) {
    const shortest = Math.min(w, h)
    const row: AreaItem[] = []
    let rowArea = 0

    // Grow the row while the worst aspect ratio keeps improving.
    while (remaining.length > 0) {
      const next = remaining[0]!
      const newArea = rowArea + next.area
      const newRow = [...row, next]
      if (
        row.length === 0 ||
        worstRatio(newRow, shortest, newArea) <= worstRatio(row, shortest, rowArea)
      ) {
        row.push(remaining.shift()!)
        rowArea = newArea
      } else {
        break
      }
    }

    // Lay the row along the shorter side, packing perpendicular to it.
    if (w >= h) {
      const rw = rowArea / h
      let cy = y
      for (const item of row) {
        const rh = (item.area / rowArea) * h
        assign(item.node, { x, y: cy, w: rw, h: rh })
        cy += rh
      }
      x += rw
      w -= rw
    } else {
      const rh = rowArea / w
      let cx = x
      for (const item of row) {
        const rwItem = (item.area / rowArea) * w
        assign(item.node, { x: cx, y, w: rwItem, h: rh })
        cx += rwItem
      }
      y += rh
      h -= rh
    }
  }
}

/** Worst (largest) aspect ratio among a candidate row laid along `length`. */
function worstRatio(row: AreaItem[], length: number, sum: number): number {
  if (sum <= 0 || length <= 0) return Infinity
  let max = -Infinity
  let min = Infinity
  for (const item of row) {
    if (item.area > max) max = item.area
    if (item.area < min) min = item.area
  }
  const s2 = sum * sum
  const l2 = length * length
  return Math.max((l2 * max) / s2, s2 / (l2 * min))
}

export const TREEMAP_LAYOUT = T
