import type {
  Gantt,
  PositionedGantt,
  PositionedTask,
  PositionedSection,
  PositionedGridLine,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'
import { addDaysISO } from './parser.ts'

// ============================================================================
// Gantt chart layout engine
//
// Computes pixel geometry for a horizontal timeline. No ELK needed — the day
// axis maps directly onto x:
//
//   dayToX(day) = gridX + day * dayWidth
//
// Tasks stack into rows (grouped by section); a header row above the grid
// carries day/date gridline labels.
// ============================================================================

const G = {
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  /** Minimum header band height; grows to fit the rotated date labels. */
  headerHeight: 30,
  /** Padding added below the longest rotated date label inside the header band. */
  headerLabelPad: 12,
  /** Gap between a rotated label's foot and the top of the grid. */
  headerLabelGap: 4,
  rowHeight: 30,
  barHeight: 18,
  dayWidth: 26,
  /** Min bar width so a 0–1 day task is still clickable. */
  minBarWidth: 8,
  milestoneRadius: 9,
  labelGap: 12,
  minLabelCol: 80,
  maxLabelCol: 280,
  sectionLabelStrip: 22,
  taskFontSize: 13,
  taskFontWeight: 500,
  headerFontSize: 11,
  headerFontWeight: 500,
} as const

/**
 * Lay out a parsed gantt chart by computing pixel geometry.
 */
export function layoutGantt(chart: Gantt, _options: RenderOptions = {}): PositionedGantt {
  const hasTitle = !!chart.title
  const totalRows = chart.tasks.length

  // Total timeline span in days (at least 1 so an empty chart still renders).
  const totalDays = Math.max(1, ...chart.tasks.map(t => t.endDay))

  // Left column width — sized to the longest task name.
  let labelW: number = G.minLabelCol
  for (const t of chart.tasks) {
    labelW = Math.max(labelW, estimateTextWidth(t.name, G.taskFontSize, G.taskFontWeight) + 8)
  }
  labelW = Math.min(labelW, G.maxLabelCol)

  const top = G.padding + (hasTitle ? G.titleHeight : 0)
  const gridX = G.padding + G.sectionLabelStrip + labelW + G.labelGap

  // ---- Pick tick spacing ----
  // Labels are rendered rotated to vertical, so adjacent labels only need to
  // clear each other by their (thin) cap height rather than their full width.
  // One day apart (dayWidth) already exceeds that, so we label every day until
  // the gridlines themselves get tight, then thin to keep the foot legible.
  const minTickSpacing = G.headerFontSize + 6
  const tickStep = Math.max(1, Math.ceil(minTickSpacing / G.dayWidth))

  // ---- Reserve vertical header space for the rotated labels ----
  // Rotated date labels read bottom-to-top, so the longest label's *width*
  // becomes the vertical extent the header band must accommodate.
  let maxLabelW = 0
  for (let d = 0; d <= totalDays; d += tickStep) {
    maxLabelW = Math.max(
      maxLabelW,
      estimateTextWidth(tickLabel(chart, d), G.headerFontSize, G.headerFontWeight),
    )
  }
  const headerBand = Math.max(
    G.headerHeight,
    Math.ceil(maxLabelW) + G.headerLabelPad + G.headerLabelGap,
  )

  const gridY = top + headerBand
  const gridW = totalDays * G.dayWidth
  const gridH = totalRows * G.rowHeight

  const dayToX = (day: number) => gridX + day * G.dayWidth

  // ---- Gridlines + header labels ----
  // Each labeled gridline carries an anchor point just above the grid; the
  // renderer rotates the label upward from there so it sits as a thin vertical
  // strip centered on the gridline x.
  const gridLines: PositionedGridLine[] = []
  for (let d = 0; d <= totalDays; d++) {
    const x = dayToX(d)
    const labeled = d % tickStep === 0
    gridLines.push({
      x,
      y1: gridY,
      y2: gridY + gridH,
      label: labeled ? tickLabel(chart, d) : undefined,
      labelX: labeled ? x : undefined,
      labelY: labeled ? gridY - G.headerLabelGap : undefined,
    })
  }

  // ---- Section bands + task bars ----
  const sections: PositionedSection[] = []
  const tasks: PositionedTask[] = []
  let row = 0
  chart.sections.forEach((sec, si) => {
    const bandY = gridY + row * G.rowHeight
    const bandH = sec.tasks.length * G.rowHeight

    sections.push({
      name: sec.name,
      bandX: G.padding,
      bandY,
      bandW: gridX + gridW - G.padding,
      bandH,
      labelX: G.padding + G.sectionLabelStrip / 2,
      labelY: bandY + bandH / 2,
      colorIndex: si,
    })

    for (const t of sec.tasks) {
      const rowY = gridY + row * G.rowHeight
      const barY = rowY + (G.rowHeight - G.barHeight) / 2
      const x = dayToX(t.startDay)
      const w = Math.max(G.minBarWidth, t.durationDays * G.dayWidth)
      tasks.push({
        id: t.id,
        name: t.name,
        tags: t.tags,
        milestone: t.milestone,
        x,
        y: barY,
        width: w,
        height: G.barHeight,
        cx: x,
        cy: rowY + G.rowHeight / 2,
        labelX: gridX - G.labelGap,
        labelY: rowY + G.rowHeight / 2,
        colorIndex: si,
      })
      row++
    }
  })

  const width = gridX + gridW + G.padding
  const height = gridY + gridH + G.padding

  return {
    width,
    height,
    title: hasTitle
      ? { text: chart.title!, x: width / 2, y: G.padding + G.titleFontSize }
      : undefined,
    gridArea: { x: gridX, y: gridY, width: gridW, height: gridH },
    gridLines,
    sections,
    tasks,
  }
}

/** Header label for day index `d`: a date when anchored, else `+Nd`. */
function tickLabel(chart: Gantt, d: number): string {
  if (chart.startDate) return addDaysISO(chart.startDate, d)
  return `+${d}d`
}

export const GANTT_LAYOUT = G
