import type { PositionedZenUML, PositionedParticipant, ZenLifeline, PositionedZenMessage, PositionedZenFragment } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, ARROW_HEAD, TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'

// ============================================================================
// ZenUML SVG renderer
//
// Renders a positioned ZenUML diagram to an SVG string. All colors use the
// theme's CSS custom properties (var(--_text), var(--_line), var(--bg),
// var(--accent), var(--_text-sec), …) — no hardcoded colors.
//
// Identity contract:
//   - Each participant is wrapped in <g class="node" data-id="<id>">.
//   - Each message arrow is wrapped in <g class="message" data-from data-to>.
//
// Render order (back to front):
//   1. Lifelines (dashed vertical lines)
//   2. Control-flow fragment boxes (alt/loop/opt/…)
//   3. Messages (arrows with labels)
//   4. Participant boxes (at top, drawn last so they sit on top)
// ============================================================================

export function renderZenUMLSvg(
  diagram: PositionedZenUML,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  parts.push('</defs>')

  // 1. Lifelines
  for (const lifeline of diagram.lifelines) {
    parts.push(renderLifeline(lifeline))
  }

  // 2. Control-flow fragment boxes (behind the messages they wrap)
  for (const fragment of diagram.fragments) {
    parts.push(renderFragment(fragment))
  }

  // 3. Messages
  for (const message of diagram.messages) {
    parts.push(renderMessage(message))
  }

  // 4. Participant boxes (on top)
  for (const participant of diagram.participants) {
    parts.push(renderParticipant(participant))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Arrow markers
// ============================================================================

function arrowMarkerDefs(): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  return (
    `  <marker id="zen-arrow" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, ${w} ${h / 2}, 0 ${h}" fill="var(--_arrow)" />` +
    `\n  </marker>` +
    `\n  <marker id="zen-arrow-open" markerWidth="${w}" markerHeight="${h}" refX="${w}" refY="${h / 2}" orient="auto-start-reverse">` +
    `\n    <polyline points="0 0, ${w} ${h / 2}, 0 ${h}" fill="none" stroke="var(--_arrow)" stroke-width="1" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Component renderers
// ============================================================================

/**
 * Render a participant box. Wrapped in <g class="node" data-id="…"> per the
 * identity contract, with an optional «annotator» stereotype line above the label.
 */
function renderParticipant(p: PositionedParticipant): string {
  const { id, x, y, width, height, label, annotator } = p
  const boxX = x - width / 2
  const parts: string[] = []

  parts.push(
    `<g class="node" data-id="${escapeAttr(id)}" data-label="${escapeAttr(label)}"` +
    (annotator ? ` data-annotator="${escapeAttr(annotator)}"` : '') +
    `>`,
  )

  parts.push(
    `  <rect x="${r(boxX)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" rx="4" ry="4" ` +
    `fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )

  if (annotator) {
    parts.push(
      `  <text x="${r(x)}" y="${r(y + height / 2 - 7)}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" fill="var(--_text-sec)">${escapeXml(`«${annotator}»`)}</text>`,
    )
    parts.push(
      `  <text x="${r(x)}" y="${r(y + height / 2 + 7)}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" fill="var(--_text)">${escapeXml(label)}</text>`,
    )
  } else {
    parts.push(
      `  <text x="${r(x)}" y="${r(y + height / 2)}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" fill="var(--_text)">${escapeXml(label)}</text>`,
    )
  }

  parts.push('</g>')
  return parts.join('\n')
}

/** Render a lifeline (dashed vertical line from participant to bottom). */
function renderLifeline(lifeline: ZenLifeline): string {
  return (
    `<line class="lifeline" data-participant="${escapeAttr(lifeline.participantId)}" ` +
    `x1="${r(lifeline.x)}" y1="${r(lifeline.topY)}" x2="${r(lifeline.x)}" y2="${r(lifeline.bottomY)}" ` +
    `stroke="var(--_line)" stroke-width="0.75" stroke-dasharray="6 4" />`
  )
}

/**
 * Render a message arrow with label. Wrapped in <g class="message"> carrying
 * data-from / data-to participant ids per the identity contract.
 */
function renderMessage(msg: PositionedZenMessage): string {
  const parts: string[] = []
  const dashArray = msg.lineStyle === 'dashed' ? ' stroke-dasharray="6 4"' : ''
  const markerId = msg.arrowHead === 'filled' ? 'zen-arrow' : 'zen-arrow-open'
  const labelFill = msg.kind === 'return' ? 'var(--_text-sec)' : 'var(--_text-muted)'

  parts.push(
    `<g class="message" data-from="${escapeAttr(msg.from)}" data-to="${escapeAttr(msg.to)}" ` +
    `data-label="${escapeAttr(msg.label)}" data-kind="${msg.kind}" ` +
    `data-line-style="${msg.lineStyle}" data-self="${msg.isSelf}">`,
  )

  if (msg.isSelf) {
    const loopW = 30
    const loopH = 20
    const labelPadding = 8
    parts.push(
      `  <polyline points="${r(msg.x1)},${r(msg.y)} ${r(msg.x1 + loopW)},${r(msg.y)} ${r(msg.x1 + loopW)},${r(msg.y + loopH)} ${r(msg.x2)},${r(msg.y + loopH)}" ` +
      `fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerId})" />`,
    )
    parts.push(
      `  <text x="${r(msg.x1 + loopW + labelPadding)}" y="${r(msg.y + loopH / 2)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" fill="${labelFill}">${escapeXml(msg.label)}</text>`,
    )
  } else {
    parts.push(
      `  <line x1="${r(msg.x1)}" y1="${r(msg.y)}" x2="${r(msg.x2)}" y2="${r(msg.y)}" ` +
      `stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}"${dashArray} marker-end="url(#${markerId})" />`,
    )
    const midX = (msg.x1 + msg.x2) / 2
    if (msg.label) {
      parts.push(
        `  <text x="${r(midX)}" y="${r(msg.y - 8)}" text-anchor="middle" ` +
        `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" fill="${labelFill}">${escapeXml(msg.label)}</text>`,
      )
    }
  }

  parts.push('</g>')
  return parts.join('\n')
}

/**
 * Render a control-flow fragment box (alt/opt/loop/par/try/…). Mirrors the
 * sequence-diagram frame style: a bordered rectangle spanning the involved
 * lifelines, a label tab in the top-left, and dashed section dividers.
 * Wrapped in <g class="fragment"> with data-type / data-label.
 */
function renderFragment(f: PositionedZenFragment): string {
  const parts: string[] = []
  const labelAttr = f.label ? ` data-label="${escapeAttr(f.label)}"` : ''
  parts.push(
    `<g class="fragment" data-type="${escapeAttr(f.type)}"${labelAttr} data-depth="${f.depth}">`,
  )

  // Outer rectangle.
  parts.push(
    `  <rect x="${r(f.x)}" y="${r(f.y)}" width="${r(f.width)}" height="${r(f.height)}" ` +
    `rx="0" ry="0" fill="none" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )

  // Label tab (top-left): fragment type + optional [condition].
  const labelText = `${f.type}${f.label ? ` [${f.label}]` : ''}`
  const tabWidth = estimateTextWidth(labelText, FONT_SIZES.edgeLabel, FONT_WEIGHTS.groupHeader) + 16
  const tabHeight = 18
  parts.push(
    `  <rect x="${r(f.x)}" y="${r(f.y)}" width="${r(tabWidth)}" height="${tabHeight}" ` +
    `fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )
  parts.push(
    `  <text x="${r(f.x + 6)}" y="${r(f.y + tabHeight / 2)}" text-anchor="start" ` +
    `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.groupHeader}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" fill="var(--_text-sec)">${escapeXml(labelText)}</text>`,
  )

  // Section dividers (else / catch / finally / and).
  for (const divider of f.dividers) {
    parts.push(
      `  <line x1="${r(f.x)}" y1="${r(divider.y)}" x2="${r(f.x + f.width)}" y2="${r(divider.y)}" ` +
      `stroke="var(--_line)" stroke-width="0.75" stroke-dasharray="6 4" />`,
    )
    const divLabel = `${divider.keyword}${divider.label ? ` [${divider.label}]` : ''}`
    parts.push(
      `  <text x="${r(f.x + 8)}" y="${r(divider.y + 13)}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" fill="var(--_text-muted)">${escapeXml(divLabel)}</text>`,
    )
  }

  parts.push('</g>')
  return parts.join('\n')
}

// ============================================================================
// Utilities
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

function escapeAttr(value: string): string {
  return escapeXml(value).replace(/'/g, '&#39;')
}
