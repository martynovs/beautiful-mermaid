// ============================================================================
// Mindmap types
//
// Models the parsed and positioned representations of a Mermaid `mindmap`.
// An indentation-based tree: a single root with arbitrarily nested children.
// Node shapes (square, round, circle, bang, cloud, hexagon) are optional
// metadata extracted from bracket delimiters around the label text.
// ============================================================================

/** Node shape, derived from the bracket delimiters wrapping the label. */
export type MindmapShape =
  | 'default'  // plain text, no brackets
  | 'square'   // [text]
  | 'round'    // (text)
  | 'circle'   // ((text))
  | 'bang'     // ))text((
  | 'cloud'    // )text(
  | 'hexagon'  // {{text}}

/** A node in the parsed mindmap hierarchy. */
export interface MindmapNode {
  /**
   * Stable unique identifier (the identity contract `data-id`). Derived from the
   * node's explicit id (if given) or its label, and disambiguated so duplicate
   * labels within a single mindmap never collide.
   */
  id: string
  /** Display label (text inside the shape delimiters, or the plain text). */
  label: string
  /** Shape metadata (optional — defaults to `default`). */
  shape: MindmapShape
  /** Depth in the tree (root = 0). */
  depth: number
  /** Child nodes (empty for leaves). */
  children: MindmapNode[]
}

/** Parsed mindmap — logical structure from mermaid text. */
export interface Mindmap {
  /**
   * The hierarchy root. When the source has a single top-level node it is that
   * node; when it has several, `root` is a synthetic container (empty id/label)
   * whose `children` are the forest roots.
   */
  root: MindmapNode
}

// ============================================================================
// Positioned mindmap — ready for SVG rendering
// ============================================================================

export interface PositionedMindmap {
  width: number
  height: number
  /** Flattened nodes in pre-order (parents before children). */
  nodes: PositionedMindmapNode[]
  /** Parent→child connector lines. */
  connectors: MindmapConnector[]
}

export interface PositionedMindmapNode {
  /** Stable unique id (the identity contract `data-id`). */
  id: string
  label: string
  shape: MindmapShape
  depth: number
  /** Box top-left corner. */
  x: number
  y: number
  width: number
  height: number
}

export interface MindmapConnector {
  /** Source (parent) node id. */
  from: string
  /** Target (child) node id. */
  to: string
  x1: number
  y1: number
  x2: number
  y2: number
}
