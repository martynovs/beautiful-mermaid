// ============================================================================
// Quadrant chart types
//
// Models the parsed and positioned representations of a Mermaid quadrantChart.
// A square plot split into four quadrants, with data points placed in the
// 0..1 x/y space (x = left→right, y = bottom→top).
// ============================================================================

/** Parsed quadrant chart — logical structure from mermaid text */
export interface QuadrantChart {
  /** Optional chart title */
  title?: string
  /** X-axis end labels (low → high, left → right) */
  xAxis: { left?: string; right?: string }
  /** Y-axis end labels (low → high, bottom → top) */
  yAxis: { bottom?: string; top?: string }
  /** Quadrant labels keyed 1..4 (Mermaid convention: 1=TR, 2=TL, 3=BL, 4=BR) */
  quadrants: { q1?: string; q2?: string; q3?: string; q4?: string }
  /** Data points, x/y in 0..1 */
  points: QuadrantPoint[]
}

export interface QuadrantPoint {
  name: string
  /** 0 = left, 1 = right */
  x: number
  /** 0 = bottom, 1 = top */
  y: number
}

// ============================================================================
// Positioned quadrant chart — ready for SVG rendering
// ============================================================================

export interface PositionedQuadrantChart {
  width: number
  height: number
  /** Title text and position (if present) */
  title?: { text: string; x: number; y: number }
  /** The square plot area bounds */
  plotArea: { x: number; y: number; width: number; height: number }
  /** Dividing cross lines (vertical + horizontal through the center) */
  crossLines: Array<{ x1: number; y1: number; x2: number; y2: number }>
  /** Faint background tints, one per quadrant region (checkerboard) */
  quadrantFills: Array<{ x: number; y: number; width: number; height: number; tinted: boolean }>
  /** Quadrant region labels, rendered faintly */
  quadrantLabels: PositionedText[]
  /** Axis end labels (x left/right below plot, y bottom/top rotated at left) */
  axisLabels: PositionedAxisLabel[]
  /** Positioned data points */
  points: PositionedPoint[]
}

export interface PositionedText {
  text: string
  x: number
  y: number
}

export interface PositionedAxisLabel extends PositionedText {
  anchor: 'start' | 'middle' | 'end'
  /** Rotation in degrees (used for the y-axis labels) */
  rotate?: number
}

export interface PositionedPoint {
  name: string
  /** Dot center, in screen coordinates */
  cx: number
  cy: number
  /** Label position (centered below the dot) */
  labelX: number
  labelY: number
}
