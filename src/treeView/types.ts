// ============================================================================
// TreeView types
//
// Models the parsed and positioned representations of a Mermaid `treeView`
// diagram: a directory-style hierarchy rendered like a file explorer. Nesting
// comes from indentation; a trailing `/` on a label marks a folder.
// ============================================================================

/** Parsed treeView — logical hierarchy extracted from mermaid text */
export interface TreeView {
  title?: string
  /** Root-level nodes (a forest); nesting lives in each node's `children`. */
  nodes: TreeNode[]
}

export interface TreeNode {
  /** Display label (trailing `/` and quotes stripped) */
  label: string
  /** Hierarchical, disambiguated identity path (e.g. `src/utils/index.ts`) */
  path: string
  /** True for directories — explicit (trailing `/`) or implied (has children) */
  isFolder: boolean
  /** Optional inline description from a `## text` suffix (rendered italic) */
  description?: string
  /** Nesting depth, 0 for root-level nodes */
  depth: number
  children: TreeNode[]
}

// ============================================================================
// Positioned treeView — ready for SVG rendering
// ============================================================================

export interface PositionedTreeView {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  rows: PositionedTreeRow[]
  connectors: TreeConnector[]
}

export interface PositionedTreeRow {
  path: string
  /** Parent's path, when this node is nested (omitted for root-level nodes) */
  parentPath?: string
  label: string
  description?: string
  isFolder: boolean
  depth: number
  /** Left edge of the glyph slot */
  glyphX: number
  /** Top edge of the glyph slot */
  glyphY: number
  /** Text baseline anchor x for the label */
  textX: number
  /** Text baseline anchor x for the description (when present) */
  descX: number
  /** Vertical center of the row */
  rowCenterY: number
}

export interface TreeConnector {
  /** Parent node path */
  from: string
  /** Child node path */
  to: string
  /** SVG path `d` for the elbow connector (vertical drop + horizontal stub) */
  d: string
}
