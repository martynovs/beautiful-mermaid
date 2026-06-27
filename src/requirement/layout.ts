import type {
  RequirementDiagram,
  Requirement,
  RequirementElement,
  PositionedRequirementDiagram,
  PositionedReqNode,
  PositionedReqEdge,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Requirement diagram layout engine
//
// Self-contained grid layout (no ELK). Requirement and element boxes are sized
// to their content and placed into a simple grid (rows of N). Relationship
// edges are straight lines between box centers, clipped to the box borders,
// with a small label at the midpoint.
// ============================================================================

const L = {
  padding: 32,
  gapX: 56,
  gapY: 56,
  cols: 3,
  headerHeight: 30,
  stereoHeight: 18,
  rowHeight: 22,
  bottomPad: 8,
  padX: 14,
  minWidth: 150,
  maxWidth: 300,
  nameFontSize: 14,
  nameFontWeight: 600,
  bodyFontSize: 12,
  bodyFontWeight: 400,
} as const

/**
 * Lay out a parsed requirement diagram by computing pixel geometry.
 */
export function layoutRequirementDiagram(
  diagram: RequirementDiagram,
  _options: RenderOptions = {},
): PositionedRequirementDiagram {
  // Build the unified node list: requirements first, then elements.
  const draft = [
    ...diagram.requirements.map(reqToNode),
    ...diagram.elements.map(elToNode),
  ]

  const count = draft.length

  // --- Size each box to its content ---
  for (const n of draft) {
    let maxText = estimateTextWidth(n.name, L.nameFontSize, L.nameFontWeight)
    maxText = Math.max(maxText, estimateTextWidth(n.stereotype, L.bodyFontSize, L.bodyFontWeight))
    for (const row of n.rows) {
      maxText = Math.max(maxText, estimateTextWidth(row, L.bodyFontSize, L.bodyFontWeight))
    }
    const w = clamp(maxText + L.padX * 2, L.minWidth, L.maxWidth)
    const h = L.headerHeight + L.stereoHeight + n.rows.length * L.rowHeight + L.bottomPad
    n.width = Math.round(w)
    n.height = h
  }

  // --- Uniform grid cells ---
  const cols = Math.min(L.cols, Math.max(1, count))
  const rows = Math.max(1, Math.ceil(count / cols))
  const cellW = draft.reduce((m: number, n) => Math.max(m, n.width), L.minWidth as number)
  const cellH = draft.reduce((m: number, n) => Math.max(m, n.height), L.headerHeight as number)

  draft.forEach((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellX = L.padding + col * (cellW + L.gapX)
    const cellY = L.padding + row * (cellH + L.gapY)
    // Center the box within its cell.
    n.x = cellX + (cellW - n.width) / 2
    n.y = cellY + (cellH - n.height) / 2
  })

  const width = L.padding * 2 + cols * cellW + (cols - 1) * L.gapX
  const height = L.padding * 2 + rows * cellH + (rows - 1) * L.gapY

  const nodes = draft as PositionedReqNode[]
  const byId = new Map(nodes.map(n => [n.id, n]))

  // --- Edges: straight lines between box centers, clipped to borders ---
  const edges: PositionedReqEdge[] = []
  for (const rel of diagram.relationships) {
    const from = byId.get(rel.source)
    const to = byId.get(rel.dest)
    if (!from || !to) continue

    const fc = center(from)
    const tc = center(to)
    const start = clipToBorder(fc, tc, from)
    const end = clipToBorder(tc, fc, to)

    edges.push({
      from: rel.source,
      to: rel.dest,
      type: rel.type,
      points: [start, end],
      labelX: (start.x + end.x) / 2,
      labelY: (start.y + end.y) / 2,
    })
  }

  return { width, height, nodes, edges }
}

// ============================================================================
// Node construction
// ============================================================================

function reqToNode(req: Requirement): PositionedReqNode {
  const rows: string[] = []
  if (req.id !== undefined) rows.push(`id: ${req.id}`)
  if (req.text !== undefined) rows.push(`text: ${req.text}`)
  if (req.risk !== undefined) rows.push(`risk: ${req.risk}`)
  if (req.verifyMethod !== undefined) rows.push(`verify: ${req.verifyMethod}`)
  return baseNode(req.name, 'requirement', stereotype(req.kind), rows)
}

function elToNode(el: RequirementElement): PositionedReqNode {
  const rows: string[] = []
  if (el.type !== undefined) rows.push(`type: ${el.type}`)
  if (el.docref !== undefined) rows.push(`docRef: ${el.docref}`)
  return baseNode(el.name, 'element', '«Element»', rows)
}

function baseNode(
  id: string,
  kind: 'requirement' | 'element',
  stereo: string,
  rows: string[],
): PositionedReqNode {
  return {
    id,
    kind,
    stereotype: stereo,
    name: id,
    rows,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    headerHeight: L.headerHeight,
    rowHeight: L.rowHeight,
  }
}

/** Humanize a requirement keyword into a «Stereotype» label. */
function stereotype(kind: string): string {
  const words = kind.replace(/([a-z])([A-Z])/g, '$1 $2')
  const titled = words.charAt(0).toUpperCase() + words.slice(1)
  return `«${titled}»`
}

// ============================================================================
// Geometry helpers
// ============================================================================

function center(n: PositionedReqNode): { x: number; y: number } {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 }
}

/**
 * Find the point on a node's rectangular border along the ray from the node
 * center toward `toward`. Returns the center if the direction is degenerate.
 */
function clipToBorder(
  c: { x: number; y: number },
  toward: { x: number; y: number },
  n: PositionedReqNode,
): { x: number; y: number } {
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (dx === 0 && dy === 0) return { x: c.x, y: c.y }

  const hw = n.width / 2
  const hh = n.height / 2
  // Scale factor to reach each axis border; take the smaller.
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)

  return { x: round(c.x + dx * t), y: round(c.y + dy * t) }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export const REQUIREMENT_LAYOUT = L
