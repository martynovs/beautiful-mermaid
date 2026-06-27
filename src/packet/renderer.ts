import type { PositionedPacketDiagram } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Packet diagram SVG renderer
//
// Renders a positioned packet diagram to an SVG string. All colors use the
// theme's CSS custom properties — no hardcoded palette. Each field is
// addressable as a <g class="node" data-id="..."> node (the identity
// contract); a field that wraps across rows keeps all its segments inside the
// single wrapper.
//
// Render order (back to front):
//   1. Fields (rectangles + bit-index numbers + label), each <g class="node">
//   2. Title
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  labelSize: 13,
  labelWeight: 500,
  bitNumSize: 10,
  bitNumWeight: 400,
} as const

/**
 * Render a positioned packet diagram as an SVG string.
 */
export function renderPacketSvg(
  diagram: PositionedPacketDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  // 1. Fields — each addressable as <g class="node" data-id="...">
  for (const field of diagram.fields) {
    const inner: string[] = []
    for (const seg of field.segments) {
      inner.push(
        `<rect x="${r(seg.x)}" y="${r(seg.y)}" width="${r(seg.width)}" height="${r(seg.height)}" class="packet-field-rect"/>`,
      )

      // Bit-index number at the start of the segment (and the end, if wider than one bit)
      inner.push(
        `<text x="${r(seg.x + 2)}" y="${r(seg.y - 4)}" text-anchor="start" ` +
        `font-size="${FONT.bitNumSize}" font-weight="${FONT.bitNumWeight}" class="packet-bit-num">${seg.startBit}</text>`,
      )
      if (seg.endBit !== seg.startBit) {
        inner.push(
          `<text x="${r(seg.x + seg.width - 2)}" y="${r(seg.y - 4)}" text-anchor="end" ` +
          `font-size="${FONT.bitNumSize}" font-weight="${FONT.bitNumWeight}" class="packet-bit-num">${seg.endBit}</text>`,
        )
      }

      inner.push(
        `<text x="${r(seg.labelX)}" y="${r(seg.labelY)}" text-anchor="middle" ` +
        `font-size="${FONT.labelSize}" font-weight="${FONT.labelWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="packet-field-label">${escapeXml(field.label)}</text>`,
      )
    }

    parts.push(
      `<g class="node" data-id="${escapeAttr(field.id)}" data-start="${field.start}" data-end="${field.end}">` +
      inner.join('') +
      `</g>`,
    )
  }

  // 2. Title
  if (diagram.title) {
    parts.push(
      `<text x="${r(diagram.title.x)}" y="${r(diagram.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="packet-title">${escapeXml(diagram.title.text)}</text>`,
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
  .packet-field-rect { fill: var(--bg); stroke: var(--accent, var(--_line)); stroke-width: 1.5; }
  .packet-field-label { fill: var(--_text); }
  .packet-bit-num { fill: var(--_text-sec); }
  .packet-title { fill: var(--_text); }
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
