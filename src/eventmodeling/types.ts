// ============================================================================
// Event modeling types
//
// Models the parsed and positioned representations of a Mermaid
// `eventmodeling` diagram (v11.15+).
//
// An event-modeling diagram is a horizontal time axis (one column per
// time-frame number, in order) crossed with three fixed swimlanes:
//
//   UI/Automation      — entity types `ui`, `pcr`
//   Command/Read Model — entity types `cmd`, `rmo`
//   Events             — entity type  `evt`
//
// Each time frame is a single entity box placed in its column and in the
// swimlane its type belongs to. Relations between consecutive frames are
// inferred (the diagram reads left to right as a sequence).
// ============================================================================

import type { Point } from '../types.ts'

/** The five canonical event-modeling entity types. */
export type EntityType = 'ui' | 'pcr' | 'cmd' | 'rmo' | 'evt'

/** The three fixed swimlanes. */
export type SwimlaneId = 'ui-automation' | 'command-readmodel' | 'events'

// ============================================================================
// Parsed event-modeling diagram — logical structure from mermaid text
// ============================================================================

export interface EventModeling {
  title?: string
  /** Time frames in declaration order. */
  frames: EventFrame[]
}

/** A single time frame (one entity box). */
export interface EventFrame {
  /** Unique time-frame id — the raw declared number (e.g. "01"). */
  number: string
  /** Numeric value of `number`, used to order columns. */
  numeric: number
  /** Canonical entity type. */
  type: EntityType
  /** Display name (inline data blocks stripped). */
  name: string
  /** Which swimlane the type maps to. */
  swimlane: SwimlaneId
}

// ============================================================================
// Positioned event-modeling diagram — ready for SVG rendering
// ============================================================================

export interface PositionedEventModeling {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  lanes: PositionedLane[]
  /** Time-axis number labels, one per column. */
  axis: AxisLabel[]
  frames: PositionedFrame[]
  relations: PositionedRelation[]
}

export interface PositionedLane {
  id: SwimlaneId
  label: string
  /** Top edge of the lane band. */
  y: number
  height: number
  /** Left-aligned anchor for the lane label text. */
  labelX: number
  labelY: number
}

export interface AxisLabel {
  text: string
  x: number
  y: number
}

export interface PositionedFrame {
  /** Unique data-id (the frame number). */
  id: string
  number: string
  type: EntityType
  name: string
  swimlane: SwimlaneId
  x: number
  y: number
  width: number
  height: number
  /** Palette index used to derive a distinct fill per entity type. */
  colorIndex: number
}

export interface PositionedRelation {
  from: string
  to: string
  /** Straight polyline: [borderPointOnSource, borderPointOnTarget]. */
  points: Point[]
}
