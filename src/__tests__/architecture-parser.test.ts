/**
 * Parser tests for architecture (architecture-beta).
 */
import { describe, it, expect } from 'bun:test'
import { parseArchitecture } from '../architecture/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseArchitecture', () => {
  it('parses groups, services (icon + group membership), and edges', () => {
    const a = parseArchitecture(toLines(`architecture-beta
      group api(cloud)[API]
      service db(database)[Database] in api
      service server(server)[Server] in api
      db:R --> L:server`))

    expect(a.groups.map(g => g.id)).toEqual(['api'])
    expect(a.groups[0]).toMatchObject({ id: 'api', icon: 'cloud', title: 'API' })

    expect(a.services.map(s => s.id)).toEqual(['db', 'server'])
    expect(a.services[0]).toMatchObject({ id: 'db', icon: 'database', title: 'Database', group: 'api' })
    expect(a.services[1]).toMatchObject({ id: 'server', icon: 'server', title: 'Server', group: 'api' })

    expect(a.edges).toHaveLength(1)
    expect(a.edges[0]).toMatchObject({
      from: 'db', fromSide: 'R', to: 'server', toSide: 'L',
      arrowStart: false, arrowEnd: true,
    })
  })

  it('accepts the bare `architecture` header', () => {
    const a = parseArchitecture(toLines(`architecture
      service web(internet)[Web]`))
    expect(a.services.map(s => s.id)).toEqual(['web'])
  })

  it('parses nested groups and junctions, defaulting titles to ids', () => {
    const a = parseArchitecture(toLines(`architecture-beta
      group outer[Outer]
      group inner(cloud) in outer
      junction j in inner
      service plain in inner`))

    expect(a.groups.map(g => g.id)).toEqual(['outer', 'inner'])
    expect(a.groups[1]).toMatchObject({ id: 'inner', icon: 'cloud', parent: 'outer' })
    // No [Title] → title falls back to the id.
    expect(a.groups[1]!.title).toBe('inner')

    expect(a.junctions).toHaveLength(1)
    expect(a.junctions[0]).toMatchObject({ id: 'j', group: 'inner' })

    expect(a.services[0]).toMatchObject({ id: 'plain', title: 'plain', group: 'inner' })
    expect(a.services[0]!.icon).toBeUndefined()
  })

  it('parses plain edges and start/end arrow directions with all sides', () => {
    const a = parseArchitecture(toLines(`architecture-beta
      service a(server)[A]
      service b(server)[B]
      service c(server)[C]
      a:T -- B:b
      a:L <-- R:c`))

    expect(a.edges[0]).toMatchObject({
      from: 'a', fromSide: 'T', to: 'b', toSide: 'B', arrowStart: false, arrowEnd: false,
    })
    expect(a.edges[1]).toMatchObject({
      from: 'a', fromSide: 'L', to: 'c', toSide: 'R', arrowStart: true, arrowEnd: false,
    })
  })
})
