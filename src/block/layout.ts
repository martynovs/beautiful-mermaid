import type {
  BlockDiagram, PositionedBlockDiagram, PositionedBlock, PositionedBlockEdge,
} from './types.ts'
import type { Point } from '../types.ts'
import type { RenderOptions } from '../types.ts'
import { FONT_SIZES, FONT_WEIGHTS, NODE_PADDING, estimateTextWidth } from '../styles.ts'

// ============================================================================
// Block diagram layout engine
//
// Computes pixel coordinates for a uniform grid of blocks. No ELK needed —
// every cell is the same size; (col, row) maps directly to pixel x/y.
// Edges are straight lines clipped to the block borders.
// ============================================================================

const BLOCK = {
  /** Canvas padding around the grid */
  padding: 40,
  /** Horizontal gap between adjacent cells */
  gapX: 36,
  /** Vertical gap between adjacent cells */
  gapY: 36,
  /** Block height */
  blockHeight: 48,
  /** Minimum block width */
  minBlockWidth: 80,
} as const

/**
 * Lay out a parsed block diagram by computing pixel coordinates.
 * Cell size is uniform: derived from the widest label.
 */
export function layoutBlockDiagram(
  diagram: BlockDiagram,
  options: RenderOptions = {},
): PositionedBlockDiagram {
  const padding = options.padding ?? BLOCK.padding
  const gapX = options.nodeSpacing ?? BLOCK.gapX
  const gapY = options.layerSpacing ?? BLOCK.gapY

  // Uniform cell width fits the widest label.
  const labelMax = Math.max(
    0,
    ...diagram.blocks.map(b =>
      estimateTextWidth(b.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel),
    ),
  )
  const blockWidth = Math.max(BLOCK.minBlockWidth, Math.ceil(labelMax) + NODE_PADDING.horizontal * 2)
  const blockHeight = BLOCK.blockHeight

  const rows = diagram.blocks.reduce((mx, b) => Math.max(mx, b.row + 1), 0)
  const cols = diagram.columns

  const cellX = (col: number) => padding + col * (blockWidth + gapX)
  const cellY = (row: number) => padding + row * (blockHeight + gapY)

  const blocks: PositionedBlock[] = diagram.blocks.map(b => ({
    id: b.id,
    label: b.label,
    x: cellX(b.col),
    y: cellY(b.row),
    width: blockWidth,
    height: blockHeight,
  }))

  // Index by id for edge endpoint lookup.
  const byId = new Map<string, PositionedBlock>()
  for (const b of blocks) byId.set(b.id, b)

  const edges: PositionedBlockEdge[] = []
  for (const e of diagram.edges) {
    const a = byId.get(e.source)
    const b = byId.get(e.target)
    if (!a || !b) continue
    const ca = center(a)
    const cb = center(b)
    edges.push({
      source: e.source,
      target: e.target,
      points: [borderPoint(a, cb), borderPoint(b, ca)],
    })
  }

  const width = padding * 2 + cols * blockWidth + (cols - 1) * gapX
  const height = padding * 2 + rows * blockHeight + (Math.max(rows, 1) - 1) * gapY

  return { width, height, blocks, edges }
}

function center(b: PositionedBlock): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/**
 * Find where the ray from the center of `rect` toward `towards` exits the
 * rectangle border. Used so edges touch block edges, not their centers.
 */
function borderPoint(rect: PositionedBlock, towards: Point): Point {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const dx = towards.x - cx
  const dy = towards.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const halfW = rect.width / 2
  const halfH = rect.height / 2
  // Scale factor that lands the ray on whichever border it hits first.
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)

  return { x: cx + dx * scale, y: cy + dy * scale }
}
