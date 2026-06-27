// ============================================================================
// User journey types
//
// Models the parsed and positioned representations of a Mermaid `journey`
// diagram. A journey is a timeline of tasks grouped into sections; each task
// carries a satisfaction score (1..5) and a list of participating actors.
// ============================================================================

/** Parsed journey — logical structure from mermaid text */
export interface Journey {
  title?: string
  sections: JourneySection[]
}

export interface JourneySection {
  name: string
  tasks: JourneyTask[]
}

export interface JourneyTask {
  name: string
  /** Satisfaction score, clamped to 1..5 */
  score: number
  /** Participating actors (may be empty) */
  actors: string[]
}

// ============================================================================
// Positioned journey — ready for SVG rendering
// ============================================================================

export interface PositionedJourney {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Section header bands spanning the tasks they group */
  sections: PositionedSection[]
  /** Positioned tasks (markers + labels), one per task across all sections */
  tasks: PositionedTask[]
  /** Horizontal score gridlines + axis labels (scores 1..5) */
  scoreLines: PositionedScoreLine[]
  /** The timeline baseline along the bottom of the plot */
  baseline: { x1: number; y1: number; x2: number; y2: number }
}

export interface PositionedSection {
  name: string
  /** Band rectangle */
  x: number
  y: number
  width: number
  height: number
  /** Centered label anchor */
  labelX: number
  labelY: number
  colorIndex: number
}

export interface PositionedTask {
  /** Stable unique id (derived from the task name, duplicates disambiguated) */
  id: string
  name: string
  score: number
  actors: string[]
  /** Marker (satisfaction dot) center */
  cx: number
  cy: number
  /** Dotted connector from the marker down to the baseline */
  connectorY1: number
  connectorY2: number
  /** Task name label anchor (below the baseline) */
  labelX: number
  labelY: number
  /** Actor list label anchor (below the task name) */
  actorsX: number
  actorsY: number
  /** Section color index this task inherits */
  colorIndex: number
}

export interface PositionedScoreLine {
  score: number
  /** Gridline extent */
  x1: number
  x2: number
  y: number
  /** Axis label anchor (left of the plot) */
  labelX: number
  labelY: number
}
