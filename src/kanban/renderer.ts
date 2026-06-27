import type {
  PositionedKanban, PositionedKanbanColumn, PositionedKanbanCard,
} from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'

// ============================================================================
// Kanban SVG renderer
//
// Renders a positioned kanban board to an SVG string. All colors reference the
// theme's derived CSS custom properties — no hardcoded palette.
//
// Identity contract:
//   - Each column: <g class="kanban-column" data-id="...">
//   - Each card:   <g class="node" data-id="...">  (the addressable element)
//
// Render order: title, then per column [container, header, cards].
// ============================================================================

const FONT = {
  titleSize: 18,
  titleWeight: 600,
  headerSize: 14,
  headerWeight: 600,
  cardSize: 13,
  cardWeight: 500,
  metaSize: 11,
  metaWeight: 400,
} as const

const CARD = {
  padX: 12,
  padY: 10,
  lineHeight: 18,
  metaGap: 4,
  metaLineHeight: 16,
  radius: 6,
} as const

/**
 * Render a positioned kanban board as an SVG string.
 */
export function renderKanbanSvg(
  board: PositionedKanban,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(board.width, board.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(styleBlock())

  // Title
  if (board.title) {
    parts.push(
      `<text x="${r(board.title.x)}" y="${r(board.title.y)}" text-anchor="middle" ` +
      `font-size="${FONT.titleSize}" font-weight="${FONT.titleWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="kanban-title">${escapeXml(board.title.text)}</text>`,
    )
  }

  for (const column of board.columns) {
    parts.push(renderColumn(column))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ----------------------------------------------------------------------------
// Column rendering
// ----------------------------------------------------------------------------

function renderColumn(col: PositionedKanbanColumn): string {
  const headerCx = col.x + col.width / 2
  const headerCy = col.y + col.headerHeight / 2

  const container =
    `<rect x="${r(col.x)}" y="${r(col.y)}" width="${r(col.width)}" height="${r(col.height)}" ` +
    `rx="8" ry="8" class="kanban-col-box"/>`

  // Header band — rounded only at the top via a path so it hugs the container.
  const header =
    `<rect x="${r(col.x)}" y="${r(col.y)}" width="${r(col.width)}" height="${r(col.headerHeight)}" ` +
    `rx="8" ry="8" class="kanban-col-header"/>`

  const headerText =
    `<text x="${r(headerCx)}" y="${r(headerCy)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${FONT.headerSize}" font-weight="${FONT.headerWeight}" class="kanban-header-text">` +
    `${escapeXml(col.title)}</text>`

  const cards = col.cards.map(renderCard).join('\n')

  return (
    `<g class="kanban-column" data-id="${escapeAttr(col.id)}">\n` +
    `  ${container}\n` +
    `  ${header}\n` +
    `  ${headerText}\n` +
    `${cards}\n` +
    `</g>`
  )
}

// ----------------------------------------------------------------------------
// Card rendering — the addressable identity element
// ----------------------------------------------------------------------------

function renderCard(card: PositionedKanbanCard): string {
  const rect =
    `<rect x="${r(card.x)}" y="${r(card.y)}" width="${r(card.width)}" height="${r(card.height)}" ` +
    `rx="${CARD.radius}" ry="${CARD.radius}" class="kanban-card-box"/>`

  const textX = card.x + CARD.padX
  let baseline = card.y + CARD.padY + CARD.lineHeight / 2

  const lines = card.textLines
    .map(line => {
      const t =
        `<text x="${r(textX)}" y="${r(baseline)}" text-anchor="start" dy="${TEXT_BASELINE_SHIFT}" ` +
        `font-size="${FONT.cardSize}" font-weight="${FONT.cardWeight}" class="kanban-card-text">` +
        `${escapeXml(line)}</text>`
      baseline += CARD.lineHeight
      return t
    })
    .join('\n')

  let meta = ''
  if (card.metaLine) {
    const metaY = baseline - CARD.lineHeight + CARD.metaGap + CARD.metaLineHeight / 2
    meta =
      `<text x="${r(textX)}" y="${r(metaY)}" text-anchor="start" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${FONT.metaSize}" font-weight="${FONT.metaWeight}" class="kanban-meta-text">` +
      `${escapeXml(card.metaLine)}</text>`
  }

  return (
    `  <g class="node" data-id="${escapeAttr(card.id)}">\n` +
    `    ${rect}\n` +
    (lines ? `    ${lines}\n` : '') +
    (meta ? `    ${meta}\n` : '') +
    `  </g>`
  )
}

// ----------------------------------------------------------------------------
// Chart-specific CSS
// ----------------------------------------------------------------------------

function styleBlock(): string {
  return `<style>
  .kanban-title { fill: var(--_text); }
  .kanban-col-box { fill: var(--_group-fill, var(--bg)); stroke: var(--_inner-stroke); stroke-width: 1; }
  .kanban-col-header { fill: var(--_group-hdr, var(--_inner-stroke)); stroke: none; }
  .kanban-header-text { fill: var(--_text); }
  .kanban-card-box { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 1; }
  .kanban-card-text { fill: var(--_text); }
  .kanban-meta-text { fill: var(--_text-sec); }
</style>`
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

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
