import type { PositionedRadarChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Radar chart SVG renderer
//
// Renders a positioned radar chart to an SVG string. All colors use the theme's
// CSS custom properties, with per-series fills derived from the accent (mirrors
// the xychart / pie palette). Each series is addressable as a data-id node, and
// every plotted vertex carries its own unique data-id (the identity contract).
//
// Render order (back to front):
//   1. Graticule rings + axis spokes (grid)
//   2. Axis labels
//   3. Series polygons + vertices, each <g class="node" data-id="<series>">
//   4. Legend (swatch + label)
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  axisLabelSize: 13,
  axisLabelWeight: 500,
  legendSize: 14,
  legendWeight: 400,
  pointRadius: 3,
} as const

/**
 * Render a positioned radar chart as an SVG string.
 */
export function renderRadarSvg(
  chart: PositionedRadarChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorRules = chart.series
    .map(s => {
      const c = s.colorIndex === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(s.colorIndex, accent, colors.bg)
      return `  .radar-color-${s.colorIndex} { fill: ${c}; stroke: ${c}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  const { cx, cy } = chart

  // 1. Graticule rings + axis spokes
  for (const ring of chart.rings) {
    parts.push(`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(ring)}" class="radar-ring"/>`)
  }
  for (const a of chart.axes) {
    parts.push(`<line x1="${r(cx)}" y1="${r(cy)}" x2="${r(a.x)}" y2="${r(a.y)}" class="radar-spoke"/>`)
  }

  // 2. Axis labels
  for (const a of chart.axes) {
    parts.push(
      `<text x="${r(a.labelX)}" y="${r(a.labelY)}" text-anchor="${a.labelAnchor}" ` +
      `font-size="${FONT.axisLabelSize}" font-weight="${FONT.axisLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="radar-axis-label">${escapeXml(a.label)}</text>`,
    )
  }

  // 3. Series — each addressable as <g class="node" data-id="...">, with each
  //    plotted vertex carrying its own unique data-id.
  for (const s of chart.series) {
    const vertices = s.points
      .map(
        p =>
          `<circle cx="${r(p.x)}" cy="${r(p.y)}" r="${FONT.pointRadius}" ` +
          `class="radar-point radar-color-${s.colorIndex}" ` +
          `data-id="${escapeAttr(p.id)}" data-axis="${escapeAttr(p.axisId)}" data-value="${p.value}"/>`,
      )
      .join('')
    parts.push(
      `<g class="node" data-id="${escapeAttr(s.id)}" data-label="${escapeAttr(s.label)}">` +
      (s.path ? `<path d="${s.path}" class="radar-area radar-color-${s.colorIndex}"/>` : '') +
      vertices +
      `</g>`,
    )
  }

  // 4. Legend
  for (const item of chart.legend) {
    parts.push(
      `<rect x="${r(item.swatchX)}" y="${r(item.swatchY)}" width="14" height="14" rx="3" ` +
      `class="radar-area radar-color-${item.colorIndex}"/>`,
    )
    parts.push(
      `<text x="${r(item.x)}" y="${r(item.y)}" text-anchor="start" ` +
      `font-size="${FONT.legendSize}" font-weight="${FONT.legendWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="radar-legend-label">${escapeXml(item.label)}</text>`,
    )
  }

  // 5. Title
  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${r(chart.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="radar-title">${escapeXml(chart.title.text)}</text>`,
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
  .radar-ring { fill: none; stroke: var(--_inner-stroke); stroke-width: 1; }
  .radar-spoke { stroke: var(--_line); stroke-width: 1; opacity: 0.6; }
  .radar-axis-label { fill: var(--_text-sec); }
  .radar-area { fill-opacity: 0.18; stroke-width: 2; stroke-linejoin: round; }
  .radar-point { fill-opacity: 1; stroke: var(--bg); stroke-width: 1; }
  .radar-legend-label { fill: var(--_text); }
  .radar-title { fill: var(--_text); }
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

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/'/g, '&#39;')
}
