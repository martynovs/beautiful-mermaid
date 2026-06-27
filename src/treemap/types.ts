// ============================================================================
// Treemap types
//
// Models the parsed and positioned representations of a Mermaid `treemap`
// diagram. An indentation-based hierarchy of branch nodes (groupings) and leaf
// nodes (each carrying a numeric value). Branch values are the sum of their
// descendants. The tree is laid out as nested rectangles whose areas are
// proportional to value (a squarified treemap).
// ============================================================================

/** A node in the parsed treemap hierarchy. */
export interface TreemapNode {
  /** Display label (quotes stripped). */
  label: string
  /**
   * Stable hierarchical identifier, e.g. `Root/Branch A/Leaf 1`.
   * Disambiguated so duplicate labels across (and within) branches never collide.
   */
  path: string
  /** Computed value: explicit for leaves, sum of descendants for branches. */
  value: number
  /** Child nodes (empty for leaves). */
  children: TreemapNode[]
  /**
   * Color bucket: the index of the top-level branch this node descends from.
   * Leaves inherit their top-level ancestor's index so a branch reads as one
   * color family. Assigned during parsing; `-1` for a synthetic/forest root.
   */
  colorIndex: number
}

/** Parsed treemap — logical structure from mermaid text. */
export interface Treemap {
  title?: string
  /**
   * The hierarchy root. When the source has a single top-level node it is that
   * node; when it has several, `root` is a synthetic container (empty label)
   * whose `children` are the forest roots.
   */
  root: TreemapNode
}

// ============================================================================
// Positioned treemap — ready for SVG rendering
// ============================================================================

export interface PositionedTreemap {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Flattened cells, parents before children (back-to-front draw order). */
  cells: PositionedCell[]
}

export interface PositionedCell {
  /** Stable hierarchical id (the identity contract `data-id`). */
  path: string
  label: string
  value: number
  x: number
  y: number
  width: number
  height: number
  /** 0 = top-level (or root), increasing with nesting. */
  depth: number
  /** True when the node has no children. */
  isLeaf: boolean
  /** Color bucket (top-level branch index). */
  colorIndex: number
}
