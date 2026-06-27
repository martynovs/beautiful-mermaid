import type { PositionedVennDiagram } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Venn diagram SVG renderer
//
// Renders a positioned venn diagram to an SVG string. All colors use the
// theme's CSS custom properties — per-set fills are derived from the accent
// (mirrors the pie / xychart palette) and drawn with a low fill-opacity so
// overlap regions blend visibly.
//
// Identity contract:
//   - each set circle  → <g class="node" data-id="<setId>">
//   - each overlap     → <g class="node" data-id="<A∩B>"> (references set ids)
//
// Render order (back to front):
//   1. Set circles (translucent fills + set label), one <g> each
//   2. Union / overlap labels, one <g> each
//   3. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  setLabelSize: 16,
  setLabelWeight: 600,
  unionLabelSize: 13,
  unionLabelWeight: 500,
} as const

/**
 * Render a positioned venn diagram as an SVG string.
 */
export function renderVennSvg(
  diagram: PositionedVennDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorRules = diagram.sets
    .map(s => {
      const fill =
        s.colorIndex === 0
          ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
          : getSeriesColor(s.colorIndex, accent, colors.bg)
      return `  .venn-color-${s.colorIndex} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Set circles — each addressable as <g class="node" data-id="...">
  for (const s of diagram.sets) {
    parts.push(
      `<g class="node" data-id="${escapeAttr(s.id)}">` +
        `<circle cx="${r(s.cx)}" cy="${r(s.cy)}" r="${r(s.r)}" ` +
        `class="venn-circle venn-color-${s.colorIndex}"/>` +
        `<text x="${r(s.labelX)}" y="${r(s.labelY)}" text-anchor="middle" ` +
        `font-size="${FONT.setLabelSize}" font-weight="${FONT.setLabelWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="venn-set-label">${escapeXml(s.label)}</text>` +
        `</g>`,
    )
  }

  // 2. Union / overlap regions — addressable via their member set ids.
  // No derived `A ∩ B` caption is drawn (the visual overlap conveys the
  // region and stacked captions look cramped); an explicit label, if any, is
  // shown at the lens centroid. The <g> stays addressable via data-id either way.
  for (const u of diagram.unions) {
    const label = u.label.trim()
      ? `<text x="${r(u.x)}" y="${r(u.y)}" text-anchor="middle" ` +
        `font-size="${FONT.unionLabelSize}" font-weight="${FONT.unionLabelWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="venn-union-label">${escapeXml(u.label)}</text>`
      : ''
    parts.push(
      `<g class="node venn-union" data-id="${escapeAttr(u.id)}">${label}</g>`,
    )
  }

  // 3. Title
  if (diagram.title) {
    parts.push(
      `<text x="${r(diagram.title.x)}" y="${r(diagram.title.y)}" text-anchor="middle" ` +
        `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="venn-title">${escapeXml(diagram.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Diagram-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .venn-circle { stroke: var(--_line); stroke-width: 1.5; fill-opacity: 0.32; }
  .venn-set-label { fill: var(--_text); }
  .venn-union-label { fill: var(--_text); }
  .venn-title { fill: var(--_text); }
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
