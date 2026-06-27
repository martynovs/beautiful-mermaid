import type { BlockDiagram, BlockNode, BlockEdge } from './types.ts'

// ============================================================================
// Block diagram parser
//
// Parses Mermaid block-beta syntax into a typed BlockDiagram structure.
//
// Supported syntax:
//   block-beta
//     columns N                       — sets the grid width
//     Id["Label"] space Other["..."]  — a row of cells (left to right)
//     space space space               — empty cells
//     A --> B                         — an edge between two blocks
//
// Semantics:
//   - `columns N` sets the grid width.
//   - Each subsequent non-edge line is one grid row; cells fill left to right.
//   - A cell is `Id["Label"]` (a block), bare `Id` (label == id), or the
//     keyword `space` (an empty cell that still consumes a grid slot).
//   - Lines containing `-->` are edges, parsed by block id.
// ============================================================================

// Matches a single cell token:
//   group 1 + 2 → Id["Label"]
//   group 3     → bare Id  (or the keyword `space`)
const CELL_RE = /([A-Za-z0-9_]+)\["([^"]*)"\]|([A-Za-z0-9_]+)/g

/**
 * Parse a Mermaid block-beta diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseBlockDiagram(lines: string[]): BlockDiagram {
  let columns = 1
  const blocks: BlockNode[] = []
  const edges: BlockEdge[] = []
  let row = 0

  for (const line of lines) {
    // Header line — skip
    if (/^block(-beta)?\b/i.test(line)) continue

    // columns N
    const colMatch = line.match(/^columns\s+(\d+)/i)
    if (colMatch) {
      columns = Math.max(1, parseInt(colMatch[1]!, 10))
      continue
    }

    // Edge line: A --> B
    const edgeMatch = line.match(/^([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/)
    if (edgeMatch) {
      edges.push({ source: edgeMatch[1]!, target: edgeMatch[2]! })
      continue
    }

    // Otherwise: a row of cells. Fill columns left to right.
    let col = 0
    CELL_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CELL_RE.exec(line)) !== null) {
      const bracketId = m[1]
      const label = m[2]
      const bareId = m[3]

      if (bracketId !== undefined) {
        blocks.push({ id: bracketId, label: label ?? bracketId, col, row })
      } else if (bareId !== undefined && bareId.toLowerCase() !== 'space') {
        blocks.push({ id: bareId, label: bareId, col, row })
      }
      // `space` (or any token) still consumes a grid slot.
      col++
    }
    row++
  }

  return { columns, blocks, edges }
}
