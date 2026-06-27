/**
 * Parser tests for quadrantChart (§0.7 — backfill for a shipped type).
 */
import { describe, it, expect } from 'bun:test'
import { parseQuadrantChart } from '../quadrant/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const SRC = `quadrantChart
  title Reach and engagement
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Re-evaluate
  quadrant-4 Improve
  Campaign A: [0.3, 0.6]
  Campaign B: [0.45, 0.23]`

describe('parseQuadrantChart', () => {
  const chart = parseQuadrantChart(toLines(SRC))

  it('parses the title', () => {
    expect(chart.title).toBe('Reach and engagement')
  })

  it('parses axis end labels split on -->', () => {
    expect(chart.xAxis).toEqual({ left: 'Low Reach', right: 'High Reach' })
    expect(chart.yAxis).toEqual({ bottom: 'Low Engagement', top: 'High Engagement' })
  })

  it('parses quadrant region labels', () => {
    expect(chart.quadrants.q1).toBe('Expand')
    expect(chart.quadrants.q4).toBe('Improve')
  })

  it('parses data points with their coordinates', () => {
    expect(chart.points).toHaveLength(2)
    expect(chart.points[0]).toEqual({ name: 'Campaign A', x: 0.3, y: 0.6 })
    expect(chart.points[1]!.name).toBe('Campaign B')
  })

  it('clamps out-of-range coordinates into 0..1', () => {
    const c = parseQuadrantChart(toLines('quadrantChart\n  P: [1.5, -0.2]'))
    expect(c.points[0]).toEqual({ name: 'P', x: 1, y: 0 })
  })
})
