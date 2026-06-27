import type { PositionedPieChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Pie chart SVG renderer
//
// Renders a positioned pie chart to an SVG string. All colors use the theme's
// CSS custom properties, with per-slice fills derived from the accent (mirrors
// the xychart palette). Each slice is addressable as a data-id node carrying
// its value (the identity contract).
//
// Render order (back to front):
//   1. Slices (wedges + inside % labels), each <g class="node" data-id data-value>
//   2. Legend (swatch + label)
//   3. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  sliceLabelSize: 13,
  sliceLabelWeight: 600,
  legendSize: 14,
  legendWeight: 400,
} as const

/**
 * Render a positioned pie chart as an SVG string.
 */
export function renderPieSvg(
  chart: PositionedPieChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorRules = chart.slices
    .map(s => {
      const fill = s.colorIndex === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(s.colorIndex, accent, colors.bg)
      return `  .pie-color-${s.colorIndex} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Slices — each addressable as <g class="node" data-id="..." data-value="...">
  for (const s of chart.slices) {
    const insideLabel = s.percent >= 5
      ? `<text x="${rr(s.labelX)}" y="${rr(s.labelY)}" text-anchor="middle" ` +
        `font-size="${FONT.sliceLabelSize}" font-weight="${FONT.sliceLabelWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="pie-slice-label">${fmtPct(s.percent)}</text>`
      : ''
    parts.push(
      `<g class="node" data-id="${escapeAttr(s.label)}" data-value="${s.value}">` +
      `<path d="${s.path}" class="pie-slice pie-color-${s.colorIndex}"/>` +
      insideLabel +
      `</g>`,
    )
  }

  // 2. Legend
  for (const item of chart.legend) {
    parts.push(
      `<rect x="${rr(item.swatchX)}" y="${rr(item.swatchY)}" width="14" height="14" rx="3" ` +
      `class="pie-slice pie-color-${item.colorIndex}"/>`,
    )
    parts.push(
      `<text x="${rr(item.x)}" y="${rr(item.y)}" text-anchor="start" ` +
      `font-size="${FONT.legendSize}" font-weight="${FONT.legendWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-legend-label">${escapeXml(item.label)}</text>`,
    )
  }

  // 3. Title
  if (chart.title) {
    parts.push(
      `<text x="${rr(chart.title.x)}" y="${rr(chart.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="pie-title">${escapeXml(chart.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .pie-slice { stroke: var(--bg); stroke-width: 2; }
  .pie-slice-label { fill: var(--bg); }
  .pie-legend-label { fill: var(--_text); }
  .pie-title { fill: var(--_text); }
${colorRules}
</style>`
}

// ============================================================================
// Helpers
// ============================================================================

function fmtPct(percent: number): string {
  return `${Math.round(percent)}%`
}

function rr(n: number): string {
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
