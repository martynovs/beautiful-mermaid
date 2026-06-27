import type { PositionedJourney } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// User journey SVG renderer
//
// Renders a positioned journey to an SVG string. All colors use the theme's
// CSS custom properties, with per-section fills derived from the accent
// (mirrors the xychart palette). Each task is addressable as a data-id node
// carrying its satisfaction score (the identity contract).
//
// Render order (back to front):
//   1. Score gridlines + axis labels
//   2. Timeline baseline
//   3. Section header bands (colored, with labels)
//   4. Tasks (dotted connector + satisfaction marker + score + name + actors),
//      each wrapped in <g class="node" data-id data-value>
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  sectionSize: 14,
  sectionWeight: 600,
  axisSize: 12,
  axisWeight: 500,
  scoreSize: 13,
  scoreWeight: 700,
  taskLabelSize: 13,
  taskLabelWeight: 600,
  actorSize: 11,
  actorWeight: 400,
  markerRadius: 16,
} as const

/**
 * Render a positioned journey as an SVG string.
 */
export function renderJourneySvg(
  journey: PositionedJourney,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(journey.width, journey.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorIndexes = new Set(journey.sections.map(s => s.colorIndex))
  const colorRules = [...colorIndexes]
    .map(i => {
      const fill = i === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(i, accent, colors.bg)
      return `  .journey-color-${i} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Score gridlines + axis labels
  for (const sl of journey.scoreLines) {
    parts.push(
      `<line x1="${r(sl.x1)}" y1="${r(sl.y)}" x2="${r(sl.x2)}" y2="${r(sl.y)}" class="journey-grid"/>`,
    )
    parts.push(
      `<text x="${r(sl.labelX)}" y="${r(sl.labelY)}" text-anchor="end" ` +
      `font-size="${FONT.axisSize}" font-weight="${FONT.axisWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="journey-axis-label">${sl.score}</text>`,
    )
  }

  // 2. Timeline baseline
  const b = journey.baseline
  parts.push(`<line x1="${r(b.x1)}" y1="${r(b.y1)}" x2="${r(b.x2)}" y2="${r(b.y2)}" class="journey-baseline"/>`)

  // 3. Section header bands
  for (const s of journey.sections) {
    parts.push(
      `<rect x="${r(s.x)}" y="${r(s.y)}" width="${r(s.width)}" height="${r(s.height)}" rx="6" ` +
      `class="journey-section journey-color-${s.colorIndex}"/>`,
    )
    if (s.name) {
      parts.push(
        `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" ` +
        `font-size="${FONT.sectionSize}" font-weight="${FONT.sectionWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="journey-section-label">${escapeXml(s.name)}</text>`,
      )
    }
  }

  // 4. Tasks — each addressable as <g class="node" data-id="..." data-value="...">
  for (const t of journey.tasks) {
    const actorText = t.actors.length
      ? `<text x="${r(t.actorsX)}" y="${r(t.actorsY)}" text-anchor="middle" ` +
        `font-size="${FONT.actorSize}" font-weight="${FONT.actorWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="journey-actors">${escapeXml(t.actors.join(', '))}</text>`
      : ''
    parts.push(
      `<g class="node" data-id="${escapeAttr(t.id)}" data-value="${t.score}">` +
      `<line x1="${r(t.cx)}" y1="${r(t.connectorY1)}" x2="${r(t.cx)}" y2="${r(t.connectorY2)}" class="journey-connector"/>` +
      `<circle cx="${r(t.cx)}" cy="${r(t.cy)}" r="${FONT.markerRadius}" ` +
      `class="journey-marker journey-color-${t.colorIndex}"/>` +
      `<text x="${r(t.cx)}" y="${r(t.cy)}" text-anchor="middle" ` +
      `font-size="${FONT.scoreSize}" font-weight="${FONT.scoreWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="journey-score">${t.score}</text>` +
      `<text x="${r(t.labelX)}" y="${r(t.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.taskLabelSize}" font-weight="${FONT.taskLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="journey-task-label">${escapeXml(t.name)}</text>` +
      actorText +
      `</g>`,
    )
  }

  // 5. Title
  if (journey.title) {
    parts.push(
      `<text x="${r(journey.title.x)}" y="${r(journey.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="journey-title">${escapeXml(journey.title.text)}</text>`,
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
  .journey-grid { stroke: var(--_inner-stroke); stroke-width: 1; }
  .journey-axis-label { fill: var(--_text-sec); }
  .journey-baseline { stroke: var(--_line); stroke-width: 1.5; }
  .journey-section { opacity: 0.18; }
  .journey-section-label { fill: var(--_text); }
  .journey-connector { stroke: var(--_line); stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.7; }
  .journey-marker { stroke: var(--bg); stroke-width: 2; }
  .journey-score { fill: var(--bg); }
  .journey-task-label { fill: var(--_text); }
  .journey-actors { fill: var(--_text-sec); }
  .journey-title { fill: var(--_text); }
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
