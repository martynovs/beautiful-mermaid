// ============================================================================
// Venn diagram types
//
// Models the parsed and positioned representations of a Mermaid `venn-beta`
// diagram: a set of overlapping circles (sets) plus named overlap regions
// (unions / intersections) referencing two or more of those sets.
// ============================================================================

/** Parsed venn diagram — logical structure from mermaid text */
export interface VennDiagram {
  title?: string
  sets: VennSet[]
  unions: VennUnion[]
}

export interface VennSet {
  /** Stable identifier (bareword or the text of a quoted id) */
  id: string
  /** Display label — falls back to the id when none is given */
  label: string
}

export interface VennUnion {
  /** Derived unique id, e.g. `A∩B` (disambiguated on collision) */
  id: string
  /** Ids of the sets this overlap region spans (>= 2) */
  setIds: string[]
  /** Optional display label for the region */
  label?: string
}

// ============================================================================
// Positioned venn diagram — ready for SVG rendering
// ============================================================================

export interface PositionedVennDiagram {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  sets: PositionedVennSet[]
  unions: PositionedVennUnion[]
}

export interface PositionedVennSet {
  id: string
  label: string
  /** Circle center */
  cx: number
  cy: number
  /** Circle radius */
  r: number
  colorIndex: number
  /** Set-label anchor (placed toward the outer edge) */
  labelX: number
  labelY: number
}

export interface PositionedVennUnion {
  id: string
  setIds: string[]
  /**
   * Explicit display label only ("" when none was given). Derived `A ∩ B`
   * text is intentionally omitted — the visual overlap conveys the region,
   * and stacked `∩` captions look cramped. The region stays addressable via
   * its `data-id` regardless of whether a label is shown.
   */
  label: string
  /**
   * Lens-centroid anchor: the midpoint of the member circle centers, which for
   * a pair is the center of that pair's overlap lens (not the diagram center).
   */
  x: number
  y: number
}
