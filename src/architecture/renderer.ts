import type {
  PositionedArchitecture, PositionedArchGroup, PositionedArchService,
  PositionedArchJunction, PositionedArchEdge,
} from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, ARROW_HEAD, TEXT_BASELINE_SHIFT } from '../styles.ts'
import { renderIcon } from '../icons/registry.ts'

// ============================================================================
// Architecture (architecture-beta) SVG renderer
//
// Renders a positioned architecture diagram to an SVG string. Every group and
// service is wrapped in a `<g class="node" data-id="…">` (identity contract);
// every edge carries `data-from`/`data-to`. Service glyphs are drawn via the
// shared icon registry with `class="arch-icon"`, whose `color: var(--_text)`
// rule lets the currentColor-based glyphs inherit the theme foreground.
//
// All colors reference the theme's derived CSS custom properties — no
// hardcoded palette. See src/theme.ts.
//
// Render order (back to front):
//   1. Group containers (nested groups draw after parents → on top)
//   2. Edges
//   3. Services + junctions
// ============================================================================

/**
 * Render a positioned architecture diagram as an SVG string.
 */
export function renderArchitectureSvg(
  positioned: PositionedArchitecture,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // 1. Group containers
  for (const g of positioned.groups) parts.push(renderGroup(g))

  // 2. Edges
  for (const e of positioned.edges) parts.push(renderEdge(e))

  // 3. Services + junctions
  for (const s of positioned.services) parts.push(renderService(s))
  for (const j of positioned.junctions) parts.push(renderJunction(j))

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Element rendering
// ============================================================================

function renderGroup(g: PositionedArchGroup): string {
  const rect =
    `<rect x="${r(g.x)}" y="${r(g.y)}" width="${r(g.width)}" height="${r(g.height)}" ` +
    `rx="10" ry="10" class="arch-group-box" />`
  const title =
    `<text x="${r(g.titleX)}" y="${r(g.titleY)}" text-anchor="start" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
    `class="arch-group-title">${escapeXml(g.title)}</text>`
  return (
    `<g class="node" data-id="${escapeAttr(g.id)}" data-label="${escapeAttr(g.title)}">\n` +
    `  ${rect}\n  ${title}\n` +
    `</g>`
  )
}

function renderService(s: PositionedArchService): string {
  const rect =
    `<rect x="${r(s.x)}" y="${r(s.y)}" width="${r(s.width)}" height="${r(s.height)}" ` +
    `rx="8" ry="8" class="arch-service-box" />`
  const icon = renderIcon(s.icon ?? 'unknown', {
    x: s.iconX, y: s.iconY, size: s.iconSize, className: 'arch-icon',
  })
  const label =
    `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT_SIZES.groupHeader}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
    `class="arch-service-label">${escapeXml(s.title)}</text>`
  return (
    `<g class="node" data-id="${escapeAttr(s.id)}" data-label="${escapeAttr(s.title)}">\n` +
    `  ${rect}\n  ${icon}\n  ${label}\n` +
    `</g>`
  )
}

function renderJunction(j: PositionedArchJunction): string {
  // A junction is a small connection node where edges meet.
  const cx = j.x + j.size / 2
  const cy = j.y + j.size / 2
  const radius = Math.min(j.size / 2, 5)
  const circle =
    `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(radius)}" class="arch-junction" />`
  return `<g class="node" data-id="${escapeAttr(j.id)}">\n  ${circle}\n</g>`
}

function renderEdge(e: PositionedArchEdge): string {
  if (e.points.length < 2) return ''
  const pts = e.points.map(p => `${r(p.x)},${r(p.y)}`).join(' ')
  const markerEnd = e.arrowEnd ? ' marker-end="url(#arch-arrow)"' : ''
  const markerStart = e.arrowStart ? ' marker-start="url(#arch-arrow-start)"' : ''
  return (
    `<polyline class="arch-edge edge" data-from="${escapeAttr(e.from)}" data-to="${escapeAttr(e.to)}" ` +
    `points="${pts}"${markerStart}${markerEnd} />`
  )
}

// ============================================================================
// Defs + CSS
// ============================================================================

function arrowMarkerDefs(): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  const style = 'fill="var(--_line)" stroke="var(--_line)" stroke-width="0.75" stroke-linejoin="round"'
  const poly = `<polygon points="0 0, ${w} ${h / 2}, 0 ${h}" ${style} />`
  return (
    `  <marker id="arch-arrow" markerWidth="${w}" markerHeight="${h}" refX="${w - 1}" refY="${h / 2}" orient="auto">\n` +
    `    ${poly}\n  </marker>\n` +
    `  <marker id="arch-arrow-start" markerWidth="${w}" markerHeight="${h}" refX="${w - 1}" refY="${h / 2}" orient="auto-start-reverse">\n` +
    `    ${poly}\n  </marker>`
  )
}

function styleBlock(): string {
  return `<style>
  .arch-group-box { fill: var(--bg); stroke: var(--_group-hdr, var(--_inner-stroke)); stroke-width: ${STROKE_WIDTHS.outerBox}; }
  .arch-group-title { fill: var(--_text-sec); }
  .arch-service-box { fill: var(--bg); stroke: var(--_group-hdr, var(--_inner-stroke)); stroke-width: ${STROKE_WIDTHS.outerBox}; }
  .arch-service-label { fill: var(--_text); }
  .arch-icon { color: var(--_text); }
  .arch-edge { fill: none; stroke: var(--_line); stroke-width: ${STROKE_WIDTHS.connector}; }
  .arch-junction { fill: var(--_line); stroke: var(--bg); stroke-width: 2; }
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
