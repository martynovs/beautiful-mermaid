import type { PositionedGantt, PositionedTask } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Gantt chart SVG renderer
//
// Renders a positioned gantt chart to an SVG string. All colors come from the
// theme's CSS custom properties; bar fills are per-section shades derived from
// the accent (mirrors the xychart / pie palette). Each task is addressable as
// a <g class="node" data-id="..."> node (the identity contract).
//
// Render order (back to front):
//   1. Section bands (faint)
//   2. Day gridlines + header date labels
//   3. Task bars / milestones, each <g class="node" data-id="...">
//   4. Task name labels (left column) + section labels
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  taskLabelSize: 13,
  taskLabelWeight: 500,
  sectionLabelSize: 12,
  sectionLabelWeight: 600,
  headerSize: 11,
  headerWeight: 500,
} as const

/**
 * Render a positioned gantt chart as an SVG string.
 */
export function renderGanttSvg(
  chart: PositionedGantt,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Per-section fill rules (section 0 = accent, rest are shades of it).
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const sectionCount = chart.sections.length || 1
  const colorRules: string[] = []
  for (let i = 0; i < sectionCount; i++) {
    const fill = i === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(i, accent, colors.bg)
    colorRules.push(`  .gantt-sec-${i} { fill: ${fill}; }`)
  }
  parts.push(styleBlock(colorRules.join('\n')))

  // 1. Section bands (alternating faint tint)
  chart.sections.forEach((s, i) => {
    if (i % 2 === 1) {
      parts.push(
        `<rect x="${r(s.bandX)}" y="${r(s.bandY)}" width="${r(s.bandW)}" height="${r(s.bandH)}" class="gantt-band"/>`,
      )
    }
  })

  // 2. Day gridlines + header labels
  for (const gl of chart.gridLines) {
    parts.push(
      `<line x1="${r(gl.x)}" y1="${r(gl.y1)}" x2="${r(gl.x)}" y2="${r(gl.y2)}" class="gantt-grid"/>`,
    )
    if (gl.label && gl.labelX !== undefined && gl.labelY !== undefined) {
      // Date labels are wide, so render them rotated to vertical (reading
      // bottom-to-top) — adjacent labels become thin strips that no longer
      // overlap. `text-anchor="start"` grows the label upward from its anchor
      // (just above the grid) into the reserved header band; the dy keeps it
      // optically centered on the gridline x.
      parts.push(
        `<text x="${r(gl.labelX)}" y="${r(gl.labelY)}" text-anchor="start" ` +
        `transform="rotate(-90,${r(gl.labelX)},${r(gl.labelY)})" ` +
        `font-size="${FONT.headerSize}" font-weight="${FONT.headerWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="gantt-header">${escapeXml(gl.label)}</text>`,
      )
    }
  }

  // 3. Task bars / milestones — each addressable as <g class="node" data-id="...">
  for (const t of chart.tasks) {
    parts.push(renderTask(t))
  }

  // 4. Task name labels (left column)
  for (const t of chart.tasks) {
    parts.push(
      `<text x="${r(t.labelX)}" y="${r(t.labelY)}" text-anchor="end" ` +
      `font-size="${FONT.taskLabelSize}" font-weight="${FONT.taskLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="gantt-task-label">${escapeXml(t.name)}</text>`,
    )
  }

  // 4b. Section labels (rotated, at the left strip)
  for (const s of chart.sections) {
    parts.push(
      `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" ` +
      `transform="rotate(-90,${r(s.labelX)},${r(s.labelY)})" ` +
      `font-size="${FONT.sectionLabelSize}" font-weight="${FONT.sectionLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="gantt-section-label">${escapeXml(s.name)}</text>`,
    )
  }

  // 5. Title
  if (chart.title) {
    parts.push(
      `<text x="${r(chart.title.x)}" y="${r(chart.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="gantt-title">${escapeXml(chart.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** Render one task as an identity-bearing group (bar or milestone diamond). */
function renderTask(t: PositionedTask): string {
  const statusClass = t.tags
    .filter(tag => tag !== 'milestone')
    .map(tag => `gantt-${tag}`)
    .join(' ')

  let shape: string
  if (t.milestone) {
    const m = 9
    const path = `M${r(t.cx)},${r(t.cy - m)} L${r(t.cx + m)},${r(t.cy)} ` +
      `L${r(t.cx)},${r(t.cy + m)} L${r(t.cx - m)},${r(t.cy)} Z`
    shape = `<path d="${path}" class="gantt-milestone gantt-sec-${t.colorIndex} ${statusClass}"/>`
  } else {
    shape = `<rect x="${r(t.x)}" y="${r(t.y)}" width="${r(t.width)}" height="${r(t.height)}" ` +
      `rx="3" class="gantt-bar gantt-sec-${t.colorIndex} ${statusClass}"/>`
  }

  return `<g class="node" data-id="${escapeAttr(t.id)}">${shape}</g>`
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .gantt-band { fill: var(--_inner-stroke); opacity: 0.4; }
  .gantt-grid { stroke: var(--_line); stroke-width: 0.75; opacity: 0.45; }
  .gantt-header { fill: var(--_text-sec); }
  .gantt-bar { stroke: var(--bg); stroke-width: 1; }
  .gantt-milestone { stroke: var(--bg); stroke-width: 1; }
  .gantt-task-label { fill: var(--_text); }
  .gantt-section-label { fill: var(--_text-sec); }
  .gantt-title { fill: var(--_text); }
  .gantt-done { opacity: 0.55; }
  .gantt-active { stroke: var(--accent, ${CHART_ACCENT_FALLBACK}); stroke-width: 1.5; stroke-dasharray: 4 2; }
  .gantt-crit { stroke: var(--accent, ${CHART_ACCENT_FALLBACK}); stroke-width: 2; }
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
