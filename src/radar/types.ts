// ============================================================================
// Radar chart types
//
// Models the parsed and positioned representations of a Mermaid `radar` chart
// (a.k.a. `radar-beta`). A set of named axes radiate from a shared center; each
// data series (curve) plots one value per axis, drawn as a closed polygon.
// ============================================================================

/** Parsed radar chart — logical structure from mermaid text */
export interface RadarChart {
  title?: string
  /** Named axes, in declaration order (defines the angular position of each spoke) */
  axes: RadarAxis[]
  /** One or more data series, each carrying a value per axis */
  series: RadarSeries[]
  /** Explicit upper bound for the radial scale (`max <n>`). Auto-derived when absent. */
  max?: number
}

export interface RadarAxis {
  /** Stable identifier from the source (unique within the chart) */
  id: string
  /** Display label (falls back to the id) */
  label: string
}

export interface RadarSeries {
  /** Stable identifier from the source (unique within the chart) */
  id: string
  /** Display label (falls back to the id) */
  label: string
  /** Values aligned to `axes` order; index i corresponds to axes[i] */
  values: number[]
}

// ============================================================================
// Positioned radar chart — ready for SVG rendering
// ============================================================================

export interface PositionedRadarChart {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Center of the radar disc */
  cx: number
  cy: number
  /** Outer radius (value === scale max) */
  radius: number
  /** Concentric graticule ring radii, inner → outer */
  rings: number[]
  axes: PositionedRadarAxis[]
  series: PositionedRadarSeries[]
  legend: RadarLegendItem[]
}

export interface PositionedRadarAxis {
  id: string
  label: string
  /** Angle in radians (0 = top, clockwise) */
  angle: number
  /** Outer endpoint of the spoke */
  x: number
  y: number
  /** Anchor for the axis label sitting just beyond the outer endpoint */
  labelX: number
  labelY: number
  labelAnchor: 'start' | 'middle' | 'end'
}

export interface PositionedRadarSeries {
  id: string
  label: string
  colorIndex: number
  /** SVG path `d` for the closed polygon connecting this series' points */
  path: string
  points: PositionedRadarPoint[]
}

export interface PositionedRadarPoint {
  /** Deterministic, unique id for this plotted vertex (`<seriesId>::<axisId>`) */
  id: string
  axisId: string
  value: number
  x: number
  y: number
}

export interface RadarLegendItem {
  label: string
  /** Label text anchor */
  x: number
  y: number
  /** Swatch top-left corner */
  swatchX: number
  swatchY: number
  colorIndex: number
}
