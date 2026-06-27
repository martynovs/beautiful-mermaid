import type {
  Journey,
  PositionedJourney,
  PositionedSection,
  PositionedTask,
  PositionedScoreLine,
} from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// User journey layout engine
//
// Computes pixel geometry for a journey timeline. No ELK needed — tasks are
// laid out left-to-right in fixed-width columns, and each task's satisfaction
// marker floats above a baseline at a height proportional to its score.
//
//   score 5 → top of the plot, score 1 → just above the baseline.
// ============================================================================

const J = {
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  sectionHeaderH: 30,
  sectionGap: 10,
  taskWidth: 150,
  plotHeight: 240,
  markerRadius: 16,
  taskLabelGap: 24,
  taskLabelSize: 13,
  taskLabelWeight: 600,
  actorGap: 20,
  actorSize: 11,
  actorWeight: 400,
  axisStripW: 40,
  scoreMin: 1,
  scoreMax: 5,
} as const

/**
 * Lay out a parsed journey by computing pixel geometry.
 */
export function layoutJourney(journey: Journey, _options: RenderOptions = {}): PositionedJourney {
  const hasTitle = !!journey.title

  const top = J.padding + (hasTitle ? J.titleHeight : 0)
  const sectionBandY = top
  const plotTop = sectionBandY + J.sectionHeaderH + J.sectionGap
  const baselineY = plotTop + J.plotHeight
  const left = J.padding + J.axisStripW

  // Flatten tasks while remembering their section, and assign stable unique ids.
  const seenIds = new Map<string, number>()
  const tasks: PositionedTask[] = []
  const sections: PositionedSection[] = []

  let taskIndex = 0
  journey.sections.forEach((section, sIdx) => {
    const firstIndex = taskIndex
    const colorIndex = sIdx

    section.tasks.forEach(task => {
      const cx = left + taskIndex * J.taskWidth + J.taskWidth / 2
      const cy = yForScore(task.score, baselineY)
      tasks.push({
        id: uniqueId(task.name, seenIds),
        name: task.name,
        score: task.score,
        actors: task.actors,
        cx,
        cy,
        connectorY1: cy + J.markerRadius,
        connectorY2: baselineY,
        labelX: cx,
        labelY: baselineY + J.taskLabelGap,
        actorsX: cx,
        actorsY: baselineY + J.taskLabelGap + J.actorGap,
        colorIndex,
      })
      taskIndex++
    })

    const count = taskIndex - firstIndex
    if (count > 0) {
      const bandX = left + firstIndex * J.taskWidth
      const bandW = count * J.taskWidth
      sections.push({
        name: section.name,
        x: bandX,
        y: sectionBandY,
        width: bandW,
        height: J.sectionHeaderH,
        labelX: bandX + bandW / 2,
        labelY: sectionBandY + J.sectionHeaderH / 2,
        colorIndex,
      })
    }
  })

  const totalTasks = taskIndex
  const plotRight = left + Math.max(totalTasks, 1) * J.taskWidth

  // Score gridlines + axis labels (scores 1..5).
  const scoreLines: PositionedScoreLine[] = []
  for (let s = J.scoreMin; s <= J.scoreMax; s++) {
    const y = yForScore(s, baselineY)
    scoreLines.push({
      score: s,
      x1: left,
      x2: plotRight,
      y,
      labelX: left - 12,
      labelY: y,
    })
  }

  const baseline = { x1: left, y1: baselineY, x2: plotRight, y2: baselineY }

  // Bottom extent depends on whether any task carries actor text.
  const hasActors = tasks.some(t => t.actors.length > 0)
  const bottomLabel = baselineY + J.taskLabelGap + (hasActors ? J.actorGap : 0)

  const width = plotRight + J.padding
  const height = bottomLabel + J.padding

  // Title is centered over the plot region (not the full width with the axis strip).
  return {
    width,
    height,
    title: hasTitle
      ? { text: journey.title!, x: width / 2, y: J.padding + J.titleFontSize }
      : undefined,
    sections,
    tasks,
    scoreLines,
    baseline,
  }
}

/** Map a score (1..5) to a y coordinate; higher score sits higher (smaller y). */
function yForScore(score: number, baselineY: number): number {
  const span = J.plotHeight - J.markerRadius * 2
  const frac = (score - J.scoreMin) / (J.scoreMax - J.scoreMin)
  return baselineY - J.markerRadius - frac * span
}

/** Derive a stable unique id from a task name, disambiguating duplicates. */
function uniqueId(name: string, seen: Map<string, number>): string {
  const base = name.trim() || 'task'
  const n = seen.get(base) ?? 0
  seen.set(base, n + 1)
  return n === 0 ? base : `${base}-${n + 1}`
}

export const JOURNEY_LAYOUT = J
