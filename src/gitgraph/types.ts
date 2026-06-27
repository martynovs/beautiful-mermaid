// ============================================================================
// Git graph types
//
// Models the parsed and positioned representations of a Mermaid `gitGraph`.
// Commits flow left-to-right in chronological order; each branch occupies its
// own horizontal lane. Branch lines connect successive commits on a branch and
// merge edges cross lanes.
// ============================================================================

/** Visual style of a commit node (`commit type: ...`). */
export type GitCommitType = 'NORMAL' | 'REVERSE' | 'HIGHLIGHT'

/** Diagram orientation declared on the header (only LR is laid out today). */
export type GitOrientation = 'LR' | 'TB' | 'BT'

// ============================================================================
// Parsed git graph — logical structure from mermaid text
// ============================================================================

export interface GitGraph {
  orientation: GitOrientation
  /** Branches in declaration order; `order` is the lane index. */
  branches: GitBranch[]
  /** Commits in chronological (declaration) order. */
  commits: GitCommit[]
}

export interface GitBranch {
  name: string
  /** Lane index — 0 is the first (top) lane. */
  order: number
}

export interface GitCommit {
  /** Unique id within the diagram (explicit `id:` or a generated stable id). */
  id: string
  /** Branch this commit lives on. */
  branch: string
  /** Parent commit ids. [0] = previous commit on the branch; [1] = merge source. */
  parents: string[]
  tag?: string
  type: GitCommitType
  /** True for commits created by `merge`. */
  isMerge: boolean
  /** True for commits created by `cherry-pick`. */
  isCherryPick: boolean
}

// ============================================================================
// Positioned git graph — ready for SVG rendering
// ============================================================================

export interface PositionedGitGraph {
  width: number
  height: number
  commits: PositionedCommit[]
  edges: PositionedGitEdge[]
  branchLabels: PositionedBranchLabel[]
}

export interface PositionedCommit {
  id: string
  /** Displayed label (the commit id). */
  label: string
  x: number
  y: number
  type: GitCommitType
  isMerge: boolean
  tag?: string
  /** Lane / branch order — drives the per-branch color. */
  colorIndex: number
}

export interface PositionedGitEdge {
  /** Parent commit id. */
  from: string
  /** Child commit id. */
  to: string
  /** SVG path `d` connecting parent → child. */
  path: string
  /** Branch order whose color this edge takes. */
  colorIndex: number
}

export interface PositionedBranchLabel {
  name: string
  x: number
  y: number
  colorIndex: number
}
