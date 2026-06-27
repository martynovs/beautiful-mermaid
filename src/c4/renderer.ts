import type { PositionedC4Diagram, PositionedC4Element, PositionedC4Relationship, PositionedC4Boundary } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { C4_LAYOUT } from './layout.ts'
import { renderIcon } from '../icons/registry.ts'

// ============================================================================
// C4 diagram SVG renderer
//
// Renders a positioned C4 diagram to an SVG string. All colors come from the
// theme's CSS custom properties — no hardcoded colors. Persons are visually
// distinguished by an accent header bar; external elements use a dashed border.
//
// Identity contract:
//   - each element box → <g class="node" data-id="<alias>">
//   - each relationship → <path class="edge" data-from data-to>
//
// Render order (back to front):
//   1. Boundaries (dashed containers)
//   2. Relationship arrows
//   3. Element boxes
//   4. Relationship labels
// ============================================================================

const L = C4_LAYOUT

/**
 * Render a positioned C4 diagram as an SVG string.
 */
export function renderC4Svg(
  diagram: PositionedC4Diagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())
  parts.push(arrowDefs())

  // 1. Boundaries
  for (const b of diagram.boundaries) {
    parts.push(renderBoundary(b))
  }

  // 2. Relationship arrows
  for (const rel of diagram.relationships) {
    parts.push(renderEdge(rel))
  }

  // 3. Element boxes
  for (const el of diagram.elements) {
    parts.push(renderElement(el))
  }

  // 4. Relationship labels (on top, with a readability pill)
  for (const rel of diagram.relationships) {
    const label = renderEdgeLabel(rel)
    if (label) parts.push(label)
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Elements
// ============================================================================

function renderElement(el: PositionedC4Element): string {
  const parts: string[] = []
  const { x, y, width, height, kind } = el
  const isPerson = kind === 'person'
  const rx = isPerson ? 12 : 4

  parts.push(`<g class="node" data-id="${escapeAttr(el.alias)}" data-kind="${kind}">`)

  // Box
  const boxClass = `c4-box c4-${kind}${el.external ? ' c4-box-ext' : ''}`
  parts.push(
    `  <rect x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${r(height)}" ` +
    `rx="${rx}" ry="${rx}" class="${boxClass}"/>`,
  )

  // Person accent bar across the top
  if (isPerson) {
    parts.push(
      `  <rect x="${r(x)}" y="${r(y)}" width="${r(width)}" height="${L.personBar}" ` +
      `rx="${rx}" ry="${rx}" class="c4-accent"/>`,
    )
    // Square off the lower edge of the rounded bar so it reads as a strip.
    parts.push(
      `  <rect x="${r(x)}" y="${r(y + L.personBar / 2)}" width="${r(width)}" height="${L.personBar / 2}" class="c4-accent"/>`,
    )
  }

  const cx = x + width / 2

  // Icon strip near the top, above the kind tag / label.
  const iconX = cx - L.iconSize / 2
  const iconY = y + L.topPad
  parts.push('  ' + renderElementIcon(el, iconX, iconY))

  let ty = y + L.topPad + L.iconSize + L.iconGap

  // Kind tag
  parts.push(text(cx, ty + L.tagH / 2, el.tag, L.tagFont, L.tagWeight, isPerson ? 'c4-tag-person' : 'c4-tag'))
  ty += L.tagH

  // Label
  parts.push(text(cx, ty + L.labelH / 2, el.label, L.labelFont, L.labelWeight, 'c4-label'))
  ty += L.labelH

  // Technology
  if (el.techn) {
    parts.push(text(cx, ty + L.technH / 2, el.techn, L.technFont, L.technWeight, 'c4-techn', 'italic'))
    ty += L.technH
  }

  // Description
  for (const line of el.descr) {
    parts.push(text(cx, ty + L.descrH / 2, line, L.descrFont, L.descrWeight, 'c4-descr'))
    ty += L.descrH
  }

  parts.push('</g>')
  return parts.join('\n')
}

/**
 * Pick and render the glyph for an element, drawn in an `iconSize` box at
 * `(x, y)`. Persons get a hand-drawn inline glyph (the shared registry has no
 * person icon); every other kind maps to a registry glyph. All glyphs inherit
 * theme color via the `c4-icon` class (`color: var(--_text)`).
 */
function renderElementIcon(el: PositionedC4Element, x: number, y: number): string {
  if (el.kind === 'person') return personIcon(x, y, L.iconSize)

  let name: string
  if (el.variant === 'db') name = 'database'
  else if (el.variant === 'queue') name = 'queue'
  else name = 'server'

  return renderIcon(name, { x, y, size: L.iconSize, className: 'c4-icon' })
}

/**
 * Inline PERSON glyph (head circle + shoulders arc) on the same 24×24 grid the
 * registry uses, so it aligns with registry icons. Uses `currentColor` and the
 * `c4-icon` class for theme coloring — no hardcoded colors.
 */
function personIcon(x: number, y: number, size: number): string {
  const scale = Math.round((size / 24) * 1000) / 1000
  return (
    `<g class="c4-icon" fill="currentColor" transform="translate(${r(x)} ${r(y)}) scale(${scale})">` +
    `<circle cx="12" cy="7" r="4"/>` +
    `<path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round"/>` +
    `</g>`
  )
}

// ============================================================================
// Boundaries
// ============================================================================

function renderBoundary(b: PositionedC4Boundary): string {
  return (
    `<g class="c4-boundary-group" data-boundary="${escapeAttr(b.alias)}">` +
    `<rect x="${r(b.x)}" y="${r(b.y)}" width="${r(b.width)}" height="${r(b.height)}" ` +
    `rx="6" ry="6" class="c4-boundary"/>` +
    `<text x="${r(b.x + 12)}" y="${r(b.y + L.boundaryLabelH / 2)}" text-anchor="start" ` +
    `dy="${TEXT_BASELINE_SHIFT}" font-size="${L.tagFont + 1}" font-weight="${L.tagWeight}" ` +
    `class="c4-boundary-label">${escapeXml(b.label)}</text>` +
    `</g>`
  )
}

// ============================================================================
// Relationships
// ============================================================================

function renderEdge(rel: PositionedC4Relationship): string {
  const markerEnd = ` marker-end="url(#c4-arrow)"`
  const markerStart = rel.bidirectional ? ` marker-start="url(#c4-arrow)"` : ''
  return (
    `<path class="c4-edge" data-from="${escapeAttr(rel.from)}" data-to="${escapeAttr(rel.to)}" ` +
    `d="M${r(rel.x1)},${r(rel.y1)} L${r(rel.x2)},${r(rel.y2)}"${markerStart}${markerEnd}/>`
  )
}

function renderEdgeLabel(rel: PositionedC4Relationship): string {
  const lines: string[] = []
  if (rel.label) lines.push(rel.label)
  if (rel.techn) lines.push(`[${rel.techn}]`)
  if (lines.length === 0) return ''

  const fontSize = L.descrFont
  const lineH = 14
  const totalH = lines.length * lineH + 6
  const maxW = Math.max(...lines.map(l => l.length)) * fontSize * 0.6 + 12
  const top = rel.labelY - totalH / 2

  const parts: string[] = []
  parts.push(
    `<rect x="${r(rel.labelX - maxW / 2)}" y="${r(top)}" width="${r(maxW)}" height="${r(totalH)}" ` +
    `rx="3" ry="3" class="c4-edge-label-bg"/>`,
  )
  lines.forEach((line, i) => {
    const ly = top + 3 + i * lineH + lineH / 2
    const cls = i === 0 ? 'c4-edge-label' : 'c4-edge-techn'
    parts.push(text(rel.labelX, ly, line, fontSize, i === 0 ? 500 : 400, cls))
  })
  return parts.join('\n')
}

// ============================================================================
// Shared markup
// ============================================================================

function text(
  x: number,
  y: number,
  content: string,
  fontSize: number,
  weight: number,
  cls: string,
  fontStyle?: string,
): string {
  const style = fontStyle ? ` font-style="${fontStyle}"` : ''
  return (
    `  <text x="${r(x)}" y="${r(y)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${fontSize}" font-weight="${weight}"${style} class="${cls}">${escapeXml(content)}</text>`
  )
}

function arrowDefs(): string {
  return (
    `<defs>` +
    `<marker id="c4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" class="c4-arrow-head"/>` +
    `</marker>` +
    `</defs>`
  )
}

function styleBlock(): string {
  return `<style>
  .c4-box { fill: var(--_node-fill, var(--bg)); stroke: var(--_node-stroke); stroke-width: 1; }
  .c4-box-ext { stroke-dasharray: 5 3; }
  .c4-icon { color: var(--_text); }
  .c4-accent { fill: var(--accent, var(--_arrow)); }
  .c4-tag { fill: var(--_text-sec); }
  .c4-tag-person { fill: var(--accent, var(--_arrow)); }
  .c4-label { fill: var(--_text); }
  .c4-techn { fill: var(--_text-muted); }
  .c4-descr { fill: var(--_text-sec); }
  .c4-edge { fill: none; stroke: var(--_line); stroke-width: 1; }
  .c4-arrow-head { fill: var(--_arrow); }
  .c4-edge-label { fill: var(--_text); }
  .c4-edge-techn { fill: var(--_text-muted); }
  .c4-edge-label-bg { fill: var(--bg); stroke: var(--_inner-stroke); stroke-width: 0.5; }
  .c4-boundary { fill: none; stroke: var(--_node-stroke); stroke-dasharray: 4 4; }
  .c4-boundary-label { fill: var(--_text-sec); }
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
