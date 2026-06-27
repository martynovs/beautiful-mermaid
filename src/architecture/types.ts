// ============================================================================
// Architecture (architecture-beta) types
//
// Models the parsed and positioned representations of a Mermaid
// `architecture-beta` diagram: groups (labeled, optionally nested containers),
// services (icon nodes living in a group or at the top level), junctions
// (four-way connection points), and edges joining service/junction sides.
// ============================================================================

/** A side of a node where an edge attaches. */
export type Side = 'L' | 'R' | 'T' | 'B'

// ============================================================================
// Parsed architecture — logical structure from mermaid text
// ============================================================================

/** Parsed architecture diagram. */
export interface Architecture {
  groups: ArchGroup[]
  services: ArchService[]
  junctions: ArchJunction[]
  edges: ArchEdge[]
}

/** A labeled container that may nest inside another group. */
export interface ArchGroup {
  id: string
  /** Optional icon name (drawn next to the title). */
  icon?: string
  /** Display title; defaults to the id when omitted. */
  title: string
  /** Parent group id (for nesting via `in <group>`). */
  parent?: string
  /** Declaration order index — used to keep layout deterministic. */
  seq: number
}

/** A service node: an icon glyph + label, optionally inside a group. */
export interface ArchService {
  id: string
  /** Optional icon name resolved against the shared icon registry. */
  icon?: string
  /** Display title; defaults to the id when omitted. */
  title: string
  /** Owning group id (via `in <group>`). */
  group?: string
  seq: number
}

/** A junction: a small four-way connection point. */
export interface ArchJunction {
  id: string
  /** Owning group id (via `in <group>`). */
  group?: string
  seq: number
}

/** An edge between two nodes, attaching at a specific side of each. */
export interface ArchEdge {
  from: string
  fromSide: Side
  to: string
  toSide: Side
  /** Arrowhead at the source end (`<--`). */
  arrowStart: boolean
  /** Arrowhead at the target end (`-->`). */
  arrowEnd: boolean
}

// ============================================================================
// Positioned architecture — ready for SVG rendering
// ============================================================================

export interface Point {
  x: number
  y: number
}

export interface PositionedArchitecture {
  width: number
  height: number
  groups: PositionedArchGroup[]
  services: PositionedArchService[]
  junctions: PositionedArchJunction[]
  edges: PositionedArchEdge[]
}

export interface PositionedArchGroup {
  id: string
  title: string
  icon?: string
  x: number
  y: number
  width: number
  height: number
  /** Title text anchor (left-aligned within the header). */
  titleX: number
  titleY: number
}

export interface PositionedArchService {
  id: string
  title: string
  icon?: string
  x: number
  y: number
  width: number
  height: number
  iconX: number
  iconY: number
  iconSize: number
  labelX: number
  labelY: number
}

export interface PositionedArchJunction {
  id: string
  x: number
  y: number
  size: number
}

export interface PositionedArchEdge {
  from: string
  to: string
  arrowStart: boolean
  arrowEnd: boolean
  /** Orthogonal polyline in absolute coordinates: starts on the source anchor,
   *  ends on the target anchor, with only horizontal/vertical segments. */
  points: Point[]
}
