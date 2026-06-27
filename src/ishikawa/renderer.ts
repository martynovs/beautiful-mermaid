import type { PositionedIshikawa } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Ishikawa (fishbone) SVG renderer
//
// Renders a positioned ishikawa diagram to an SVG string. All colors use the
// theme's CSS custom properties — no hardcoded palette.
//
// Identity contract: the effect, every category, and every cause is wrapped in
// `<g class="node" data-id="...">`. The connector lines (category bones, cause
// sub-bones) carry data-from / data-to linking the named nodes.
//
// Render order (back to front):
//   1. Spine + category bones + cause sub-bones (connectors)
//   2. Cause labels
//   3. Category labels
//   4. Effect head box + label
// ============================================================================

const FONT = {
  effectSize: 16,
  effectWeight: 700,
  catSize: 14,
  catWeight: 600,
  causeSize: 12,
  causeWeight: 400,
} as const

/**
 * Render a positioned ishikawa diagram as an SVG string.
 */
export function renderIshikawaSvg(
  positioned: PositionedIshikawa,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  const { spine, head } = positioned

  // 1. Spine
  parts.push(
    `<line x1="${r(spine.x1)}" y1="${r(spine.y1)}" x2="${r(spine.x2)}" y2="${r(spine.y2)}" ` +
    `class="ish-spine" data-from="${escapeAttr(head.id)}" data-to="${escapeAttr(head.id)}"/>`,
  )

  // 1b. Category bones + cause sub-bones (drawn behind the labels)
  for (const cat of positioned.categories) {
    parts.push(
      `<line x1="${r(cat.bone.x1)}" y1="${r(cat.bone.y1)}" x2="${r(cat.bone.x2)}" y2="${r(cat.bone.y2)}" ` +
      `class="ish-bone" data-from="${escapeAttr(head.id)}" data-to="${escapeAttr(cat.id)}"/>`,
    )
    for (const cause of cat.causes) {
      parts.push(
        `<line x1="${r(cause.bone.x1)}" y1="${r(cause.bone.y1)}" x2="${r(cause.bone.x2)}" y2="${r(cause.bone.y2)}" ` +
        `class="ish-subbone" data-from="${escapeAttr(cause.parentId)}" data-to="${escapeAttr(cause.id)}"/>`,
      )
    }
  }

  // 2 + 3. Cause and category nodes (text), each addressable via data-id.
  for (const cat of positioned.categories) {
    for (const cause of cat.causes) {
      parts.push(
        `<g class="node" data-id="${escapeAttr(cause.id)}">` +
        `<text x="${r(cause.labelX)}" y="${r(cause.labelY)}" text-anchor="end" ` +
        `font-size="${FONT.causeSize}" font-weight="${FONT.causeWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="ish-cause-label">${escapeXml(cause.text)}</text>` +
        `</g>`,
      )
    }
    parts.push(
      `<g class="node" data-id="${escapeAttr(cat.id)}">` +
      `<text x="${r(cat.labelX)}" y="${r(cat.labelY)}" text-anchor="middle" ` +
      `font-size="${FONT.catSize}" font-weight="${FONT.catWeight}" ` +
      `class="ish-cat-label">${escapeXml(cat.text)}</text>` +
      `</g>`,
    )
  }

  // 4. Effect head box + label
  parts.push(
    `<g class="node" data-id="${escapeAttr(head.id)}">` +
    `<rect x="${r(head.boxX)}" y="${r(head.boxY)}" width="${r(head.boxW)}" height="${r(head.boxH)}" ` +
    `rx="6" class="ish-head-box"/>` +
    `<text x="${r(head.x)}" y="${r(head.y)}" text-anchor="middle" ` +
    `font-size="${FONT.effectSize}" font-weight="${FONT.effectWeight}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" class="ish-head-label">${escapeXml(head.text)}</text>` +
    `</g>`,
  )

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(): string {
  return `<style>
  .ish-spine { stroke: var(--_line); stroke-width: 2.5; stroke-linecap: round; }
  .ish-bone { stroke: var(--_line); stroke-width: 1.75; stroke-linecap: round; }
  .ish-subbone { stroke: var(--_line); stroke-width: 1; stroke-linecap: round; }
  .ish-head-box { fill: var(--bg); stroke: var(--accent, var(--_line)); stroke-width: 2; }
  .ish-head-label { fill: var(--_text); }
  .ish-cat-label { fill: var(--_text); }
  .ish-cause-label { fill: var(--_text-sec); }
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
