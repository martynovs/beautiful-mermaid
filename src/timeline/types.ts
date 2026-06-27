// ============================================================================
// Timeline diagram types
//
// Models the parsed and positioned representations of a Mermaid `timeline`.
// A timeline maps time periods to one or more events, optionally grouped into
// named sections. Periods flow left→right; events stack top→bottom under each.
// ============================================================================

/** Parsed timeline — logical structure from mermaid text */
export interface Timeline {
  title?: string
  /** Ordered sections. An unnamed (implicit) section is used when the source
   *  declares periods before any `section` directive. */
  sections: TimelineSection[]
}

export interface TimelineSection {
  /** Section name, or undefined for the implicit default section */
  name?: string
  periods: TimelinePeriod[]
}

export interface TimelinePeriod {
  /** The time-period label (e.g. `2024-01`) */
  label: string
  /** Events under this period, in source order (top → bottom) */
  events: string[]
}

// ============================================================================
// Positioned timeline — ready for SVG rendering
// ============================================================================

export interface PositionedTimeline {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Section header bands (only emitted when at least one section is named) */
  sections: PositionedSection[]
  /** The horizontal spine connecting period markers (undefined when empty) */
  axis?: { x1: number; y1: number; x2: number; y2: number }
  periods: PositionedPeriod[]
  events: PositionedEvent[]
}

export interface PositionedSection {
  name: string
  x: number
  y: number
  width: number
  height: number
  /** Label anchor (centered in the band) */
  labelX: number
  labelY: number
  colorIndex: number
}

export interface PositionedPeriod {
  label: string
  /** Marker center on the axis */
  markerX: number
  markerY: number
  /** Period label anchor (centered above the axis) */
  labelX: number
  labelY: number
  colorIndex: number
}

export interface PositionedEvent {
  /** Stable, unique identifier derived from the event text (data-id) */
  id: string
  text: string
  /** Card top-left corner */
  x: number
  y: number
  width: number
  height: number
  /** Label anchor (centered in the card) */
  labelX: number
  labelY: number
  colorIndex: number
}
