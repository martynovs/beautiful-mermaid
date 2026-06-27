// ============================================================================
// Wardley map types
//
// Models the parsed and positioned representations of a Mermaid `wardley-beta`
// map. A 2D strategy plot: components are placed in a 0..1 space keyed by
// [visibility, evolution] — visibility on the Y-axis (bottom→top) and evolution
// on the X-axis (Genesis→Commodity, left→right) — with dependency links drawn
// between them. Closely mirrors the quadrant chart (a 0..1 coordinate plot).
// ============================================================================

/** A node kind: a regular `component` or an `anchor` (a user / customer). */
export type WardleyComponentKind = 'component' | 'anchor'

/** How a dependency link is drawn. */
export type WardleyLinkStyle = 'solid' | 'dashed' | 'flow'

/** Parsed wardley map — logical structure from mermaid text */
export interface WardleyMap {
  /** Optional map title */
  title?: string
  /** Components + anchors placed in the value-chain / evolution plane */
  components: WardleyComponent[]
  /** Dependency links between components */
  links: WardleyLink[]
}

export interface WardleyComponent {
  /** Display name (also the source identifier) */
  name: string
  /** Visibility in the value chain, 0 = bottom (invisible) … 1 = top (visible) */
  visibility: number
  /** Evolution stage, 0 = Genesis (left) … 1 = Commodity (right) */
  evolution: number
  /** Whether this is a regular component or an anchor (user) node */
  kind: WardleyComponentKind
}

export interface WardleyLink {
  /** Source component name (as written in source) */
  from: string
  /** Target component name (as written in source) */
  to: string
  /** Optional inline annotation (`A -> B; label`) */
  label?: string
  style: WardleyLinkStyle
}

// ============================================================================
// Positioned wardley map — ready for SVG rendering
// ============================================================================

export interface PositionedWardleyMap {
  width: number
  height: number
  /** Title text and position (if present) */
  title?: { text: string; x: number; y: number }
  /** The square plot area bounds */
  plotArea: { x: number; y: number; width: number; height: number }
  /** Vertical evolution-stage divider lines (dashed) */
  gridLines: Array<{ x1: number; y1: number; x2: number; y2: number }>
  /** Evolution stage labels below the plot (Genesis … Commodity) */
  stageLabels: PositionedText[]
  /** Axis labels (evolution ends below, visibility rotated at the left) */
  axisLabels: PositionedAxisLabel[]
  /** Positioned dependency links (from/to centers) */
  links: PositionedLink[]
  /** Positioned components / anchors */
  components: PositionedComponent[]
}

export interface PositionedText {
  text: string
  x: number
  y: number
}

export interface PositionedAxisLabel extends PositionedText {
  anchor: 'start' | 'middle' | 'end'
  /** Rotation in degrees (used for the y-axis label) */
  rotate?: number
}

export interface PositionedComponent {
  /** Unique, deterministic id (disambiguated from duplicates) */
  id: string
  /** Display name */
  name: string
  kind: WardleyComponentKind
  /** Dot center, in screen coordinates */
  cx: number
  cy: number
  /** Label position (centered below the dot) */
  labelX: number
  labelY: number
}

export interface PositionedLink {
  /** Unique id of the source component */
  from: string
  /** Unique id of the target component */
  to: string
  style: WardleyLinkStyle
  x1: number
  y1: number
  x2: number
  y2: number
}
