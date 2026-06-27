/**
 * Render tests for architecture (architecture-beta).
 * Exercises parse → layout → render directly (not via renderMermaidSVG).
 *
 * Layout is delegated to the bundled ELK engine, which CHOOSES node positions
 * and edge routes. Assertions are therefore behavior-based — orthogonality,
 * obstacle avoidance, endpoint sides, port fan-out, and the identity contract —
 * rather than pinned coordinates.
 */
import { describe, it, expect } from 'bun:test'
import { parseArchitecture } from '../architecture/parser.ts'
import { layoutArchitecture } from '../architecture/layout.ts'
import { renderArchitectureSvg } from '../architecture/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const layout = (src: string) => layoutArchitecture(parseArchitecture(toLines(src)))
const render = (src: string) => renderArchitectureSvg(layout(src), colors)

/** Every segment of an edge polyline must be strictly horizontal or vertical. */
const isOrthogonal = (pts: { x: number; y: number }[]) => {
  if (pts.length < 2) return false
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i]!.x - pts[i - 1]!.x)
    const dy = Math.abs(pts[i]!.y - pts[i - 1]!.y)
    if (dx > 0.05 && dy > 0.05) return false // diagonal segment
  }
  return true
}

type Pt = { x: number; y: number }
type BoxRect = { x: number; y: number; width: number; height: number }

/** Does any segment of `points` pass through the strict interior of `box`?
 *  A small inset means merely touching/running along a border is NOT a cross. */
const segmentsCrossBox = (points: Pt[], box: BoxRect, inset = 1.5): boolean => {
  const minX = box.x + inset, maxX = box.x + box.width - inset
  const minY = box.y + inset, maxY = box.y + box.height - inset
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    if (Math.abs(a.y - b.y) < 0.01) {
      // horizontal segment at y
      const y = a.y
      if (y <= minY || y >= maxY) continue
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x)
      if (Math.min(x2, maxX) - Math.max(x1, minX) > 0.5) return true
    } else {
      // vertical segment at x
      const x = a.x
      if (x <= minX || x >= maxX) continue
      const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
      if (Math.min(y2, maxY) - Math.max(y1, minY) > 0.5) return true
    }
  }
  return false
}

/** Is `p` on the named border line of `box` (within tolerance)? */
const onSide = (p: Pt, box: BoxRect, side: 'L' | 'R' | 'T' | 'B', tol = 0.6): boolean => {
  const x1 = box.x - tol, x2 = box.x + box.width + tol
  const y1 = box.y - tol, y2 = box.y + box.height + tol
  switch (side) {
    case 'L': return Math.abs(p.x - box.x) < tol && p.y >= y1 && p.y <= y2
    case 'R': return Math.abs(p.x - (box.x + box.width)) < tol && p.y >= y1 && p.y <= y2
    case 'T': return Math.abs(p.y - box.y) < tol && p.x >= x1 && p.x <= x2
    case 'B': return Math.abs(p.y - (box.y + box.height)) < tol && p.x >= x1 && p.x <= x2
  }
}

describe('renderArchitectureSvg', () => {
  it('renders an svg with addressable nodes, edges, and icon glyphs', () => {
    const svg = render(`architecture-beta
      group api(cloud)[API]
      service db(database)[Database] in api
      service server(server)[Server] in api
      db:R --> L:server`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')

    // Identity contract: groups + services addressable, edges carry endpoints.
    expect(svg).toContain('data-id="api"')
    expect(svg).toContain('data-id="db"')
    expect(svg).toContain('data-id="server"')
    expect(svg).toContain('data-from="db"')
    expect(svg).toContain('data-to="server"')

    // A service icon glyph rendered via the shared registry.
    expect(svg).toContain('bm-icon')
    expect(svg).toContain('arch-icon')

    // No hardcoded palette leaks — uses theme CSS variables.
    expect(svg).toContain('var(--_text)')
    expect(svg).toContain('var(--_line)')
  })

  it('renders junctions and nested groups, routing edges orthogonally', () => {
    const src = `architecture-beta
      group outer[Outer]
      group inner in outer
      junction j in inner
      service web(internet)[Web] in inner
      web:B -- T:j`
    const pos = layout(src)
    const svg = renderArchitectureSvg(pos, colors)

    expect(svg).toContain('data-id="outer"')
    expect(svg).toContain('data-id="inner"')
    expect(svg).toContain('data-id="j"')
    expect(svg).toContain('data-id="web"')
    expect(svg).toContain('data-from="web"')
    expect(svg).toContain('data-to="j"')

    // Nested groups are both emitted as containers.
    expect(pos.groups.map(g => g.id).sort()).toEqual(['inner', 'outer'])
    // The junction exists as an (invisible) addressable routing point.
    expect(pos.junctions.map(j => j.id)).toEqual(['j'])

    // The single edge routes orthogonally and connects web to the junction.
    const e = pos.edges.find(x => x.from === 'web' && x.to === 'j')!
    expect(e).toBeDefined()
    expect(isOrthogonal(e.points)).toBe(true)
  })

  it('routes a service↔service edge orthogonally onto the named sides', () => {
    const pos = layout(`architecture-beta
      group cloud(cloud)[Cloud]
      service web(server)[Web] in cloud
      service db(database)[DB] in cloud
      service disk(disk)[Storage] in cloud
      web:R -- L:db
      db:B -- T:disk`)

    const byId = new Map(pos.services.map(s => [s.id, s]))
    const web = byId.get('web')!, db = byId.get('db')!, disk = byId.get('disk')!

    const webDb = pos.edges.find(e => e.from === 'web' && e.to === 'db')!
    expect(isOrthogonal(webDb.points)).toBe(true)
    // Starts on web's right side, ends on db's left side.
    expect(onSide(webDb.points[0]!, web, 'R')).toBe(true)
    expect(onSide(webDb.points.at(-1)!, db, 'L')).toBe(true)

    const dbDisk = pos.edges.find(e => e.from === 'db' && e.to === 'disk')!
    expect(isOrthogonal(dbDisk.points)).toBe(true)
    // Starts on db's bottom side, ends on disk's top side.
    expect(onSide(dbDisk.points[0]!, db, 'B')).toBe(true)
    expect(onSide(dbDisk.points.at(-1)!, disk, 'T')).toBe(true)
  })

  it('keeps junctions out of service boxes and routes its edges cleanly', () => {
    const src = `architecture-beta
      group net(internet)[Network]
      service gateway(server)[Gateway] in net
      service api1(server)[API 1] in net
      service api2(server)[API 2] in net
      junction j in net
      gateway:B -- T:j
      j:L -- T:api1
      j:R -- T:api2`
    const pos = layout(src)

    // Junction must NOT overlap any service box.
    const j = pos.junctions[0]!
    const jRect = { x: j.x, y: j.y, w: j.size, h: j.size }
    const overlaps = (a: typeof jRect, b: { x: number; y: number; width: number; height: number }) =>
      a.x < b.x + b.width && a.x + a.w > b.x && a.y < b.y + b.height && a.y + a.h > b.y
    for (const s of pos.services) {
      expect(overlaps(jRect, s)).toBe(false)
    }

    // Every edge is orthogonal and no edge cuts through a non-endpoint service.
    for (const e of pos.edges) {
      expect(isOrthogonal(e.points)).toBe(true)
      for (const s of pos.services) {
        if (s.id === e.from || s.id === e.to) continue
        expect(segmentsCrossBox(e.points, s)).toBe(false)
      }
    }

    const svg = renderArchitectureSvg(pos, colors)
    expect(svg).toContain('<svg')
    // Junction is an invisible routing point but stays addressable.
    expect(svg).toContain('data-id="j"')
    expect(svg).toContain('var(--_line)')
  })

  it('routes nested edges around non-endpoint boxes (cdn reaches web, not db)', () => {
    const src = `architecture-beta
      group cloud(cloud)[Cloud]
      group region(server)[Region A] in cloud
      service web(server)[Web] in region
      service db(database)[DB] in region
      service cdn(internet)[CDN] in cloud
      cdn:L --> T:web
      web:R --> L:db`
    const arch = parseArchitecture(toLines(src))
    const pos = layoutArchitecture(arch)
    const byId = new Map(pos.services.map(s => [s.id, s]))

    // No edge segment may cross a service box that is not its own endpoint.
    for (const e of pos.edges) {
      for (const s of pos.services) {
        if (s.id === e.from || s.id === e.to) continue
        expect(segmentsCrossBox(e.points, s)).toBe(false)
      }
      expect(isOrthogonal(e.points)).toBe(true)
    }

    // The cdn→web edge specifically must not cut through db.
    const cdnWeb = pos.edges.find(e => e.from === 'cdn' && e.to === 'web')!
    expect(segmentsCrossBox(cdnWeb.points, byId.get('db')!)).toBe(false)

    // Endpoints terminate on the named-side of each box.
    for (const ae of arch.edges) {
      const pe = pos.edges.find(e => e.from === ae.from && e.to === ae.to)!
      expect(onSide(pe.points[0]!, byId.get(ae.from)!, ae.fromSide)).toBe(true)
      expect(onSide(pe.points.at(-1)!, byId.get(ae.to)!, ae.toSide)).toBe(true)
    }
  })

  it('distributes ports and avoids boxes in a microservices layout (example B)', () => {
    const src = `architecture-beta
      group edge(internet)[Edge]
      group svc(cloud)[Services]
      group data(disk)[Data]
      service gw(server)[Gateway] in edge
      service users(server)[Users] in svc
      service orders(server)[Orders] in svc
      service db(database)[DB] in data
      service cache(database)[Cache] in data
      gw:R --> L:users
      users:R --> L:orders
      users:B --> T:cache
      users:B --> T:db
      orders:B --> T:db`
    const arch = parseArchitecture(toLines(src))
    const pos = layoutArchitecture(arch)
    const byId = new Map(pos.services.map(s => [s.id, s]))

    // No edge crosses a non-endpoint service box.
    for (const e of pos.edges) {
      for (const s of pos.services) {
        if (s.id === e.from || s.id === e.to) continue
        expect(segmentsCrossBox(e.points, s)).toBe(false)
      }
      expect(isOrthogonal(e.points)).toBe(true)
    }

    // Port distribution: the two edges leaving users' bottom side start at
    // DISTINCT points (fanned across the side, not stacked).
    const uCache = pos.edges.find(e => e.from === 'users' && e.to === 'cache')!
    const uDb = pos.edges.find(e => e.from === 'users' && e.to === 'db')!
    const users = byId.get('users')!
    expect(onSide(uCache.points[0]!, users, 'B')).toBe(true)
    expect(onSide(uDb.points[0]!, users, 'B')).toBe(true)
    expect(Math.abs(uCache.points[0]!.x - uDb.points[0]!.x)).toBeGreaterThan(1)

    // Endpoints terminate on the named-side of each box.
    for (const ae of arch.edges) {
      const pe = pos.edges.find(e => e.from === ae.from && e.to === ae.to)!
      expect(onSide(pe.points[0]!, byId.get(ae.from)!, ae.fromSide)).toBe(true)
      expect(onSide(pe.points.at(-1)!, byId.get(ae.to)!, ae.toSide)).toBe(true)
    }

    // Edges still carry their endpoint identity in the rendered SVG.
    const svg = renderArchitectureSvg(pos, colors)
    expect(svg).toContain('data-from="users"')
    expect(svg).toContain('data-to="cache"')
    expect(svg).toContain('data-to="db"')
  })
})
