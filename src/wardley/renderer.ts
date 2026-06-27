import type { PositionedWardleyMap } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Wardley map SVG renderer
//
// Renders a positioned wardley map to an SVG string. All colors use the theme's
// CSS custom properties (var(--_xxx) / var(--bg) / var(--accent)) — no
// hardcoded palette, mirroring the quadrant renderer.
//
// Render order (back to front):
//   1. Plot border + evolution stage gridlines (dashed)
//   2. Stage labels (Genesis … Commodity) + axis labels
//   3. Dependency links (each carries data-from / data-to)
//   4. Components / anchors (dot + label, wrapped in <g class="node" data-id>)
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  axisLabelSize: 14,
  axisLabelWeight: 500,
  stageLabelSize: 12,
  stageLabelWeight: 500,
  componentLabelSize: 13,
  componentLabelWeight: 500,
  dotRadius: 6,
  anchorRadius: 7,
} as const

/**
 * Render a positioned wardley map as an SVG string.
 */
export function renderWardleySvg(
  map: PositionedWardleyMap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(map.width, map.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  const { plotArea } = map

  // 1. Plot border + evolution stage gridlines
  parts.push(
    `<rect x="${r(plotArea.x)}" y="${r(plotArea.y)}" width="${r(plotArea.width)}" height="${r(plotArea.height)}" class="wardley-border"/>`,
  )
  for (const g of map.gridLines) {
    parts.push(`<line x1="${r(g.x1)}" y1="${r(g.y1)}" x2="${r(g.x2)}" y2="${r(g.y2)}" class="wardley-grid"/>`)
  }

  // 2. Stage labels + axis labels
  for (const sl of map.stageLabels) {
    parts.push(
      `<text x="${r(sl.x)}" y="${r(sl.y)}" text-anchor="middle" ` +
      `font-size="${FONT.stageLabelSize}" font-weight="${FONT.stageLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="wardley-stage-label">${escapeXml(sl.text)}</text>`,
    )
  }
  for (const al of map.axisLabels) {
    const transform = al.rotate ? ` transform="rotate(${al.rotate},${r(al.x)},${r(al.y)})"` : ''
    parts.push(
      `<text x="${r(al.x)}" y="${r(al.y)}" text-anchor="${al.anchor}"${transform} ` +
      `font-size="${FONT.axisLabelSize}" font-weight="${FONT.axisLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="wardley-axis-label">${escapeXml(al.text)}</text>`,
    )
  }

  // 3. Dependency links — each carries data-from / data-to
  for (const l of map.links) {
    parts.push(
      `<line class="wardley-link wardley-link-${l.style}" ` +
      `data-from="${escapeAttr(l.from)}" data-to="${escapeAttr(l.to)}" ` +
      `x1="${r(l.x1)}" y1="${r(l.y1)}" x2="${r(l.x2)}" y2="${r(l.y2)}"/>`,
    )
  }

  // 4. Components — each addressable as <g class="node" data-id="...">
  for (const c of map.components) {
    const radius = c.kind === 'anchor' ? FONT.anchorRadius : FONT.dotRadius
    const dotClass = c.kind === 'anchor' ? 'wardley-anchor' : 'wardley-component'
    parts.push(
      `<g class="node" data-id="${escapeAttr(c.id)}" data-kind="${c.kind}">` +
      `<circle cx="${r(c.cx)}" cy="${r(c.cy)}" r="${radius}" class="${dotClass}"/>` +
      `<text x="${r(c.labelX)}" y="${r(c.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.componentLabelSize}" font-weight="${FONT.componentLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="wardley-component-label">${escapeXml(c.name)}</text>` +
      `</g>`,
    )
  }

  // 5. Title
  if (map.title) {
    parts.push(
      `<text x="${r(map.title.x)}" y="${r(map.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="wardley-title">${escapeXml(map.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Map-specific CSS
// ============================================================================

function styleBlock(): string {
  return `<style>
  .wardley-border { fill: none; stroke: var(--_line); stroke-width: 1.5; }
  .wardley-grid { stroke: var(--_line); stroke-width: 1; opacity: 0.4; stroke-dasharray: 4 4; }
  .wardley-stage-label { fill: var(--_text-sec); }
  .wardley-axis-label { fill: var(--_text-sec); }
  .wardley-title { fill: var(--_text); }
  .wardley-link { stroke: var(--_line); stroke-width: 1.5; }
  .wardley-link-dashed { stroke-dasharray: 5 4; }
  .wardley-link-flow { stroke: var(--accent, var(--_arrow)); stroke-width: 2; }
  .wardley-component { fill: var(--bg); stroke: var(--_text); stroke-width: 2; }
  .wardley-anchor { fill: var(--accent, var(--_arrow)); stroke: var(--bg); stroke-width: 2; }
  .wardley-component-label { fill: var(--_text); }
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

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/'/g, '&#39;')
}
