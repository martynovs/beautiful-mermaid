import type { PositionedRequirementDiagram, PositionedReqNode, PositionedReqEdge } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'

// ============================================================================
// Requirement diagram SVG renderer
//
// Renders a positioned requirement diagram to an SVG string. All colors use
// the theme's CSS custom properties — no hardcoded colors. Each requirement
// and element box is addressable as <g class="node" data-id="...">, and each
// relationship edge carries data-from/data-to (the identity contract).
//
// Render order (back to front):
//   1. Relationship edges (lines + arrowheads + labels)
//   2. Requirement / element boxes
// ============================================================================

const FONT = {
  nameSize: 14,
  nameWeight: 600,
  stereoSize: 11,
  stereoWeight: 400,
  bodySize: 12,
  bodyWeight: 400,
  edgeLabelSize: 11,
  edgeLabelWeight: 400,
} as const

/**
 * Render a positioned requirement diagram as an SVG string.
 */
export function renderRequirementSvg(
  diagram: PositionedRequirementDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  // 1. Edges (behind boxes)
  for (const edge of diagram.edges) {
    parts.push(renderEdge(edge))
  }

  // 2. Boxes
  for (const node of diagram.nodes) {
    parts.push(renderNode(node))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Node rendering
// ============================================================================

function renderNode(node: PositionedReqNode): string {
  const { id, x, y, width, height, headerHeight, rowHeight, name, stereotype, rows } = node
  const parts: string[] = []
  const fill = node.kind === 'requirement' ? 'var(--_node-fill, var(--bg))' : 'var(--bg)'

  parts.push(`<g class="node" data-id="${escapeAttr(id)}" data-kind="${node.kind}">`)

  // Outer box
  parts.push(
    `  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" ry="4" ` +
    `fill="${fill}" stroke="var(--_line)" stroke-width="1" class="req-box" />`,
  )

  // Header band
  parts.push(
    `  <rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" rx="4" ry="4" ` +
    `fill="var(--_group-hdr)" stroke="none" class="req-header" />`,
  )
  // Mask the lower corners of the header so only the top is rounded.
  parts.push(
    `  <rect x="${x}" y="${y + headerHeight - 4}" width="${width}" height="4" fill="var(--_group-hdr)" />`,
  )

  // Name
  parts.push(
    `  <text x="${x + width / 2}" y="${y + headerHeight / 2}" text-anchor="middle" ` +
    `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT.nameSize}" font-weight="${FONT.nameWeight}" ` +
    `class="req-name">${escapeXml(name)}</text>`,
  )

  // Header divider
  parts.push(
    `  <line x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}" ` +
    `stroke="var(--_line)" stroke-width="1" />`,
  )

  // Stereotype line
  const stereoY = y + headerHeight + 18 / 2 + 2
  parts.push(
    `  <text x="${x + width / 2}" y="${stereoY}" text-anchor="middle" ` +
    `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT.stereoSize}" font-weight="${FONT.stereoWeight}" ` +
    `font-style="italic" class="req-stereotype">${escapeXml(stereotype)}</text>`,
  )

  // Field rows
  const rowsTop = y + headerHeight + 18
  for (let i = 0; i < rows.length; i++) {
    const rowText = ellipsize(rows[i]!, width - 20)
    const rowY = rowsTop + i * rowHeight + rowHeight / 2
    parts.push(
      `  <text x="${x + 10}" y="${rowY}" text-anchor="start" ` +
      `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT.bodySize}" font-weight="${FONT.bodyWeight}" ` +
      `class="req-row">${escapeXml(rowText)}</text>`,
    )
  }

  parts.push('</g>')
  return parts.join('\n')
}

// ============================================================================
// Edge rendering
// ============================================================================

function renderEdge(edge: PositionedReqEdge): string {
  if (edge.points.length < 2) return ''
  const a = edge.points[0]!
  const b = edge.points[edge.points.length - 1]!
  const parts: string[] = []

  parts.push(
    `<line class="edge req-edge" data-from="${escapeAttr(edge.from)}" data-to="${escapeAttr(edge.to)}" ` +
    `data-type="${escapeAttr(edge.type)}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ` +
    `stroke="var(--_line)" stroke-width="1" stroke-dasharray="5 4" fill="none" />`,
  )

  // Arrowhead at the destination end.
  parts.push(renderArrowHead(a, b))

  // Relationship label with a small background pill for readability.
  const label = `«${edge.type}»`
  const w = estimateTextWidth(label, FONT.edgeLabelSize, FONT.edgeLabelWeight) + 8
  const h = FONT.edgeLabelSize + 6
  parts.push(
    `<rect x="${round(edge.labelX - w / 2)}" y="${round(edge.labelY - h / 2)}" width="${round(w)}" height="${round(h)}" ` +
    `rx="2" ry="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.5" class="req-edge-label-bg" />`,
  )
  parts.push(
    `<text x="${round(edge.labelX)}" y="${round(edge.labelY)}" text-anchor="middle" ` +
    `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT.edgeLabelSize}" font-weight="${FONT.edgeLabelWeight}" ` +
    `class="req-edge-label">${escapeXml(label)}</text>`,
  )

  return parts.join('\n')
}

/** Draw an arrowhead at point `b`, pointing away from `a`. */
function renderArrowHead(
  a: { x: number; y: number },
  b: { x: number; y: number },
): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const size = 9
  const half = 4
  const baseX = b.x - ux * size
  const baseY = b.y - uy * size
  const p1x = round(baseX + px * half)
  const p1y = round(baseY + py * half)
  const p2x = round(baseX - px * half)
  const p2y = round(baseY - py * half)
  return (
    `<polygon points="${round(b.x)},${round(b.y)} ${p1x},${p1y} ${p2x},${p2y}" ` +
    `fill="var(--_line)" class="req-arrow" />`
  )
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(): string {
  return `<style>
  .req-name { fill: var(--_text); }
  .req-stereotype { fill: var(--_text-sec); }
  .req-row { fill: var(--_text); }
  .req-edge-label { fill: var(--_text-sec); }
</style>`
}

// ============================================================================
// Helpers
// ============================================================================

/** Truncate text with an ellipsis if it would overflow `maxWidth` px. */
function ellipsize(text: string, maxWidth: number): string {
  if (estimateTextWidth(text, FONT.bodySize, FONT.bodyWeight) <= maxWidth) return text
  let s = text
  while (s.length > 1 && estimateTextWidth(s + '…', FONT.bodySize, FONT.bodyWeight) > maxWidth) {
    s = s.slice(0, -1)
  }
  return s + '…'
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/'/g, '&#39;')
}
