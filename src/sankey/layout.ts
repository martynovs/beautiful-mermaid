import type { Sankey, PositionedSankey, PositionedSankeyNode, PositionedSankeyLink } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Sankey layout engine — self-contained (no ELK)
//
// 1. Column assignment: each node's column = the longest path (in links) from
//    a pure-source node (a node with no inflow). Computed by iterative
//    relaxation, capped at |nodes| passes so cycles can't loop forever.
// 2. Node sizing: a node's flow weight = max(total inflow, total outflow). Its
//    drawn height is that weight times a global value→pixel scale, chosen so
//    the busiest column fills the plot height.
// 3. Vertical placement: nodes stack within their column, centred vertically,
//    separated by a fixed gap.
// 4. Links: drawn as filled cubic-bezier bands from the source's right edge to
//    the target's left edge; band thickness ∝ value. Outgoing bands stack down
//    the source's right edge, incoming bands stack down the target's left edge.
// ============================================================================

const S = {
  padding: 28,
  nodeWidth: 22,
  columnGap: 190, // left-edge to left-edge distance between adjacent columns
  nodePadding: 20, // vertical gap between stacked nodes in a column
  plotHeight: 420,
  labelGap: 8,
  labelFontSize: 14,
  labelFontWeight: 500,
  minBand: 1.5,
} as const

/**
 * Lay out a parsed sankey diagram into pixel geometry.
 */
export function layoutSankey(sankey: Sankey, _options: RenderOptions = {}): PositionedSankey {
  const names = sankey.nodes
  const n = names.length

  // Empty diagram — return a minimal canvas.
  if (n === 0) {
    return { width: S.padding * 2, height: S.padding * 2, nodes: [], links: [] }
  }

  const index = new Map<string, number>()
  names.forEach((name, i) => index.set(name, i))

  // --- Per-node inflow / outflow totals -----------------------------------
  const inflow = new Array<number>(n).fill(0)
  const outflow = new Array<number>(n).fill(0)
  for (const link of sankey.links) {
    const si = index.get(link.source)!
    const ti = index.get(link.target)!
    outflow[si]! += link.value
    inflow[ti]! += link.value
  }

  // --- Column assignment via longest-path relaxation ----------------------
  const column = new Array<number>(n).fill(0)
  for (let pass = 0; pass < n; pass++) {
    let changed = false
    for (const link of sankey.links) {
      const si = index.get(link.source)!
      const ti = index.get(link.target)!
      if (column[ti]! < column[si]! + 1) {
        column[ti] = column[si]! + 1
        changed = true
      }
    }
    if (!changed) break
  }
  const maxColumn = Math.max(0, ...column)

  // --- Node flow weights & per-column grouping ----------------------------
  const weight = names.map((_, i) => Math.max(inflow[i]!, outflow[i]!, 0))
  const columnsNodes: number[][] = Array.from({ length: maxColumn + 1 }, () => [])
  for (let i = 0; i < n; i++) columnsNodes[column[i]!]!.push(i)

  // --- Global value→pixel scale: pick the scale that lets the tightest
  //     column exactly fill the plot height, so no column overflows. --------
  let scale = Infinity
  for (const col of columnsNodes) {
    if (col.length === 0) continue
    const sumWeight = col.reduce((s, i) => s + weight[i]!, 0) || 1
    const gaps = (col.length - 1) * S.nodePadding
    const candidate = (S.plotHeight - gaps) / sumWeight
    if (candidate < scale) scale = candidate
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 1

  // --- Place nodes --------------------------------------------------------
  const nodes: PositionedSankeyNode[] = new Array(n)
  let maxLeftLabel = 0 // widest label drawn to the left (final column)
  let maxRightLabel = 0 // widest label drawn to the right (other columns)

  columnsNodes.forEach((col, c) => {
    const colHeight = col.reduce((s, i) => s + Math.max(weight[i]! * scale, S.minBand), 0) +
      (col.length - 1) * S.nodePadding
    let y = S.padding + Math.max(0, (S.plotHeight - colHeight) / 2)
    const x = S.padding + c * S.columnGap

    for (const i of col) {
      const h = Math.max(weight[i]! * scale, S.minBand)
      // Labels sit outside the band stack: right of the node, except the final
      // column (when there is more than one) which labels to the left so text
      // stays inside the canvas.
      const labelToLeft = maxColumn > 0 && c === maxColumn
      const labelW = estimateTextWidth(names[i]!, S.labelFontSize, S.labelFontWeight)
      const labelAnchor: 'start' | 'end' = labelToLeft ? 'end' : 'start'
      const labelX = labelToLeft ? x - S.labelGap : x + S.nodeWidth + S.labelGap
      if (labelToLeft) maxLeftLabel = Math.max(maxLeftLabel, labelW)
      else maxRightLabel = Math.max(maxRightLabel, labelW)

      nodes[i] = {
        id: names[i]!,
        label: names[i]!,
        x,
        y,
        width: S.nodeWidth,
        height: h,
        colorIndex: i,
        labelX,
        labelY: y + h / 2,
        labelAnchor,
      }
      y += h + S.nodePadding
    }
  })

  // --- Build link bands ---------------------------------------------------
  // Track running stack offsets on each node's right (out) and left (in) edges.
  const outOffset = new Array<number>(n).fill(0)
  const inOffset = new Array<number>(n).fill(0)

  const links: PositionedSankeyLink[] = []
  for (const link of sankey.links) {
    const si = index.get(link.source)!
    const ti = index.get(link.target)!
    const src = nodes[si]!
    const tgt = nodes[ti]!
    const thick = Math.max(link.value * scale, S.minBand)

    const sx = src.x + src.width
    const sy = src.y + outOffset[si]!
    const tx = tgt.x
    const ty = tgt.y + inOffset[ti]!
    outOffset[si]! += thick
    inOffset[ti]! += thick

    links.push({
      source: link.source,
      target: link.target,
      value: link.value,
      path: bandPath(sx, sy, tx, ty, thick),
      colorIndex: src.colorIndex,
    })
  }

  // --- Canvas size --------------------------------------------------------
  // Rightmost extent = the further of: the last column's nodes (whose labels
  // point left), and any right-pointing label from an earlier column.
  const lastColX = S.padding + maxColumn * S.columnGap + S.nodeWidth
  const rightLabelExtent = S.padding + Math.max(0, maxColumn - 1) * S.columnGap +
    S.nodeWidth + S.labelGap + maxRightLabel
  // The final column labels point left into the inter-column gap, so they do
  // not extend the canvas to the right; `maxLeftLabel` is reserved for clarity.
  void maxLeftLabel
  const rightExtent = Math.max(lastColX, rightLabelExtent)
  const width = rightExtent + S.padding
  const height = S.plotHeight + S.padding * 2

  return { width, height, nodes, links }
}

/**
 * Filled band between a source right-edge segment (sx, sy → sy+thick) and a
 * target left-edge segment (tx, ty → ty+thick), using horizontal cubic-bezier
 * control points at the horizontal midpoint for a smooth S-curve.
 */
function bandPath(sx: number, sy: number, tx: number, ty: number, thick: number): string {
  const xc = (sx + tx) / 2
  const sy1 = sy + thick
  const ty1 = ty + thick
  return [
    `M${rr(sx)},${rr(sy)}`,
    `C${rr(xc)},${rr(sy)} ${rr(xc)},${rr(ty)} ${rr(tx)},${rr(ty)}`,
    `L${rr(tx)},${rr(ty1)}`,
    `C${rr(xc)},${rr(ty1)} ${rr(xc)},${rr(sy1)} ${rr(sx)},${rr(sy1)}`,
    'Z',
  ].join(' ')
}

function rr(v: number): string {
  return String(Math.round(v * 10) / 10)
}

export const SANKEY_LAYOUT = S
