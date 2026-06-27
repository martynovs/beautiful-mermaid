// ============================================================================
// Pie chart types
//
// Models the parsed and positioned representations of a Mermaid `pie` chart.
// A circle split into wedges sized proportionally to each slice's value.
// ============================================================================

/** Parsed pie chart — logical structure from mermaid text */
export interface PieChart {
  title?: string
  /** When set, the legend shows raw values alongside labels (`pie showData`) */
  showData?: boolean
  slices: PieSlice[]
}

export interface PieSlice {
  label: string
  value: number
}

// ============================================================================
// Positioned pie chart — ready for SVG rendering
// ============================================================================

export interface PositionedPieChart {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  slices: PositionedSlice[]
  legend: PieLegendItem[]
}

export interface PositionedSlice {
  label: string
  value: number
  /** Share of the total, 0..100 */
  percent: number
  /** SVG path `d` for the wedge (or full disc when a single slice is 100%) */
  path: string
  /** Anchor for the inside percentage label */
  labelX: number
  labelY: number
  colorIndex: number
}

export interface PieLegendItem {
  label: string
  value: number
  percent: number
  /** Label text anchor */
  x: number
  y: number
  /** Swatch top-left corner */
  swatchX: number
  swatchY: number
  colorIndex: number
}
