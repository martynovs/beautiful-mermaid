import type {
  Timeline,
  PositionedTimeline,
  PositionedSection,
  PositionedPeriod,
  PositionedEvent,
} from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Timeline layout engine
//
// Computes pixel geometry for a left→right timeline. No ELK needed — periods
// map onto evenly spaced columns, and events stack vertically under each.
//
//   row 1 (optional): section header bands spanning their periods' columns
//   row 2: period labels + markers on a horizontal spine (the axis)
//   row 3+: event cards, stacked top→bottom under each period
//
// Every event gets a deterministic, collision-free id derived from its text,
// so each event is individually addressable (the identity contract).
// ============================================================================

const T = {
  padding: 24,
  titleHeight: 44,
  titleFontSize: 20,
  sectionHeaderHeight: 34,
  sectionHeaderGap: 14,
  colWidth: 180,
  colGap: 18,
  periodLabelHeight: 36,
  axisGap: 22,
  eventGapY: 12,
  eventHeight: 40,
  markerRadius: 6,
} as const

/**
 * Lay out a parsed timeline by computing pixel geometry.
 */
export function layoutTimeline(timeline: Timeline, _options: RenderOptions = {}): PositionedTimeline {
  const hasTitle = !!timeline.title
  const hasSectionBands = timeline.sections.some(s => !!s.name)

  const top = T.padding + (hasTitle ? T.titleHeight : 0)
  const bandY = top
  const periodLabelY = top + (hasSectionBands ? T.sectionHeaderHeight + T.sectionHeaderGap : 0)
  const axisY = periodLabelY + T.periodLabelHeight
  const eventsTop = axisY + T.axisGap

  const colLeft = (i: number) => T.padding + i * (T.colWidth + T.colGap)
  const colCenter = (i: number) => colLeft(i) + T.colWidth / 2

  const sections: PositionedSection[] = []
  const periods: PositionedPeriod[] = []
  const events: PositionedEvent[] = []
  const usedIds = new Map<string, number>()

  let col = 0
  let maxEventsBottom = eventsTop

  timeline.sections.forEach((section, si) => {
    if (section.periods.length === 0) return
    const firstCol = col

    section.periods.forEach(period => {
      const cx = colCenter(col)

      periods.push({
        label: period.label,
        markerX: cx,
        markerY: axisY,
        labelX: cx,
        labelY: periodLabelY + T.periodLabelHeight / 2,
        colorIndex: si,
      })

      period.events.forEach((text, j) => {
        const y = eventsTop + j * (T.eventHeight + T.eventGapY)
        const bottom = y + T.eventHeight
        if (bottom > maxEventsBottom) maxEventsBottom = bottom
        events.push({
          id: uniqueId(text, usedIds),
          text,
          x: colLeft(col),
          y,
          width: T.colWidth,
          height: T.eventHeight,
          labelX: cx,
          labelY: y + T.eventHeight / 2,
          colorIndex: si,
        })
      })

      col += 1
    })

    if (hasSectionBands && section.name) {
      const lastCol = col - 1
      const x = colLeft(firstCol)
      const width = colLeft(lastCol) + T.colWidth - x
      sections.push({
        name: section.name,
        x,
        y: bandY,
        width,
        height: T.sectionHeaderHeight,
        labelX: x + width / 2,
        labelY: bandY + T.sectionHeaderHeight / 2,
        colorIndex: si,
      })
    }
  })

  const nCols = col
  const axis = nCols > 0
    ? { x1: colCenter(0), y1: axisY, x2: colCenter(nCols - 1), y2: axisY }
    : undefined

  const contentWidth = nCols > 0
    ? colLeft(nCols - 1) + T.colWidth + T.padding
    : 2 * T.padding + T.colWidth
  const width = contentWidth
  const height = Math.max(maxEventsBottom, axisY) + T.padding

  return {
    width,
    height,
    title: hasTitle ? { text: timeline.title!, x: width / 2, y: T.padding + T.titleFontSize } : undefined,
    sections,
    axis,
    periods,
    events,
  }
}

/**
 * Derive a deterministic, collision-free id from event text.
 * Duplicate texts get a `#2`, `#3`, … suffix so every id in one diagram is
 * unique — a colliding id would misroute a human's annotation.
 */
function uniqueId(text: string, used: Map<string, number>): string {
  const base = text.trim() || 'event'
  const count = used.get(base) ?? 0
  used.set(base, count + 1)
  return count === 0 ? base : `${base}#${count + 1}`
}

export const TIMELINE_LAYOUT = T
