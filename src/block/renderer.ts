import type { PositionedBlockDiagram, PositionedBlock, PositionedBlockEdge } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, ARROW_HEAD, TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Block diagram SVG renderer
//
// Renders a positioned block diagram to an SVG string, mirroring the flowchart
// renderer conventions so blocks/edges are addressable and interactive:
//   - Each block:  <g class="node" data-id="..."><rect/><text/></g>
//   - Each edge:   <polyline class="edge" data-from data-to ... marker-end>
//
// All colors reference the derived CSS custom properties (var(--_xxx)) from
// the theme system — no hardcoded palette. See src/theme.ts.
// ============================================================================

/**
 * Render a positioned block diagram as an SVG string.
 */
export function renderBlockSvg(
  diagram: PositionedBlockDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  // SVG root with CSS variables + style block + defs
  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // 1. Edges (rendered behind blocks)
  for (const edge of diagram.edges) {
    parts.push(renderEdge(edge))
  }

  // 2. Blocks (shape + label)
  for (const block of diagram.blocks) {
    parts.push(renderBlock(block))
  }

  parts.push('</svg>')

  return parts.join('\n')
}

// ============================================================================
// Arrow marker — forward arrowhead, tinted via var(--_arrow).
// Mirrors the flowchart renderer's marker so it matches visually.
// ============================================================================

function arrowMarkerDefs(): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  const arrowStyle = 'fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="0.75" stroke-linejoin="round"'
  const refX = w - 1
  return (
    `  <marker id="arrowhead" markerWidth="${w}" markerHeight="${h}" refX="${refX}" refY="${h / 2}" orient="auto">` +
    `\n    <polygon points="0 0, ${w} ${h / 2}, 0 ${h}" ${arrowStyle} />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Edge rendering
// ============================================================================

function renderEdge(edge: PositionedBlockEdge): string {
  if (edge.points.length < 2) return ''

  const pathData = edge.points.map(p => `${r(p.x)},${r(p.y)}`).join(' ')
  return (
    `<polyline class="edge" data-from="${escapeAttr(edge.source)}" data-to="${escapeAttr(edge.target)}" ` +
    `points="${pathData}" fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" ` +
    `marker-end="url(#arrowhead)" />`
  )
}

// ============================================================================
// Block rendering
// ============================================================================

function renderBlock(block: PositionedBlock): string {
  const { x, y, width, height, id, label } = block
  const cx = x + width / 2
  const cy = y + height / 2

  const rect =
    `<rect x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" ` +
    `rx="6" ry="6" fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`

  const text =
    `<text x="${r(cx)}" y="${r(cy)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="var(--_text)">` +
    `${escapeXml(label)}</text>`

  return (
    `<g class="node" data-id="${escapeAttr(id)}" data-label="${escapeAttr(label)}">\n` +
    `  ${rect}\n` +
    `  ${text}\n` +
    `</g>`
  )
}

// ============================================================================
// Utilities
// ============================================================================

function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
