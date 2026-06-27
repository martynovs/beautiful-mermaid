/**
 * Parser tests for sankey diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseSankey } from '../sankey/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseSankey', () => {
  it('parses CSV rows into nodes, links and numeric values', () => {
    const s = parseSankey(toLines(`sankey
      A,B,10
      B,C,5
      A,C,3`))
    expect(s.nodes).toEqual(['A', 'B', 'C'])
    expect(s.links).toEqual([
      { source: 'A', target: 'B', value: 10 },
      { source: 'B', target: 'C', value: 5 },
      { source: 'A', target: 'C', value: 3 },
    ])
  })

  it('accepts the sankey-beta header and a literal column header row', () => {
    const s = parseSankey(toLines(`sankey-beta
      source,target,value
      X,Y,1.5`))
    // The non-numeric `source,target,value` row is skipped.
    expect(s.nodes).toEqual(['X', 'Y'])
    expect(s.links).toEqual([{ source: 'X', target: 'Y', value: 1.5 }])
  })

  it('handles quoted fields containing commas and spaces', () => {
    const s = parseSankey(toLines(`sankey
      "Agricultural waste, raw",Bio-conversion,124.729`))
    expect(s.nodes).toEqual(['Agricultural waste, raw', 'Bio-conversion'])
    expect(s.links[0]).toEqual({
      source: 'Agricultural waste, raw',
      target: 'Bio-conversion',
      value: 124.729,
    })
  })

  it('skips rows with a non-numeric or missing value', () => {
    const s = parseSankey(toLines(`sankey
      A,B,oops
      A,B
      A,B,7`))
    expect(s.links).toEqual([{ source: 'A', target: 'B', value: 7 }])
  })
})
