import type { PositionedTreemap, PositionedCell } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Treemap SVG renderer
//
// Renders a positioned treemap to an SVG string. All colors come from the
// theme's CSS custom properties; per-branch leaf fills are derived from the
// accent (mirrors the pie/xychart palette via getSeriesColor) — NO hardcoded
// colors. Each cell (branch and leaf) is addressable as a data-id node carrying
// its value (the identity contract).
//
// Render order: cells are emitted parents-first (by depth) so containers sit
// behind their contents.
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  branchLabelSize: 12,
  branchLabelWeight: 600,
  leafLabelSize: 12,
  leafLabelWeight: 500,
  leafValueSize: 11,
  leafValueWeight: 400,
} as const

/**
 * Render a positioned treemap as an SVG string.
 */
export function renderTreemapSvg(
  positioned: PositionedTreemap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Per-branch leaf fill rules, keyed by top-level color bucket.
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const colorIndexes = [...new Set(positioned.cells.filter(c => c.isLeaf).map(c => c.colorIndex))]
    .filter(i => i >= 0)
    .sort((a, b) => a - b)
  const colorRules = colorIndexes
    .map(i => {
      const fill = i === 0
        ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
        : getSeriesColor(i, accent, colors.bg)
      return `  .tm-color-${i} { fill: ${fill}; }`
    })
    .join('\n')
  parts.push(styleBlock(colorRules))

  // Cells, parents before children (already ordered by layout).
  for (const cell of positioned.cells) {
    parts.push(renderCell(cell))
  }

  // Title
  if (positioned.title) {
    parts.push(
      `<text x="${rr(positioned.title.x)}" y="${rr(positioned.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tm-title">${escapeXml(positioned.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ----------------------------------------------------------------------------
// Cell rendering
// ----------------------------------------------------------------------------

function renderCell(cell: PositionedCell): string {
  const rectClass = cell.isLeaf ? `tm-cell tm-leaf tm-color-${cell.colorIndex}` : 'tm-cell tm-branch'
  const rect =
    `<rect x="${rr(cell.x)}" y="${rr(cell.y)}" width="${rr(cell.width)}" height="${rr(cell.height)}" ` +
    `rx="2" class="${rectClass}"/>`

  const label = cell.isLeaf ? leafLabel(cell) : branchLabel(cell)

  return (
    `<g class="node" data-id="${escapeAttr(cell.path)}" data-value="${cell.value}">` +
    rect + label +
    `</g>`
  )
}

/** Branch label sits in the top-left header strip, if it fits. */
function branchLabel(cell: PositionedCell): string {
  if (cell.height < 16 || cell.width < 24 || !cell.label) return ''
  const pad = 6
  const maxW = cell.width - pad * 2
  if (estimateTextWidth(cell.label, FONT.branchLabelSize, FONT.branchLabelWeight) > maxW) {
    // Too wide — only render if there is at least some room; otherwise skip.
    if (maxW < FONT.branchLabelSize) return ''
  }
  return (
    `<text x="${rr(cell.x + pad)}" y="${rr(cell.y + 10)}" text-anchor="start" ` +
    `font-size="${FONT.branchLabelSize}" font-weight="${FONT.branchLabelWeight}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" class="tm-branch-label">${escapeXml(cell.label)}</text>`
  )
}

/** Leaf label (+ value) centered, shown only when the cell is large enough. */
function leafLabel(cell: PositionedCell): string {
  if (cell.width < 28 || cell.height < 18 || !cell.label) return ''
  const cx = cell.x + cell.width / 2
  const cy = cell.y + cell.height / 2
  const fits = estimateTextWidth(cell.label, FONT.leafLabelSize, FONT.leafLabelWeight) <= cell.width - 8

  // When there is vertical room, stack label over value.
  const showValue = cell.height >= 34
  const labelY = showValue ? cy - 7 : cy
  const text = fits ? escapeXml(cell.label) : ''
  if (!text) return ''

  let out =
    `<text x="${rr(cx)}" y="${rr(labelY)}" text-anchor="middle" ` +
    `font-size="${FONT.leafLabelSize}" font-weight="${FONT.leafLabelWeight}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" class="tm-leaf-label">${text}</text>`

  if (showValue) {
    out +=
      `<text x="${rr(cx)}" y="${rr(cy + 9)}" text-anchor="middle" ` +
      `font-size="${FONT.leafValueSize}" font-weight="${FONT.leafValueWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tm-leaf-value">${escapeXml(formatVal(cell.value))}</text>`
  }
  return out
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .tm-cell { stroke: var(--bg); stroke-width: 2; }
  .tm-branch { fill: var(--_group-hdr); stroke: var(--_line); stroke-width: 1; }
  .tm-branch-label { fill: var(--_text-sec); }
  .tm-leaf-label { fill: var(--bg); }
  .tm-leaf-value { fill: var(--bg); opacity: 0.85; }
  .tm-title { fill: var(--_text); }
${colorRules}
</style>`
}

// ============================================================================
// Helpers
// ============================================================================

function formatVal(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

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
