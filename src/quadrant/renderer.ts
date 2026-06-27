import type { PositionedQuadrantChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Quadrant chart SVG renderer
//
// Renders a positioned quadrant chart to an SVG string.
// All colors use the theme's CSS custom properties (var(--_xxx)) — no
// hardcoded palette, mirroring the xychart renderer.
//
// Render order (back to front):
//   1. Quadrant fills (faint checkerboard tint)
//   2. Plot border + center cross lines
//   3. Quadrant region labels (faint)
//   4. Axis end labels
//   5. Data points (dot + label, wrapped in <g class="node" data-id="...">)
//   6. Chart title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  axisLabelSize: 14,
  axisLabelWeight: 500,
  quadrantLabelSize: 15,
  quadrantLabelWeight: 600,
  pointLabelSize: 13,
  pointLabelWeight: 500,
  pointRadius: 6,
} as const

/**
 * Render a positioned quadrant chart as an SVG string.
 */
export function renderQuadrantSvg(
  chart: PositionedQuadrantChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  const { plotArea } = chart

  // 1. Quadrant fills (faint checkerboard)
  for (const f of chart.quadrantFills) {
    if (!f.tinted) continue
    parts.push(
      `<rect x="${r(f.x)}" y="${r(f.y)}" width="${r(f.width)}" height="${r(f.height)}" class="quad-fill"/>`,
    )
  }

  // 2. Plot border + center cross lines
  parts.push(
    `<rect x="${r(plotArea.x)}" y="${r(plotArea.y)}" width="${r(plotArea.width)}" height="${r(plotArea.height)}" class="quad-border"/>`,
  )
  for (const l of chart.crossLines) {
    parts.push(`<line x1="${r(l.x1)}" y1="${r(l.y1)}" x2="${r(l.x2)}" y2="${r(l.y2)}" class="quad-cross"/>`)
  }

  // 3. Quadrant region labels (faint)
  for (const ql of chart.quadrantLabels) {
    parts.push(
      `<text x="${r(ql.x)}" y="${r(ql.y)}" text-anchor="middle" ` +
      `font-size="${FONT.quadrantLabelSize}" font-weight="${FONT.quadrantLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="quad-region-label">${escapeXml(ql.text)}</text>`,
    )
  }

  // 4. Axis end labels
  for (const al of chart.axisLabels) {
    const transform = al.rotate ? ` transform="rotate(${al.rotate},${r(al.x)},${r(al.y)})"` : ''
    parts.push(
      `<text x="${r(al.x)}" y="${r(al.y)}" text-anchor="${al.anchor}"${transform} ` +
      `font-size="${FONT.axisLabelSize}" font-weight="${FONT.axisLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="quad-axis-label">${escapeXml(al.text)}</text>`,
    )
  }

  // 5. Data points — each addressable as <g class="node" data-id="...">
  for (const p of chart.points) {
    parts.push(
      `<g class="node" data-id="${escapeAttr(p.name)}">` +
      `<circle cx="${r(p.cx)}" cy="${r(p.cy)}" r="${FONT.pointRadius}" class="quad-point"/>` +
      `<text x="${r(p.labelX)}" y="${r(p.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.pointLabelSize}" font-weight="${FONT.pointLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="quad-point-label">${escapeXml(p.name)}</text>` +
      `</g>`,
    )
  }

  // 6. Chart title
  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${r(chart.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="quad-title">${escapeXml(chart.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(): string {
  return `<style>
  .quad-fill { fill: var(--_inner-stroke); opacity: 0.5; }
  .quad-border { fill: none; stroke: var(--_line); stroke-width: 1.5; }
  .quad-cross { stroke: var(--_line); stroke-width: 1; opacity: 0.6; }
  .quad-region-label { fill: var(--_text-faint); }
  .quad-axis-label { fill: var(--_text-sec); }
  .quad-title { fill: var(--_text); }
  .quad-point { fill: var(--_arrow); stroke: var(--bg); stroke-width: 2; }
  .quad-point-label { fill: var(--_text); }
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
