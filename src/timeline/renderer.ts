import type { PositionedTimeline } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Timeline SVG renderer
//
// Renders a positioned timeline to an SVG string. All colors use the theme's
// CSS custom properties, with per-section accents derived from the accent
// (mirrors the pie/xychart palette). Each event is addressable as a
// <g class="node" data-id="..."> node (the identity contract).
//
// Render order (back to front):
//   1. Section header bands (+ labels)
//   2. Axis spine
//   3. Period markers + labels
//   4. Event cards, each <g class="node" data-id="...">
//   5. Title
// ============================================================================

const FONT = {
  titleSize: 20,
  titleWeight: 600,
  sectionSize: 14,
  sectionWeight: 600,
  periodSize: 15,
  periodWeight: 600,
  eventSize: 13,
  eventWeight: 500,
  markerRadius: 6,
} as const

/**
 * Render a positioned timeline as an SVG string.
 */
export function renderTimelineSvg(
  timeline: PositionedTimeline,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(timeline.width, timeline.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Per-section accent colors, emitted as CSS rules (mirrors the pie palette).
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorIndices = new Set<number>()
  timeline.sections.forEach(s => colorIndices.add(s.colorIndex))
  timeline.periods.forEach(p => colorIndices.add(p.colorIndex))
  timeline.events.forEach(e => colorIndices.add(e.colorIndex))
  const colorRules = [...colorIndices]
    .sort((a, b) => a - b)
    .map(i => {
      const c = i === 0 ? `var(--accent, ${CHART_ACCENT_FALLBACK})` : getSeriesColor(i, accent, colors.bg)
      return `  .tl-fill-${i} { fill: ${c}; }\n  .tl-stroke-${i} { stroke: ${c}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Section header bands
  for (const s of timeline.sections) {
    parts.push(
      `<rect x="${r(s.x)}" y="${r(s.y)}" width="${r(s.width)}" height="${r(s.height)}" rx="6" ` +
      `class="tl-section-band tl-fill-${s.colorIndex}"/>`,
    )
    parts.push(
      `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.sectionSize}" font-weight="${FONT.sectionWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tl-section-label">${escapeXml(s.name)}</text>`,
    )
  }

  // 2. Axis spine
  if (timeline.axis) {
    const a = timeline.axis
    parts.push(`<line x1="${r(a.x1)}" y1="${r(a.y1)}" x2="${r(a.x2)}" y2="${r(a.y2)}" class="tl-axis"/>`)
  }

  // 3. Period markers + labels
  for (const p of timeline.periods) {
    parts.push(
      `<circle cx="${r(p.markerX)}" cy="${r(p.markerY)}" r="${FONT.markerRadius}" class="tl-marker tl-fill-${p.colorIndex}"/>`,
    )
    parts.push(
      `<text x="${r(p.labelX)}" y="${r(p.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.periodSize}" font-weight="${FONT.periodWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tl-period-label">${escapeXml(p.label)}</text>`,
    )
  }

  // 4. Event cards — each addressable as <g class="node" data-id="...">
  for (const e of timeline.events) {
    parts.push(
      `<g class="node" data-id="${escapeAttr(e.id)}">` +
      `<rect x="${r(e.x)}" y="${r(e.y)}" width="${r(e.width)}" height="${r(e.height)}" rx="6" ` +
      `class="tl-event tl-stroke-${e.colorIndex}"/>` +
      `<text x="${r(e.labelX)}" y="${r(e.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.eventSize}" font-weight="${FONT.eventWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tl-event-label">${escapeXml(e.text)}</text>` +
      `</g>`,
    )
  }

  // 5. Title
  if (timeline.title) {
    parts.push(
      `<text x="${r(timeline.title.x)}" y="${r(timeline.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tl-title">${escapeXml(timeline.title.text)}</text>`,
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
  .tl-section-band { stroke: none; }
  .tl-section-label { fill: var(--bg); }
  .tl-axis { stroke: var(--_line); stroke-width: 2; }
  .tl-marker { stroke: var(--bg); stroke-width: 2; }
  .tl-period-label { fill: var(--_text); }
  .tl-event { fill: var(--bg); stroke-width: 1.5; }
  .tl-event-label { fill: var(--_text); }
  .tl-title { fill: var(--_text); }
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
