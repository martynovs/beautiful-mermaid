import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  Architecture, ArchGroup, ArchService, ArchJunction, Side,
  PositionedArchitecture, PositionedArchGroup, PositionedArchService,
  PositionedArchJunction, PositionedArchEdge, Point,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, ARROW_HEAD } from '../styles.ts'
import { elkLayoutSync } from '../elk-instance.ts'

// ============================================================================
// Architecture (architecture-beta) layout engine — ELK powered
//
// Builds an ELK `layered` graph from the parsed Architecture model and lets the
// bundled ELK engine (the same one that drives flowchart/class/state/er) do the
// hierarchical placement and obstacle-avoiding ORTHOGONAL edge routing:
//
//   • Each GROUP becomes a compound ELK node (a container). Header space is
//     reserved with asymmetric padding so the title band is never overlapped.
//   • Each SERVICE becomes a fixed-size leaf node with FIXED_SIDE ports — one
//     port per (side, edge) so a side with several edges fans out automatically.
//   • Each JUNCTION becomes a tiny 1×1 leaf; edges attach to it directly.
//   • Each EDGE is an ElkExtendedEdge declared at the root; INCLUDE_CHILDREN
//     hierarchy handling lets ELK route freely across group boundaries.
//
// The ELK result is then walked (accumulating absolute offsets, since ELK
// reports child x/y relative to the parent) and mapped back onto the existing
// Positioned* shapes the renderer consumes — icon/label geometry is recomputed
// with the same formulas the old hand-rolled layout used.
// ============================================================================

const A = {
  /** Canvas padding around all content. */
  padding: 32,
  /** Inner padding inside a group container. */
  groupPad: 18,
  /** Group header band height (holds the title). */
  headerH: 26,
  /** Minimum service box width. */
  serviceMinW: 92,
  /** Service box height. */
  serviceH: 84,
  /** Icon edge length inside a service. */
  iconSize: 38,
  /** Top padding above the icon inside a service. */
  serviceTopPad: 12,
  /** Gap between the icon and the label. */
  serviceIconGap: 8,
  /** Junction node size. */
  junctionSize: 18,
  serviceLabelSize: 12,
  serviceLabelWeight: 500,
  /** Space between sibling nodes within a layer. */
  nodeNode: 40,
  /** Space between layers (the flow direction). */
  layerSpacing: 50,
} as const

/** Coordinate equality tolerance for polyline simplification. */
const EPS = 0.01

/** Map a parsed side onto ELK's port-side enum. */
const ELK_SIDE: Record<Side, string> = { L: 'WEST', R: 'EAST', T: 'NORTH', B: 'SOUTH' }

interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
  ports?: Array<{ id: string; layoutOptions?: LayoutOptions; width?: number; height?: number }>
  layoutOptions?: LayoutOptions
}

/**
 * Lay out a parsed architecture diagram into absolute pixel geometry using ELK.
 */
export function layoutArchitecture(
  arch: Architecture,
  options: RenderOptions = {},
): PositionedArchitecture {
  const padding = options.padding ?? A.padding

  const groupById = new Map(arch.groups.map(g => [g.id, g]))
  const serviceById = new Map(arch.services.map(s => [s.id, s]))
  const junctionById = new Map(arch.junctions.map(j => [j.id, j]))
  const isJunction = (id: string): boolean => junctionById.has(id)
  const knownId = (id: string): boolean =>
    groupById.has(id) || serviceById.has(id) || junctionById.has(id)

  // ---- Resolve container membership (dangling parents fall back to top) ----
  const parentOf = (id: string): string | undefined => {
    const raw = groupById.get(id)?.parent ?? serviceById.get(id)?.group ?? junctionById.get(id)?.group
    return raw !== undefined && groupById.has(raw) ? raw : undefined
  }

  // Children ids of a container (undefined = top level), in declaration order.
  type Entity = { id: string; kind: 'group' | 'service' | 'junction'; seq: number }
  const entities: Entity[] = [
    ...arch.groups.map(g => ({ id: g.id, kind: 'group' as const, seq: g.seq })),
    ...arch.services.map(s => ({ id: s.id, kind: 'service' as const, seq: s.seq })),
    ...arch.junctions.map(j => ({ id: j.id, kind: 'junction' as const, seq: j.seq })),
  ].sort((a, b) => a.seq - b.seq)

  const childrenOf = (pid: string | undefined): Entity[] =>
    entities.filter(e => parentOf(e.id) === pid)

  // ---- Ports: one per (service-end, side); multiple on a side ⇒ fan-out ----
  // Reserve a deterministic port id for every edge endpoint that lands on a
  // service. Junction endpoints attach to the junction node directly (no port).
  const servicePorts = new Map<string, Array<{ id: string; side: Side }>>()
  const endpointPort = new Map<string, string>() // `${edgeIdx}:${'from'|'to'}` → portId
  const sideCount = new Map<string, number>()      // `${svcId}:${side}` → next index

  const allocPort = (svcId: string, side: Side, edgeIdx: number, end: 'from' | 'to'): void => {
    const key = `${svcId}:${side}`
    const n = sideCount.get(key) ?? 0
    sideCount.set(key, n + 1)
    const portId = `${svcId}__${side}__${n}`
    const list = servicePorts.get(svcId) ?? []
    list.push({ id: portId, side })
    servicePorts.set(svcId, list)
    endpointPort.set(`${edgeIdx}:${end}`, portId)
  }

  arch.edges.forEach((edge, idx) => {
    if (!knownId(edge.from) || !knownId(edge.to)) return
    if (serviceById.has(edge.from)) allocPort(edge.from, edge.fromSide, idx, 'from')
    if (serviceById.has(edge.to)) allocPort(edge.to, edge.toSide, idx, 'to')
  })

  // ---- Assign each edge to its endpoints' lowest common ancestor group ----
  // ELK reports an edge's section coordinates relative to the deepest node that
  // contains BOTH endpoints (its LCA), so the edge must be declared inside that
  // node for the offset accumulation in walkEdges to come out right. (Declaring
  // every edge at the root mis-places intra-group edges.) `undefined` = root.
  const ancestors = (id: string): string[] => {
    const chain: string[] = []
    let cur = parentOf(id)
    while (cur !== undefined) { chain.push(cur); cur = parentOf(cur) }
    return chain // immediate container first (deepest), root-most last
  }
  const lcaOf = (from: string, to: string): string | undefined => {
    const at = new Set(ancestors(to))
    return ancestors(from).find(g => at.has(g))
  }
  const edgesByContainer = new Map<string | undefined, ElkExtendedEdge[]>()
  arch.edges.forEach((edge, idx) => {
    if (!knownId(edge.from) || !knownId(edge.to)) return
    const source = isJunction(edge.from) ? edge.from : endpointPort.get(`${idx}:from`)!
    const target = isJunction(edge.to) ? edge.to : endpointPort.get(`${idx}:to`)!
    const elkEdge: ElkExtendedEdge = { id: `e${idx}`, sources: [source], targets: [target] }
    const lca = lcaOf(edge.from, edge.to)
    const list = edgesByContainer.get(lca) ?? []
    list.push(elkEdge)
    edgesByContainer.set(lca, list)
  })

  // ---- Build the ELK node tree ----
  const buildNode = (e: Entity): ElkGraphNode => {
    if (e.kind === 'service') {
      const svc = serviceById.get(e.id)!
      const ports = (servicePorts.get(e.id) ?? []).map(p => ({
        id: p.id,
        width: 0,
        height: 0,
        layoutOptions: { 'elk.port.side': ELK_SIDE[p.side] } as LayoutOptions,
      }))
      return {
        id: e.id,
        width: serviceWidth(svc.title),
        height: A.serviceH,
        layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
        ports,
      }
    }
    if (e.kind === 'junction') {
      return { id: e.id, width: A.junctionSize, height: A.junctionSize }
    }
    // Group container: reserve header space via asymmetric top padding.
    return {
      id: e.id,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.padding': `[top=${A.headerH + A.groupPad},left=${A.groupPad},bottom=${A.groupPad},right=${A.groupPad}]`,
        'elk.spacing.nodeNode': String(A.nodeNode),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(A.layerSpacing),
      },
      children: childrenOf(e.id).map(buildNode),
      edges: edgesByContainer.get(e.id) ?? [],
    }
  }

  const root: ElkGraphNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': String(A.nodeNode),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(A.layerSpacing),
      'elk.spacing.edgeEdge': '12',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
      'elk.layered.spacing.edgeNodeBetweenLayers': '12',
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
    },
    children: childrenOf(undefined).map(buildNode),
    edges: edgesByContainer.get(undefined) ?? [],
  }

  const result = elkLayoutSync(root) as ElkGraphNode

  // ---- Map ELK result back to Positioned* shapes ----
  const outGroups: PositionedArchGroup[] = []
  const outServices: PositionedArchService[] = []
  const outJunctions: PositionedArchJunction[] = []

  const walkNodes = (node: ElkGraphNode, ax: number, ay: number): void => {
    for (const c of node.children ?? []) {
      const x = ax + (c.x ?? 0)
      const y = ay + (c.y ?? 0)
      const w = c.width ?? 0
      const h = c.height ?? 0
      if (groupById.has(c.id)) {
        const g = groupById.get(c.id)!
        outGroups.push({
          id: g.id, title: g.title, icon: g.icon,
          x, y, width: w, height: h,
          titleX: x + A.groupPad,
          titleY: y + A.headerH / 2 + A.serviceLabelSize / 2,
        })
        walkNodes(c, x, y)
      } else if (junctionById.has(c.id)) {
        outJunctions.push({ id: c.id, x, y, size: w })
      } else if (serviceById.has(c.id)) {
        const svc = serviceById.get(c.id)!
        const iconX = x + (w - A.iconSize) / 2
        const iconY = y + A.serviceTopPad
        outServices.push({
          id: svc.id, title: svc.title, icon: svc.icon,
          x, y, width: w, height: h,
          iconX, iconY, iconSize: A.iconSize,
          labelX: x + w / 2,
          labelY: iconY + A.iconSize + A.serviceIconGap + A.serviceLabelSize / 2,
        })
      }
    }
  }
  walkNodes(result, 0, 0)

  // ---- Edge routes: section points offset by the edge container's abs pos ----
  const edgeRoutes = new Map<string, Point[]>()
  const walkEdges = (node: ElkGraphNode, ax: number, ay: number): void => {
    for (const e of node.edges ?? []) {
      const sec = e.sections?.[0]
      if (!sec) continue
      const raw: Point[] = [
        sec.startPoint,
        ...(sec.bendPoints ?? []),
        sec.endPoint,
      ].map(p => ({ x: p.x + ax, y: p.y + ay }))
      edgeRoutes.set(e.id, simplify(raw))
    }
    for (const c of node.children ?? []) {
      walkEdges(c, ax + (c.x ?? 0), ay + (c.y ?? 0))
    }
  }
  walkEdges(result, 0, 0)

  const edges: PositionedArchEdge[] = []
  arch.edges.forEach((edge, idx) => {
    const pts = edgeRoutes.get(`e${idx}`)
    if (!pts || pts.length < 2) return
    edges.push({
      from: edge.from,
      to: edge.to,
      arrowStart: edge.arrowStart,
      arrowEnd: edge.arrowEnd,
      points: pts,
    })
  })

  // ---- Overall dimensions: ELK bounds, expanded to cover all geometry ----
  let width = result.width ?? 0
  let height = result.height ?? 0
  const margin = ARROW_HEAD.width + padding
  for (const e of edges) {
    for (const p of e.points) {
      width = Math.max(width, p.x + margin)
      height = Math.max(height, p.y + margin)
    }
  }
  for (const s of outServices) {
    width = Math.max(width, s.x + s.width + padding)
    height = Math.max(height, s.y + s.height + padding)
  }
  for (const g of outGroups) {
    width = Math.max(width, g.x + g.width + padding)
    height = Math.max(height, g.y + g.height + padding)
  }

  return {
    width,
    height,
    groups: outGroups,
    services: outServices,
    junctions: outJunctions,
    edges,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function serviceWidth(title: string): number {
  const labelW = estimateTextWidth(title, A.serviceLabelSize, A.serviceLabelWeight)
  return Math.max(A.serviceMinW, Math.ceil(labelW) + 16)
}

/** Drop duplicate and colinear interior points so the polyline is minimal. */
function simplify(pts: Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) continue
    out.push(p)
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1]!, b = out[i]!, c = out[i + 1]!
    const colinearX = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS
    const colinearY = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS
    if (colinearX || colinearY) out.splice(i, 1)
  }
  return out
}

export const ARCH_LAYOUT = A
