// ============================================================================
// Gantt chart types
//
// Models the parsed and positioned representations of a Mermaid `gantt` chart.
// A horizontal timeline (in day units) where each task is a bar spanning from
// its start day to its end day, grouped into sections.
// ============================================================================

/** Task status tags (Mermaid: `done`, `active`, `crit`, `milestone`) */
export type GanttStatus = 'done' | 'active' | 'crit' | 'milestone'

/** Parsed gantt chart — logical structure from mermaid text */
export interface Gantt {
  title?: string
  /** Input date format directive (default `YYYY-MM-DD`) */
  dateFormat?: string
  /** Earliest absolute date in the chart, ISO `YYYY-MM-DD` (day index 0). */
  startDate?: string
  /** Sections in source order; tasks before any `section` go in a default one. */
  sections: GanttSection[]
  /** All tasks flattened in source order (each also lives in its section). */
  tasks: GanttTask[]
}

export interface GanttSection {
  name: string
  tasks: GanttTask[]
}

export interface GanttTask {
  /** Stable identity — explicit task id when present, else slug(name); unique. */
  id: string
  /** Explicit task id from source, if one was given. */
  taskId?: string
  /** Display name. */
  name: string
  /** Owning section name. */
  section: string
  /** Status tags (done / active / crit / milestone). */
  tags: GanttStatus[]
  /** True when the task is a milestone (a zero-length point in time). */
  milestone: boolean
  /** Start day index, relative to the earliest date (0-based). */
  startDay: number
  /** End day index (= startDay + durationDays). */
  endDay: number
  /** Duration in days (0 for a milestone). */
  durationDays: number
}

// ============================================================================
// Positioned gantt chart — ready for SVG rendering
// ============================================================================

export interface PositionedGantt {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** The plotting rectangle for the timeline grid. */
  gridArea: { x: number; y: number; width: number; height: number }
  /** Vertical day gridlines, with optional date/day header labels. */
  gridLines: PositionedGridLine[]
  /** Section bands + labels. */
  sections: PositionedSection[]
  /** Positioned task bars. */
  tasks: PositionedTask[]
}

export interface PositionedGridLine {
  x: number
  y1: number
  y2: number
  /** Header label (date or day number); absent for unlabeled minor lines. */
  label?: string
  labelX?: number
  labelY?: number
}

export interface PositionedSection {
  name: string
  /** Faint band behind the section's rows. */
  bandX: number
  bandY: number
  bandW: number
  bandH: number
  /** Rotated label anchored at the left of the band. */
  labelX: number
  labelY: number
  colorIndex: number
}

export interface PositionedTask {
  id: string
  name: string
  tags: GanttStatus[]
  milestone: boolean
  /** Bar rectangle (for non-milestone tasks). */
  x: number
  y: number
  width: number
  height: number
  /** Milestone diamond center (when `milestone`). */
  cx: number
  cy: number
  /** Task-name label (left column, right-aligned). */
  labelX: number
  labelY: number
  /** Section index, drives the per-section bar color. */
  colorIndex: number
}
