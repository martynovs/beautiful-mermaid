/**
 * Parser tests for venn diagrams (`venn-beta`).
 */
import { describe, it, expect } from 'bun:test'
import { parseVennDiagram } from '../venn/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseVennDiagram', () => {
  it('parses sets and a 2-set union', () => {
    const d = parseVennDiagram(toLines(`venn-beta
      set A
      set B
      union A, B`))
    expect(d.sets).toEqual([
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
    ])
    expect(d.unions).toHaveLength(1)
    expect(d.unions[0]!.setIds).toEqual(['A', 'B'])
    expect(d.unions[0]!.id).toBe('A∩B')
  })

  it('accepts the bare `venn` header', () => {
    const d = parseVennDiagram(toLines(`venn
      set X
      set Y`))
    expect(d.sets.map(s => s.id)).toEqual(['X', 'Y'])
  })

  it('parses quoted ids and display labels', () => {
    const d = parseVennDiagram(toLines(`venn-beta
      set "Foo Bar"
      set baz["Baz Label"]`))
    expect(d.sets[0]).toEqual({ id: 'Foo Bar', label: 'Foo Bar' })
    expect(d.sets[1]).toEqual({ id: 'baz', label: 'Baz Label' })
  })

  it('parses a 3-set union and the title', () => {
    const d = parseVennDiagram(toLines(`venn-beta
      title My Venn
      set A
      set B
      set C
      union A, B, C`))
    expect(d.title).toBe('My Venn')
    expect(d.unions[0]!.setIds).toEqual(['A', 'B', 'C'])
    expect(d.unions[0]!.id).toBe('A∩B∩C')
  })

  it('ignores size suffixes and attaches text labels to the current target', () => {
    const d = parseVennDiagram(toLines(`venn-beta
      set A:50
      union A, B:75
      text "Only A and B"`))
    expect(d.sets[0]!.id).toBe('A')
    expect(d.unions[0]!.setIds).toEqual(['A', 'B'])
    expect(d.unions[0]!.label).toBe('Only A and B')
  })

  it('disambiguates duplicate union ids', () => {
    const d = parseVennDiagram(toLines(`venn-beta
      set A
      set B
      union A, B
      union A, B`))
    expect(d.unions.map(u => u.id)).toEqual(['A∩B', 'A∩B#2'])
  })
})
