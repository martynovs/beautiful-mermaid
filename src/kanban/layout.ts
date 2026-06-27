import type {
  Kanban, KanbanCard,
  PositionedKanban, PositionedKanbanColumn, PositionedKanbanCard,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Kanban layout engine
//
// Self-contained column layout (no ELK): columns are placed side by side,
// each a header band over a vertical stack of card rectangles. Card text is
// word-wrapped to the column's inner width and an optional metadata line is
// appended. All columns share the tallest column's height so their containers
// align; cards are stacked from the top of each column.
// ============================================================================

const K = {
  padding: 24,
  titleHeight: 36,
  titleFontSize: 18,
  titleFontWeight: 600,

  columnGap: 18,
  colPad: 10,          // gap between column border and its cards
  headerHeight: 38,
  headerFontSize: 14,
  headerFontWeight: 600,

  cardGap: 10,
  cardPadX: 12,
  cardPadY: 10,
  cardFontSize: 13,
  cardFontWeight: 500,
  cardLineHeight: 18,
  metaFontSize: 11,
  metaFontWeight: 400,
  metaLineHeight: 16,
  metaGap: 4,

  minColWidth: 170,
  maxColWidth: 260,
} as const

/**
 * Lay out a parsed kanban board by computing pixel geometry.
 */
export function layoutKanban(kanban: Kanban, options: RenderOptions = {}): PositionedKanban {
  const padding = options.padding ?? K.padding
  const hasTitle = !!kanban.title
  const top = padding + (hasTitle ? K.titleHeight : 0)

  // -- Uniform column width: fit the widest header and card text (clamped) --
  let desired: number = K.minColWidth
  for (const col of kanban.columns) {
    const headerW = estimateTextWidth(col.title, K.headerFontSize, K.headerFontWeight) + K.colPad * 2 + 8
    desired = Math.max(desired, headerW)
    for (const card of col.cards) {
      const cardW = estimateTextWidth(card.text, K.cardFontSize, K.cardFontWeight)
        + K.colPad * 2 + K.cardPadX * 2
      // Only widen up to the max — longer text wraps instead.
      desired = Math.max(desired, Math.min(cardW, K.maxColWidth))
    }
  }
  const columnWidth = Math.min(Math.max(Math.ceil(desired), K.minColWidth), K.maxColWidth)
  const cardWidth = columnWidth - K.colPad * 2
  const cardTextWidth = cardWidth - K.cardPadX * 2

  // -- First pass: build cards per column + measure each column's natural height --
  const colCards: PositionedKanbanCard[][] = []
  const colHeights: number[] = []

  for (const col of kanban.columns) {
    const cards: PositionedKanbanCard[] = []
    let y = top + K.headerHeight + K.cardGap

    for (const card of col.cards) {
      const textLines = wrapText(card.text, cardTextWidth, K.cardFontSize, K.cardFontWeight)
      const metaLine = formatMeta(card)
      const textH = textLines.length * K.cardLineHeight
      const metaH = metaLine ? K.metaGap + K.metaLineHeight : 0
      const height = K.cardPadY * 2 + textH + metaH

      cards.push({
        id: card.id,
        textLines,
        metaLine,
        x: 0, // filled in second pass
        y,
        width: cardWidth,
        height,
      })
      y += height + K.cardGap
    }

    colCards.push(cards)
    // Column natural height: header + topPad + cards/gaps + bottomPad
    // (or just header when empty). After the loop `y` already sits one
    // `cardGap` below the last card, giving an even bottom inset that
    // matches the top inset and the gaps between cards.
    const contentBottom = col.cards.length > 0 ? y : top + K.headerHeight
    colHeights.push(contentBottom - top)
  }

  const columnHeight = Math.max(K.headerHeight + K.cardGap, ...colHeights, 0)

  // -- Second pass: place columns left to right, set card x --
  const columns: PositionedKanbanColumn[] = kanban.columns.map((col, i) => {
    const x = padding + i * (columnWidth + K.columnGap)
    const cards = colCards[i]!.map(c => ({ ...c, x: x + K.colPad }))
    return {
      id: col.id,
      title: col.title,
      x,
      y: top,
      width: columnWidth,
      height: columnHeight,
      headerHeight: K.headerHeight,
      cards,
    }
  })

  const cols = Math.max(kanban.columns.length, 1)
  const width = padding * 2 + cols * columnWidth + (cols - 1) * K.columnGap
  const height = top + columnHeight + padding

  return {
    width,
    height,
    title: hasTitle
      ? { text: kanban.title!, x: width / 2, y: padding + K.titleFontSize }
      : undefined,
    columns,
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Greedy word-wrap to a pixel width. Long single words are kept un-broken. */
function wrapText(text: string, maxWidth: number, fontSize: number, weight: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (estimateTextWidth(candidate, fontSize, weight) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Build a compact metadata line from known keys, or undefined when empty. */
function formatMeta(card: KanbanCard): string | undefined {
  const m = card.metadata
  if (!m) return undefined
  const parts = [m.assigned, m.ticket, m.priority].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export const KANBAN_LAYOUT = K
