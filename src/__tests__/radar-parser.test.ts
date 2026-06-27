/**
 * Parser tests for radar charts.
 */
import { describe, it, expect } from 'bun:test'
import { parseRadarChart } from '../radar/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseRadarChart', () => {
  it('parses named axes and an ordered-value curve', () => {
    const c = parseRadarChart(toLines(`radar-beta
      title Skills
      axis A["Axis A"], B["Axis B"], C, D, E
      curve s1["Series 1"]{1,2,3,4,5}`))

    expect(c.title).toBe('Skills')
    expect(c.axes).toEqual([
      { id: 'A', label: 'Axis A' },
      { id: 'B', label: 'Axis B' },
      { id: 'C', label: 'C' },
      { id: 'D', label: 'D' },
      { id: 'E', label: 'E' },
    ])
    expect(c.series).toHaveLength(1)
    expect(c.series[0]!.id).toBe('s1')
    expect(c.series[0]!.label).toBe('Series 1')
    expect(c.series[0]!.values).toEqual([1, 2, 3, 4, 5])
  })

  it('accepts the bare `radar` header and multiple series', () => {
    const c = parseRadarChart(toLines(`radar
      axis A, B, C
      curve c1{1,2,3}
      curve c2{3,2,1}`))
    expect(c.series).toHaveLength(2)
    expect(c.series[0]!.values).toEqual([1, 2, 3])
    expect(c.series[1]!.values).toEqual([3, 2, 1])
  })

  it('maps key-value curve entries onto axis order', () => {
    const c = parseRadarChart(toLines(`radar-beta
      axis a1, a2, a3
      curve c4{ a3: 30, a1: 20, a2: 10 }`))
    // aligned to axis order a1,a2,a3
    expect(c.series[0]!.values).toEqual([20, 10, 30])
  })

  it('parses the max directive and ignores cosmetic directives', () => {
    const c = parseRadarChart(toLines(`radar-beta
      axis A, B
      curve c1{1,2}
      showLegend true
      graticule circle
      ticks 5
      max 100`))
    expect(c.max).toBe(100)
    expect(c.axes).toHaveLength(2)
    expect(c.series).toHaveLength(1)
  })
})
