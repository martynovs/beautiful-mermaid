import type { PositionedMindmap, PositionedMindmapNode } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Mindmap SVG renderer
//
// Renders a positioned mindmap to an SVG string. All colors come from the
// theme's CSS custom properties (var(--_text), var(--_line), var(--bg),
// var(--accent), var(--_node-fill), var(--_text-sec)) — NO hardcoded colors.
//
// Each node is addressable as `<g class="node" data-id="...">` and every
// parent→child connector carries data-from / data-to (the identity contract).
//
// Render order (back to front):
//   1. Connector lines (behind the boxes)
//   2. Node shapes + labels
// ============================================================================

const FONT = {
  labelSize: 14,
  labelWeight: 500,
} as const

/**
 * Render a positioned mindmap as an SVG string.
 */
export function renderMindmapSvg(
  positioned: PositionedMindmap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  // 1. Connectors (drawn first so node boxes sit on top)
  for (const c of positioned.connectors) {
    const d = connectorPath(c.x1, c.y1, c.x2, c.y2)
    parts.push(
      `<path class="mm-connector" data-from="${escapeAttr(c.from)}" data-to="${escapeAttr(c.to)}" ` +
      `d="${d}"/>`,
    )
  }

  // 2. Nodes — each addressable as <g class="node" data-id="...">
  for (const n of positioned.nodes) {
    parts.push(renderNode(n))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ----------------------------------------------------------------------------
// Node rendering
// ----------------------------------------------------------------------------

function renderNode(n: PositionedMindmapNode): string {
  const isRoot = n.depth === 0
  const shape = shapeMarkup(n, isRoot)
  const cx = n.x + n.width / 2
  const cy = n.y + n.height / 2
  const textClass = isRoot ? 'mm-label mm-label-root' : 'mm-label'

  const label =
    `<text x="${rr(cx)}" y="${rr(cy)}" text-anchor="middle" ` +
    `font-size="${FONT.labelSize}" font-weight="${FONT.labelWeight}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" class="${textClass}">${escapeXml(n.label)}</text>`

  return (
    `<g class="node" data-id="${escapeAttr(n.id)}" data-shape="${n.shape}">` +
    shape + label +
    `</g>`
  )
}

/** Build the shape element for a node, varying by its shape metadata. */
function shapeMarkup(n: PositionedMindmapNode, isRoot: boolean): string {
  const cls = `mm-shape${isRoot ? ' mm-shape-root' : ''}`
  const { x, y, width: w, height: h } = n
  const cx = x + w / 2
  const cy = y + h / 2

  switch (n.shape) {
    case 'circle':
    case 'bang': {
      const extra = n.shape === 'bang' ? ' mm-bang' : ''
      return `<ellipse cx="${rr(cx)}" cy="${rr(cy)}" rx="${rr(w / 2)}" ry="${rr(h / 2)}" class="${cls}${extra}"/>`
    }
    case 'hexagon': {
      const inset = Math.min(h / 2, w / 3)
      const pts = [
        `${rr(x + inset)},${rr(y)}`,
        `${rr(x + w - inset)},${rr(y)}`,
        `${rr(x + w)},${rr(cy)}`,
        `${rr(x + w - inset)},${rr(y + h)}`,
        `${rr(x + inset)},${rr(y + h)}`,
        `${rr(x)},${rr(cy)}`,
      ].join(' ')
      return `<polygon points="${pts}" class="${cls}"/>`
    }
    case 'cloud':
      // Pill — fully rounded ends.
      return `<rect x="${rr(x)}" y="${rr(y)}" width="${rr(w)}" height="${rr(h)}" rx="${rr(h / 2)}" class="${cls}"/>`
    case 'round':
      return `<rect x="${rr(x)}" y="${rr(y)}" width="${rr(w)}" height="${rr(h)}" rx="12" class="${cls}"/>`
    case 'square':
      return `<rect x="${rr(x)}" y="${rr(y)}" width="${rr(w)}" height="${rr(h)}" rx="2" class="${cls}"/>`
    case 'default':
    default:
      return `<rect x="${rr(x)}" y="${rr(y)}" width="${rr(w)}" height="${rr(h)}" rx="8" class="${cls}"/>`
  }
}

/** Smooth cubic connector from a parent's right edge to a child's left edge. */
function connectorPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M${rr(x1)},${rr(y1)} C${rr(mx)},${rr(y1)} ${rr(mx)},${rr(y2)} ${rr(x2)},${rr(y2)}`
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(): string {
  return `<style>
  .mm-connector { fill: none; stroke: var(--_line); stroke-width: 1.5; }
  .mm-shape { fill: var(--_node-fill, var(--bg)); stroke: var(--_node-stroke); stroke-width: 1.5; }
  .mm-shape-root { fill: var(--accent, var(--_arrow)); stroke: var(--accent, var(--_arrow)); }
  .mm-bang { stroke: var(--accent, var(--_arrow)); stroke-width: 2; }
  .mm-label { fill: var(--_text); }
  .mm-label-root { fill: var(--bg); }
</style>`
}

// ============================================================================
// Helpers
// ============================================================================

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
