import type { TreeView, TreeNode, PositionedTreeView, PositionedTreeRow, TreeConnector } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// TreeView layout engine
//
// Self-contained indented-list layout — no ELK. The tree is flattened into a
// DFS-ordered list of rows (file-explorer style): one row per node, each
// indented horizontally by its depth, stacked vertically. Parent→child elbow
// connectors are derived from the glyph centers.
// ============================================================================

const L = {
  padding: 24,
  rowHeight: 26,
  /** Horizontal indent added per nesting level */
  indentWidth: 24,
  /** Square slot reserved for the folder/file glyph */
  glyphSize: 16,
  /** Gap between the glyph slot and the label text */
  glyphTextGap: 8,
  /** Gap between the label and its inline description */
  descGap: 10,
  titleHeight: 36,
  titleFontSize: 16,
  labelFontSize: 14,
  folderFontWeight: 600,
  fileFontWeight: 400,
  descFontSize: 13,
} as const

/**
 * Lay out a parsed treeView into positioned rows + connectors.
 */
export function layoutTreeView(tree: TreeView, _options: RenderOptions = {}): PositionedTreeView {
  const hasTitle = !!tree.title
  const top = L.padding + (hasTitle ? L.titleHeight : 0)

  const rows: PositionedTreeRow[] = []
  const centerByPath = new Map<string, number>()
  let maxRight = 0

  // Flatten the forest in DFS order, assigning one row index per node.
  let rowIndex = 0
  const visit = (node: TreeNode, parentPath?: string): void => {
    const rowCenterY = top + rowIndex * L.rowHeight + L.rowHeight / 2
    const glyphX = L.padding + node.depth * L.indentWidth
    const glyphY = rowCenterY - L.glyphSize / 2
    const textX = glyphX + L.glyphSize + L.glyphTextGap

    const weight = node.isFolder ? L.folderFontWeight : L.fileFontWeight
    const labelW = estimateTextWidth(node.label, L.labelFontSize, weight)
    const descX = textX + labelW + L.descGap
    const right = node.description
      ? descX + estimateTextWidth(node.description, L.descFontSize, 400)
      : textX + labelW
    maxRight = Math.max(maxRight, right)

    rows.push({
      path: node.path,
      parentPath,
      label: node.label,
      description: node.description,
      isFolder: node.isFolder,
      depth: node.depth,
      glyphX,
      glyphY,
      textX,
      descX,
      rowCenterY,
    })
    centerByPath.set(node.path, rowCenterY)
    rowIndex += 1

    for (const child of node.children) visit(child, node.path)
  }
  for (const root of tree.nodes) visit(root)

  // Elbow connectors: vertical drop under the parent glyph center, then a
  // horizontal stub across to the child glyph.
  const connectors: TreeConnector[] = []
  for (const row of rows) {
    if (!row.parentPath) continue
    const parentCenterY = centerByPath.get(row.parentPath)
    if (parentCenterY == null) continue
    const guideX = L.padding + (row.depth - 1) * L.indentWidth + L.glyphSize / 2
    const startY = parentCenterY + L.glyphSize / 2
    const d = `M${rr(guideX)},${rr(startY)} V${rr(row.rowCenterY)} H${rr(row.glyphX)}`
    connectors.push({ from: row.parentPath, to: row.path, d })
  }

  const width = maxRight + L.padding
  const height = top + rows.length * L.rowHeight + L.padding

  return {
    width,
    height,
    title: hasTitle
      ? { text: tree.title!, x: L.padding, y: L.padding + L.titleFontSize }
      : undefined,
    rows,
    connectors,
  }
}

function rr(n: number): string {
  return String(Math.round(n * 10) / 10)
}

export const TREEVIEW_LAYOUT = L
