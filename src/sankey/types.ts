// ============================================================================
// Sankey diagram types
//
// Models the parsed and positioned representations of a Mermaid `sankey`
// diagram: a directed flow graph where each link carries a numeric value and
// is drawn as a band whose thickness is proportional to that value.
// ============================================================================

/** Parsed sankey — logical flow graph from mermaid text */
export interface Sankey {
  /** Unique node names, in order of first appearance */
  nodes: string[]
  /** Directed weighted flows */
  links: SankeyLink[]
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

// ============================================================================
// Positioned sankey — ready for SVG rendering
// ============================================================================

export interface PositionedSankey {
  width: number
  height: number
  nodes: PositionedSankeyNode[]
  links: PositionedSankeyLink[]
}

export interface PositionedSankeyNode {
  /** Unique id (the node name) */
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  /** Per-node color index (0 = accent) */
  colorIndex: number
  /** Label anchor x + horizontal alignment */
  labelX: number
  labelY: number
  labelAnchor: 'start' | 'end'
}

export interface PositionedSankeyLink {
  source: string
  target: string
  value: number
  /** Filled cubic-bezier band path */
  path: string
  /** Color index inherited from the source node */
  colorIndex: number
}
