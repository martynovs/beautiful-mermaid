import type { PositionedEventModeling, PositionedFrame, PositionedRelation } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, STROKE_WIDTHS, ARROW_HEAD } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Event modeling SVG renderer
//
// Renders a positioned event-modeling diagram to an SVG string. All colors
// reference the theme's derived CSS custom properties (var(--_text), etc.),
// with a distinct per-entity-type fill derived from the accent via the shared
// chart palette (getSeriesColor) — no hardcoded colors.
//
// Identity contract:
//   - Each frame:    <g class="node" data-id="<frame number>">…</g>
//   - Each relation: <polyline class="edge" data-from data-to … marker-end>
//
// Render order (back to front):
//   1. Swimlane bands + separators + labels
//   2. Relations (connectors)
//   3. Frame boxes (rect + name + type caption)
//   4. Time-axis number labels
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  laneLabelSize: 13,
  laneLabelWeight: 600,
  axisSize: 12,
  axisWeight: 600,
  nameSize: 13,
  nameWeight: 600,
  typeSize: 10,
  typeWeight: 500,
} as const

/** Human-readable caption per entity type. */
const TYPE_CAPTION: Record<string, string> = {
  ui: 'UI',
  pcr: 'Processor',
  cmd: 'Command',
  rmo: 'Read Model',
  evt: 'Event',
}

/**
 * Render a positioned event-modeling diagram as an SVG string.
 */
export function renderEventModelingSvg(
  diagram: PositionedEventModeling,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // Per-entity-type fill rules, derived from the accent.
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const usedIndices = Array.from(new Set(diagram.frames.map(f => f.colorIndex))).sort((a, b) => a - b)
  const colorRules = usedIndices
    .map(idx => {
      const fill = idx === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(idx, accent, colors.bg)
      return `  .em-color-${idx} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Swimlanes — alternating bands, separators and labels.
  diagram.lanes.forEach((lane, i) => {
    const bandClass = i % 2 === 1 ? 'em-lane em-lane-alt' : 'em-lane'
    parts.push(
      `<rect class="${bandClass}" x="0" y="${r(lane.y)}" width="${r(diagram.width)}" height="${r(lane.height)}" />`,
    )
    parts.push(
      `<text x="${r(lane.labelX)}" y="${r(lane.labelY)}" text-anchor="start" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT.laneLabelSize}" font-weight="${FONT.laneLabelWeight}" class="em-lane-label">` +
      `${escapeXml(lane.label)}</text>`,
    )
  })

  // 2. Relations (behind boxes).
  for (const rel of diagram.relations) {
    parts.push(renderRelation(rel))
  }

  // 3. Frame boxes.
  for (const frame of diagram.frames) {
    parts.push(renderFrame(frame))
  }

  // 4. Time-axis number labels.
  for (const a of diagram.axis) {
    parts.push(
      `<text x="${r(a.x)}" y="${r(a.y)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT.axisSize}" font-weight="${FONT.axisWeight}" class="em-axis-label">` +
      `${escapeXml(a.text)}</text>`,
    )
  }

  // 5. Title.
  if (diagram.title) {
    parts.push(
      `<text x="${r(diagram.title.x)}" y="${r(diagram.title.y)}" text-anchor="middle" ` +
      `dy="${TEXT_BASELINE_SHIFT}" font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `class="em-title">${escapeXml(diagram.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Frame rendering
// ============================================================================

function renderFrame(frame: PositionedFrame): string {
  const { x, y, width, height, id, name, type, colorIndex } = frame
  const cx = x + width / 2
  const caption = TYPE_CAPTION[type] ?? type
  const hasCaption = height >= 40

  const nameY = hasCaption ? y + height / 2 - 7 : y + height / 2
  const captionY = y + height / 2 + 13

  const rect =
    `<rect x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" rx="6" ry="6" ` +
    `class="em-box em-color-${colorIndex}" stroke="var(--bg)" stroke-width="${STROKE_WIDTHS.outerBox}" />`

  const nameText =
    `<text x="${r(cx)}" y="${r(nameY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT.nameSize}" font-weight="${FONT.nameWeight}" class="em-box-name">` +
    `${escapeXml(name)}</text>`

  const captionText = hasCaption
    ? `<text x="${r(cx)}" y="${r(captionY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT.typeSize}" font-weight="${FONT.typeWeight}" class="em-box-type">` +
      `${escapeXml(caption)}</text>`
    : ''

  return (
    `<g class="node" data-id="${escapeAttr(id)}" data-type="${escapeAttr(type)}" data-label="${escapeAttr(name)}">\n` +
    `  ${rect}\n` +
    `  ${nameText}\n` +
    (captionText ? `  ${captionText}\n` : '') +
    `</g>`
  )
}

// ============================================================================
// Relation rendering
// ============================================================================

function renderRelation(rel: PositionedRelation): string {
  if (rel.points.length < 2) return ''
  const pts = rel.points.map(p => `${r(p.x)},${r(p.y)}`).join(' ')
  return (
    `<polyline class="edge" data-from="${escapeAttr(rel.from)}" data-to="${escapeAttr(rel.to)}" ` +
    `points="${pts}" fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" ` +
    `marker-end="url(#arrowhead)" />`
  )
}

// ============================================================================
// Arrow marker — mirrors the block/flowchart renderers.
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
// Diagram-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .em-lane { fill: var(--bg); }
  .em-lane-alt { fill: var(--_group-hdr); }
  .em-lane-label { fill: var(--_text-sec); }
  .em-axis-label { fill: var(--_text-sec); }
  .em-box-name { fill: var(--bg); }
  .em-box-type { fill: var(--bg); opacity: 0.85; }
  .em-title { fill: var(--_text); }
${colorRules}
</style>`
}

// ============================================================================
// Helpers
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
  return escapeXml(value).replace(/'/g, '&#39;')
}
