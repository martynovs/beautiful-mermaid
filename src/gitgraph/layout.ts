import type {
  GitGraph,
  GitCommit,
  PositionedGitGraph,
  PositionedCommit,
  PositionedGitEdge,
  PositionedBranchLabel,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Git graph layout engine
//
// Self-contained — no ELK. Commits are placed left-to-right in chronological
// order (one column per commit) along horizontal lanes (one row per branch).
//
//   x = leftGutter + commitColumn * colGap
//   y = topGutter  + branchOrder  * laneGap
//
// Edges link each commit to its parents:
//   - first parent  → the branch line (colored by the commit's own branch)
//   - extra parents → merge / cherry-pick edges (colored by the source branch)
// ============================================================================

const G = {
  padding: 24,
  nodeR: 7,
  colGap: 46,
  laneGap: 52,
  /** Space above the top lane for tags. */
  tagSpace: 26,
  /** Space below each node for the commit-id label. */
  labelSpace: 22,
  labelFontSize: 11,
  labelFontWeight: 400,
  branchLabelFontSize: 12,
  branchLabelWeight: 600,
  branchLabelGap: 14,
} as const

/**
 * Lay out a parsed git graph by computing pixel geometry.
 */
export function layoutGitGraph(graph: GitGraph, _options: RenderOptions = {}): PositionedGitGraph {
  const orderOf = new Map<string, number>()
  for (const b of graph.branches) orderOf.set(b.name, b.order)

  // Left gutter sized to the widest branch label.
  let maxBranchLabelW = 0
  for (const b of graph.branches) {
    maxBranchLabelW = Math.max(
      maxBranchLabelW,
      estimateTextWidth(b.name, G.branchLabelFontSize, G.branchLabelWeight),
    )
  }
  const leftGutter = G.padding + maxBranchLabelW + G.branchLabelGap
  const topGutter = G.padding + G.tagSpace

  const laneY = (order: number): number => topGutter + order * laneGapWithRoom(graph)
  const colX = (col: number): number => leftGutter + col * G.colGap + G.nodeR

  // Position each commit.
  const byId = new Map<string, PositionedCommit>()
  const commits: PositionedCommit[] = []
  graph.commits.forEach((c, col) => {
    const order = orderOf.get(c.branch) ?? 0
    const pc: PositionedCommit = {
      id: c.id,
      label: c.id,
      x: colX(col),
      y: laneY(order),
      type: c.type,
      isMerge: c.isMerge,
      tag: c.tag,
      colorIndex: order,
    }
    commits.push(pc)
    byId.set(c.id, pc)
  })

  // Build edges parent → child.
  const edges: PositionedGitEdge[] = []
  graph.commits.forEach((c: GitCommit) => {
    const child = byId.get(c.id)
    if (!child) return
    c.parents.forEach((parentId, pi) => {
      const parent = byId.get(parentId)
      if (!parent) return
      // First parent follows the child's own branch color; merge / cherry-pick
      // sources are colored by the parent (source) branch.
      const colorIndex = pi === 0 ? child.colorIndex : parent.colorIndex
      edges.push({
        from: parentId,
        to: c.id,
        path: connector(parent.x, parent.y, child.x, child.y),
        colorIndex,
      })
    })
  })

  // Branch labels sit at the left gutter, aligned to each lane.
  const branchLabels: PositionedBranchLabel[] = graph.branches.map(b => ({
    name: b.name,
    x: G.padding,
    y: laneY(b.order),
    colorIndex: b.order,
  }))

  const lastX = commits.length ? Math.max(...commits.map(c => c.x)) : leftGutter
  const lastLane = graph.branches.length ? graph.branches.length - 1 : 0
  const width = lastX + G.nodeR + G.colGap / 2 + G.padding
  const height = laneY(lastLane) + G.nodeR + G.labelSpace + G.padding

  return { width, height, commits, edges, branchLabels }
}

/** Lane gap (kept as a function for symmetry / future per-graph tuning). */
function laneGapWithRoom(_graph: GitGraph): number {
  return G.laneGap
}

/**
 * Smooth connector from (x0,y0) → (x1,y1). Straight when colinear horizontally,
 * else a horizontal-tangent cubic bezier so branch/merge lines curve cleanly.
 */
function connector(x0: number, y0: number, x1: number, y1: number): string {
  if (Math.abs(y0 - y1) < 0.5) {
    return `M${r(x0)},${r(y0)} L${r(x1)},${r(y1)}`
  }
  const dx = (x1 - x0) / 2
  return `M${r(x0)},${r(y0)} C${r(x0 + dx)},${r(y0)} ${r(x1 - dx)},${r(y1)} ${r(x1)},${r(y1)}`
}

function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

export const GITGRAPH_LAYOUT = G
