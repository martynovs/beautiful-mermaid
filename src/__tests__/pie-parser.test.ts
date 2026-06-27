/**
 * Parser tests for pie charts (§2.1).
 */
import { describe, it, expect } from 'bun:test'
import { parsePieChart } from '../pie/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parsePieChart', () => {
  it('parses slices with quoted labels and values', () => {
    const c = parsePieChart(toLines(`pie
      "Dogs" : 386
      "Cats" : 85
      "Rats" : 15`))
    expect(c.slices).toEqual([
      { label: 'Dogs', value: 386 },
      { label: 'Cats', value: 85 },
      { label: 'Rats', value: 15 },
    ])
  })

  it('parses a title on the header line', () => {
    const c = parsePieChart(toLines(`pie title Pets adopted\n  "Dogs" : 1`))
    expect(c.title).toBe('Pets adopted')
    expect(c.slices).toHaveLength(1)
  })

  it('parses the showData flag', () => {
    const c = parsePieChart(toLines(`pie showData title Sales\n  "Q1" : 10`))
    expect(c.showData).toBe(true)
    expect(c.title).toBe('Sales')
  })

  it('accepts unquoted labels and fractional values', () => {
    const c = parsePieChart(toLines(`pie\n  Apples : 12.5`))
    expect(c.slices[0]).toEqual({ label: 'Apples', value: 12.5 })
  })

  it('ignores negative or malformed slice lines', () => {
    const c = parsePieChart(toLines(`pie\n  "Bad" : -5\n  "Good" : 3`))
    expect(c.slices).toEqual([{ label: 'Good', value: 3 }])
  })
})
