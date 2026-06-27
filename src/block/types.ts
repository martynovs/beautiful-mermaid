// ============================================================================
// Block diagram types
//
// Models the parsed and positioned representations of a Mermaid block-beta
// diagram. A block-beta diagram is a uniform grid of blocks (some cells may
// be empty `space` slots) connected by straight edges.
// ============================================================================

import type { Point } from '../types.ts'

/** Parsed block diagram — logical structure from mermaid text */
export interface BlockDiagram {
  /** Number of grid columns (from `columns N`) */
  columns: number
  /** Blocks, each assigned a grid cell */
  blocks: BlockNode[]
  /** Edges connecting blocks by id */
  edges: BlockEdge[]
}

/** A single block occupying one grid cell */
export interface BlockNode {
  /** Block id (used for edge matching + data-id) */
  id: string
  /** Display label */
  label: string
  /** Grid column (0-based, left to right) */
  col: number
  /** Grid row (0-based, top to bottom) */
  row: number
}

/** An edge between two blocks (by id) */
export interface BlockEdge {
  source: string
  target: string
}

// ============================================================================
// Positioned block diagram — ready for SVG rendering
// ============================================================================

export interface PositionedBlockDiagram {
  width: number
  height: number
  blocks: PositionedBlock[]
  edges: PositionedBlockEdge[]
}

export interface PositionedBlock {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedBlockEdge {
  source: string
  target: string
  /** Straight polyline: [borderPointOnSource, borderPointOnTarget] */
  points: Point[]
}
