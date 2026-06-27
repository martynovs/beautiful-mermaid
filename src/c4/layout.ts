import type {
  C4Diagram,
  C4Element,
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
  PositionedC4Boundary,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// C4 diagram layout engine
//
// Self-contained (no ELK): element boxes are placed in a simple grid of
// `cols` columns; relationship arrows are straight lines between box centers,
// clipped to each box border, with the label at the segment midpoint.
// Boundaries become labeled containers sized to bound their member elements.
// ============================================================================

const L = {
  padding: 28,
  titleGap: 0,
  topPad: 12,
  botPad: 14,
  iconSize: 20,
  iconGap: 6,
  tagH: 16,
  labelH: 22,
  technH: 16,
  descrH: 16,
  gapX: 56,
  gapY: 68,
  boxMinW: 180,
  boxMaxW: 300,
  innerPadX: 16,
  tagFont: 11,
  tagWeight: 600,
  labelFont: 14,
  labelWeight: 600,
  technFont: 11,
  technWeight: 400,
  descrFont: 11,
  descrWeight: 400,
  descrMaxLines: 3,
  boundaryPad: 18,
  boundaryLabelH: 22,
  personBar: 6,
} as const

/**
 * Lay out a parsed C4 diagram into pixel geometry.
 */
export function layoutC4Diagram(diagram: C4Diagram, _options: RenderOptions = {}): PositionedC4Diagram {
  const n = diagram.elements.length

  // --- Uniform box sizing -------------------------------------------------
  // Width is driven by the tag / label / techn (not the wrap-able descr).
  let boxW: number = L.boxMinW
  for (const el of diagram.elements) {
    const tag = kindTag(el)
    const labelW = estimateTextWidth(el.label, L.labelFont, L.labelWeight)
    const tagW = estimateTextWidth(tag, L.tagFont, L.tagWeight)
    const technW = el.techn ? estimateTextWidth(el.techn, L.technFont, L.technWeight) : 0
    const content = Math.max(labelW, tagW, technW) + 2 * L.innerPadX
    boxW = Math.max(boxW, content)
  }
  boxW = Math.min(boxW, L.boxMaxW)
  const innerW = boxW - 2 * L.innerPadX

  // Build positioned element shells (descr wrapped, uniform height).
  const shells = diagram.elements.map(el => {
    const descr = el.descr ? wrapText(el.descr, innerW, L.descrFont, L.descrWeight, L.descrMaxLines) : []
    return { el, tag: kindTag(el), descr }
  })

  // Vertical room reserved for the icon strip above the tag.
  const iconBand = L.iconSize + L.iconGap
  let boxH = L.topPad + iconBand + L.tagH + L.labelH + L.botPad
  for (const s of shells) {
    const h =
      L.topPad + iconBand + L.tagH + L.labelH + (s.el.techn ? L.technH : 0) + s.descr.length * L.descrH + L.botPad
    boxH = Math.max(boxH, h)
  }

  // --- Grid placement -----------------------------------------------------
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n))))
  const top = L.padding + L.titleGap

  const aliasToEl = new Map<string, PositionedC4Element>()
  const elements: PositionedC4Element[] = shells.map((s, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = L.padding + col * (boxW + L.gapX)
    const y = top + row * (boxH + L.gapY)
    const pe: PositionedC4Element = {
      alias: s.el.alias,
      kind: s.el.kind,
      variant: s.el.variant,
      tag: s.tag,
      label: s.el.label,
      techn: s.el.techn,
      descr: s.descr,
      external: s.el.external,
      x,
      y,
      width: boxW,
      height: boxH,
    }
    aliasToEl.set(s.el.alias, pe)
    return pe
  })

  const rows = Math.max(1, Math.ceil(n / cols))
  const usedCols = n > 0 ? Math.min(cols, n) : 1

  // --- Boundaries: bounding box of their member elements ------------------
  const boundaries: PositionedC4Boundary[] = []
  for (const b of diagram.boundaries) {
    const members = elements.filter((_, i) => diagram.elements[i]!.boundary === b.alias)
    if (members.length === 0) continue
    const minX = Math.min(...members.map(m => m.x)) - L.boundaryPad
    const minY = Math.min(...members.map(m => m.y)) - L.boundaryPad - L.boundaryLabelH
    const maxX = Math.max(...members.map(m => m.x + m.width)) + L.boundaryPad
    const maxY = Math.max(...members.map(m => m.y + m.height)) + L.boundaryPad
    boundaries.push({
      alias: b.alias,
      label: b.label,
      kind: b.kind,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    })
  }

  // --- Relationship arrows ------------------------------------------------
  const relationships: PositionedC4Relationship[] = []
  for (const rel of diagram.relationships) {
    const from = aliasToEl.get(rel.from)
    const to = aliasToEl.get(rel.to)
    if (!from || !to) continue
    const fc = center(from)
    const tc = center(to)
    const p1 = clipToBox(from, tc.x, tc.y)
    const p2 = clipToBox(to, fc.x, fc.y)
    relationships.push({
      from: rel.from,
      to: rel.to,
      label: rel.label,
      techn: rel.techn,
      bidirectional: rel.bidirectional,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      labelX: (p1.x + p2.x) / 2,
      labelY: (p1.y + p2.y) / 2,
    })
  }

  // --- Canvas size --------------------------------------------------------
  let width = L.padding * 2 + usedCols * boxW + (usedCols - 1) * L.gapX
  let height = top + rows * boxH + (rows - 1) * L.gapY + L.padding
  // Grow to include any boundary that extends past the grid bounds.
  for (const b of boundaries) {
    width = Math.max(width, b.x + b.width + L.padding)
    height = Math.max(height, b.y + b.height + L.padding)
    if (b.x < L.padding) width += L.padding - b.x
    if (b.y < L.padding) height += L.padding - b.y
  }

  return { width: Math.round(width), height: Math.round(height), elements, relationships, boundaries }
}

// ============================================================================
// Helpers
// ============================================================================

/** Human-readable kind tag shown above an element's label. */
export function kindTag(el: C4Element): string {
  switch (el.kind) {
    case 'person':
      return el.external ? '«External Person»' : '«Person»'
    case 'system':
      return el.external ? '«External System»' : '«System»'
    case 'container':
      return el.techn ? `«Container: ${el.techn}»` : '«Container»'
    case 'component':
      return el.techn ? `«Component: ${el.techn}»` : '«Component»'
  }
}

function center(el: PositionedC4Element): { x: number; y: number } {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 }
}

/** Clip a ray from a box center toward (tx,ty) onto the box border. */
function clipToBox(el: PositionedC4Element, tx: number, ty: number): { x: number; y: number } {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = el.width / 2
  const hh = el.height / 2
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

/** Greedy word-wrap to a pixel width, capped at `maxLines` (last line ellipsized). */
function wrapText(text: string, maxWidth: number, fontSize: number, weight: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (cur && estimateTextWidth(test, fontSize, weight) > maxWidth) {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines - 1) {
        // Remaining words go on the final line (possibly ellipsized below).
        cur = w
      }
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+\S*$/, '')}…`
    return kept
  }
  return lines
}

export const C4_LAYOUT = L
