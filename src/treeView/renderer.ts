import type { PositionedTreeView, PositionedTreeRow } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// TreeView SVG renderer
//
// Renders a positioned treeView to a self-contained SVG string. All colors use
// the theme's CSS custom properties — no hardcoded values. Each node is
// addressable as `<g class="node" data-id="<path>">` (the identity contract),
// keyed by its hierarchical path so two files named `index.ts` in different
// folders don't collide. Parent→child connectors carry `data-from`/`data-to`.
//
// Render order (back to front):
//   1. Connectors (elbow lines from parent to child)
//   2. Nodes (glyph + label + optional description), each a data-id <g>
//   3. Title
// ============================================================================

const FONT = {
  titleSize: 16,
  titleWeight: 600,
  labelSize: 14,
  folderWeight: 600,
  fileWeight: 400,
  descSize: 13,
} as const

const GLYPH = 16

/**
 * Render a positioned treeView as an SVG string.
 */
export function renderTreeViewSvg(
  positioned: PositionedTreeView,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  // 1. Connectors (behind the nodes)
  for (const c of positioned.connectors) {
    parts.push(
      `<path class="tv-connector" data-from="${escapeAttr(c.from)}" data-to="${escapeAttr(c.to)}" d="${c.d}"/>`,
    )
  }

  // 2. Nodes — each addressable as <g class="node" data-id="<path>">
  for (const row of positioned.rows) {
    parts.push(renderRow(row))
  }

  // 3. Title
  if (positioned.title) {
    parts.push(
      `<text x="${rr(positioned.title.x)}" y="${rr(positioned.title.y)}" text-anchor="start" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tv-title">${escapeXml(positioned.title.text)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Row rendering
// ============================================================================

function renderRow(row: PositionedTreeRow): string {
  const glyph = row.isFolder ? folderGlyph(row.glyphX, row.glyphY) : fileGlyph(row.glyphX, row.glyphY)

  const labelWeight = row.isFolder ? FONT.folderWeight : FONT.fileWeight
  const labelClass = row.isFolder ? 'tv-label tv-folder-label' : 'tv-label'
  const label =
    `<text x="${rr(row.textX)}" y="${rr(row.rowCenterY)}" text-anchor="start" ` +
    `font-size="${FONT.labelSize}" font-weight="${labelWeight}" ` +
    `dy="${TEXT_BASELINE_SHIFT}" class="${labelClass}">${escapeXml(row.label)}</text>`

  const desc = row.description
    ? `<text x="${rr(row.descX)}" y="${rr(row.rowCenterY)}" text-anchor="start" ` +
      `font-size="${FONT.descSize}" font-weight="400" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="tv-desc">${escapeXml(row.description)}</text>`
    : ''

  return (
    `<g class="node" data-id="${escapeAttr(row.path)}" data-folder="${row.isFolder}">` +
    glyph + label + desc +
    `</g>`
  )
}

// ============================================================================
// Glyphs — simple inline folder / file shapes drawn from scratch
// ============================================================================

/** A folder icon: body with a raised tab on the top-left, within the glyph slot. */
function folderGlyph(x: number, y: number): string {
  const d =
    `M${rr(x + 0.5)},${rr(y + 11.5)} ` +
    `L${rr(x + 0.5)},${rr(y + 3)} ` +
    `L${rr(x + 5.5)},${rr(y + 3)} ` +
    `L${rr(x + 7)},${rr(y + 4.5)} ` +
    `L${rr(x + GLYPH - 0.5)},${rr(y + 4.5)} ` +
    `L${rr(x + GLYPH - 0.5)},${rr(y + 11.5)} Z`
  return `<path class="tv-folder" d="${d}"/>`
}

/** A file/document icon with a folded top-right corner. */
function fileGlyph(x: number, y: number): string {
  const body =
    `M${rr(x + 3)},${rr(y + 1.5)} ` +
    `L${rr(x + 9.5)},${rr(y + 1.5)} ` +
    `L${rr(x + 13)},${rr(y + 5)} ` +
    `L${rr(x + 13)},${rr(y + 14.5)} ` +
    `L${rr(x + 3)},${rr(y + 14.5)} Z`
  const fold =
    `M${rr(x + 9.5)},${rr(y + 1.5)} ` +
    `L${rr(x + 9.5)},${rr(y + 5)} ` +
    `L${rr(x + 13)},${rr(y + 5)}`
  return `<path class="tv-file" d="${body}"/><path class="tv-file-fold" d="${fold}"/>`
}

// ============================================================================
// Chart-specific CSS — theme CSS vars only, no hardcoded colors
// ============================================================================

function styleBlock(): string {
  return `<style>
  .tv-connector { fill: none; stroke: var(--_line); stroke-width: 1; }
  .tv-folder { fill: var(--accent, var(--_text-sec)); stroke: none; }
  .tv-file { fill: var(--bg); stroke: var(--_text-sec); stroke-width: 1.2; stroke-linejoin: round; }
  .tv-file-fold { fill: none; stroke: var(--_text-sec); stroke-width: 1.2; stroke-linejoin: round; }
  .tv-label { fill: var(--_text); }
  .tv-folder-label { fill: var(--_text); }
  .tv-desc { fill: var(--_text-sec); font-style: italic; }
  .tv-title { fill: var(--_text); }
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
