/**
 * Parser tests for block (block-beta) (§0.7 — backfill for a shipped type).
 */
import { describe, it, expect } from 'bun:test'
import { parseBlockDiagram } from '../block/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseBlockDiagram', () => {
  it('parses columns, labelled blocks, and edges', () => {
    const d = parseBlockDiagram(toLines(`block-beta
      columns 3
      Agent["Agent"] Tool["Tool"] Store["Store"]
      Agent --> Tool`))
    expect(d.columns).toBe(3)
    expect(d.blocks.map(b => b.id)).toEqual(['Agent', 'Tool', 'Store'])
    expect(d.blocks[0]).toMatchObject({ id: 'Agent', label: 'Agent', col: 0, row: 0 })
    expect(d.blocks[2]).toMatchObject({ col: 2, row: 0 })
    expect(d.edges).toEqual([{ source: 'Agent', target: 'Tool' }])
  })

  it('treats `space` as an empty cell that still consumes a grid slot', () => {
    const d = parseBlockDiagram(toLines(`block-beta
      columns 3
      A space B`))
    expect(d.blocks.map(b => b.id)).toEqual(['A', 'B'])
    expect(d.blocks.find(b => b.id === 'A')!.col).toBe(0)
    expect(d.blocks.find(b => b.id === 'B')!.col).toBe(2)
  })

  it('defaults columns to 1 when unspecified', () => {
    const d = parseBlockDiagram(toLines(`block-beta\n  Solo["Solo"]`))
    expect(d.columns).toBe(1)
    expect(d.blocks[0]!.id).toBe('Solo')
  })
})
