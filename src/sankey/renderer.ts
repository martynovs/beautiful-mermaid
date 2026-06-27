import type { PositionedSankey } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Sankey SVG renderer
//
// Renders a positioned sankey diagram to an SVG string. All colors come from
// the theme's CSS custom properties; per-node fills are derived from the accent
// (mirrors the xychart palette). Node 0 uses the accent var directly.
//
// Identity contract:
//   - each node is wrapped in <g class="node" data-id="<name>">
//   - each flow band carries data-from / data-to / data-value
//
// Render order (back to front):
//   1. Link bands (translucent, source-colored)
//   2. Node rectangles + labels
// ============================================================================

const FONT = {
  labelSize: 14,
  labelWeight: 500,
} as const

/**
 * Render a positioned sankey diagram as an SVG string.
 */
export function renderSankeySvg(
  positioned: PositionedSankey,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Per-node color rules (also reused by the bands via the source color index).
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorIndices = new Set<number>()
  for (const node of positioned.nodes) colorIndices.add(node.colorIndex)
  const colorRules = [...colorIndices]
    .sort((a, b) => a - b)
    .map(idx => {
      const fill = idx === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(idx, accent, colors.bg)
      return `  .sankey-color-${idx} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // 1. Link bands — behind the nodes, colored by their source node.
  for (const link of positioned.links) {
    parts.push(
      `<path d="${link.path}" class="sankey-link sankey-color-${link.colorIndex}" ` +
      `data-from="${escapeAttr(link.source)}" data-to="${escapeAttr(link.target)}" ` +
      `data-value="${link.value}"/>`,
    )
  }

  // 2. Nodes — each addressable as <g class="node" data-id="...">.
  for (const node of positioned.nodes) {
    parts.push(
      `<g class="node" data-id="${escapeAttr(node.id)}">` +
      `<rect x="${rr(node.x)}" y="${rr(node.y)}" width="${rr(node.width)}" height="${rr(node.height)}" ` +
      `rx="2" class="sankey-node sankey-color-${node.colorIndex}"/>` +
      `<text x="${rr(node.labelX)}" y="${rr(node.labelY)}" text-anchor="${node.labelAnchor}" ` +
      `font-size="${FONT.labelSize}" font-weight="${FONT.labelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="sankey-label">${escapeXml(node.label)}</text>` +
      `</g>`,
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
  .sankey-node { stroke: var(--bg); stroke-width: 1; }
  .sankey-link { fill-opacity: 0.42; stroke: none; }
  .sankey-link:hover { fill-opacity: 0.65; }
  .sankey-label { fill: var(--_text); }
${colorRules}
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
