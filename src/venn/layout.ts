import type {
  VennDiagram,
  PositionedVennDiagram,
  PositionedVennSet,
  PositionedVennUnion,
} from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Venn diagram layout engine
//
// Places set circles geometrically (no ELK needed):
//   - 1 set:  a single circle
//   - 2 sets: two equal circles overlapping side by side
//   - 3 sets: three equal circles in a triangular arrangement
//   - N > 3:  an overlapping horizontal row (best-effort fallback)
//
// Set labels sit toward each circle's outer (non-overlapping) edge; union
// labels sit at the centroid of their member set centers (the overlap region).
// ============================================================================

const V = {
  radius: 120,
  padding: 28,
  titleHeight: 40,
  titleFontSize: 18,
  /** Distance of the set label from the circle center, as a fraction of r */
  setLabelRadius: 0.62,
} as const

/**
 * Lay out a parsed venn diagram by computing pixel geometry.
 */
export function layoutVennDiagram(
  diagram: VennDiagram,
  _options: RenderOptions = {},
): PositionedVennDiagram {
  const R = V.radius
  const rels = setCenters(diagram.sets.length, R)

  // Bounding box of all circles (around the origin-centered relative layout).
  let minX = 0
  let minY = 0
  let maxX = R * 2
  let maxY = R * 2
  if (rels.length > 0) {
    minX = Infinity
    minY = Infinity
    maxX = -Infinity
    maxY = -Infinity
    for (const [x, y] of rels) {
      minX = Math.min(minX, x - R)
      maxX = Math.max(maxX, x + R)
      minY = Math.min(minY, y - R)
      maxY = Math.max(maxY, y + R)
    }
  }

  const hasTitle = !!diagram.title
  const offsetX = V.padding - minX
  const offsetY = V.padding + (hasTitle ? V.titleHeight : 0) - minY

  const sets: PositionedVennSet[] = diagram.sets.map((s, i) => {
    const [rx, ry] = rels[i]!
    const cx = rx + offsetX
    const cy = ry + offsetY

    // Outward unit vector from the layout centroid (origin) → outer edge.
    let ux = rx
    let uy = ry
    const mag = Math.hypot(ux, uy)
    if (mag < 1e-6) {
      ux = 0
      uy = -1 // single set: label at the top
    } else {
      ux /= mag
      uy /= mag
    }

    return {
      id: s.id,
      label: s.label,
      cx,
      cy,
      r: R,
      colorIndex: i,
      labelX: cx + ux * R * V.setLabelRadius,
      labelY: cy + uy * R * V.setLabelRadius,
    }
  })

  const byId = new Map(sets.map(s => [s.id, s]))

  const unions: PositionedVennUnion[] = diagram.unions.map(u => {
    const members = u.setIds
      .map(id => byId.get(id))
      .filter((m): m is PositionedVennSet => !!m)
    // Anchor at the centroid of the member circle centers. For a pair this is
    // the midpoint of those two specific circles — i.e. the center of their
    // overlap lens — so each pairwise region sits in its own lens rather than
    // stacking near the diagram center.
    let x: number
    let y: number
    if (members.length > 0) {
      x = members.reduce((a, m) => a + m.cx, 0) / members.length
      y = members.reduce((a, m) => a + m.cy, 0) / members.length
    } else {
      x = offsetX
      y = offsetY
    }
    return {
      id: u.id,
      setIds: u.setIds,
      // Explicit label only; the derived `A ∩ B` caption is dropped on purpose.
      label: u.label ?? '',
      x,
      y,
    }
  })

  const width = maxX - minX + V.padding * 2
  const height = maxY - minY + V.padding * 2 + (hasTitle ? V.titleHeight : 0)

  return {
    width,
    height,
    title: hasTitle
      ? { text: diagram.title!, x: width / 2, y: V.padding + V.titleFontSize }
      : undefined,
    sets,
    unions,
  }
}

/**
 * Relative circle centers (around the origin) for `n` sets.
 */
function setCenters(n: number, R: number): Array<[number, number]> {
  if (n <= 1) return [[0, 0]]

  if (n === 2) {
    const d = R * 0.92 // distance between the two centers
    return [
      [-d / 2, 0],
      [d / 2, 0],
    ]
  }

  if (n === 3) {
    const side = R * 1.05 // distance between adjacent centers
    const rho = side / Math.sqrt(3) // circumradius of the equilateral triangle
    // top, bottom-right, bottom-left
    return [-90, 30, 150].map(deg => {
      const a = (deg * Math.PI) / 180
      return [rho * Math.cos(a), rho * Math.sin(a)] as [number, number]
    })
  }

  // N > 3: best-effort overlapping row.
  const d = R * 0.9
  return Array.from(
    { length: n },
    (_, i) => [(i - (n - 1) / 2) * d, 0] as [number, number],
  )
}

export const VENN_LAYOUT = V
