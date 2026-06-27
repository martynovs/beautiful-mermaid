/**
 * Parser tests for wardley maps (wardley-beta).
 */
import { describe, it, expect } from 'bun:test'
import { parseWardleyMap } from '../wardley/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const SRC = `wardley-beta
  title Tea Shop
  anchor Customer [0.95, 0.5]
  component Cup of Tea [0.9, 0.6]
  component Hot Water [0.5, 0.75]
  component Kettle [0.4, 0.55]
  Customer -> Cup of Tea
  Cup of Tea -> Hot Water
  Hot Water -.-> Kettle`

describe('parseWardleyMap', () => {
  const map = parseWardleyMap(toLines(SRC))

  it('skips the header and parses the title', () => {
    expect(map.title).toBe('Tea Shop')
  })

  it('parses components with [visibility, evolution] coordinates', () => {
    expect(map.components).toHaveLength(4)
    expect(map.components[1]).toEqual({
      name: 'Cup of Tea',
      visibility: 0.9,
      evolution: 0.6,
      kind: 'component',
    })
  })

  it('parses anchor nodes as kind=anchor', () => {
    const anchor = map.components.find(c => c.name === 'Customer')
    expect(anchor?.kind).toBe('anchor')
    expect(anchor?.visibility).toBe(0.95)
    expect(anchor?.evolution).toBe(0.5)
  })

  it('parses dependency links with from/to and style', () => {
    expect(map.links).toHaveLength(3)
    expect(map.links[0]).toMatchObject({ from: 'Customer', to: 'Cup of Tea', style: 'solid' })
    expect(map.links[2]).toMatchObject({ from: 'Hot Water', to: 'Kettle', style: 'dashed' })
  })

  it('parses a bare component without the keyword', () => {
    const m = parseWardleyMap(toLines('wardley\n  Widget [0.3, 0.8]'))
    expect(m.components[0]).toEqual({ name: 'Widget', visibility: 0.3, evolution: 0.8, kind: 'component' })
  })

  it('clamps out-of-range coordinates into 0..1', () => {
    const m = parseWardleyMap(toLines('wardley-beta\n  component P [1.5, -0.2]'))
    expect(m.components[0]).toMatchObject({ visibility: 1, evolution: 0 })
  })

  it('captures inline link annotations and flow links', () => {
    const m = parseWardleyMap(toLines('wardley-beta\n  A [0.2,0.2]\n  B [0.4,0.4]\n  A +> B; needs'))
    expect(m.links[0]).toMatchObject({ from: 'A', to: 'B', style: 'flow', label: 'needs' })
  })
})
