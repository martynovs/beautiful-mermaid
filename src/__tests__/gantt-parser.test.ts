/**
 * Parser tests for gantt charts.
 */
import { describe, it, expect } from 'bun:test'
import { parseGantt } from '../gantt/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseGantt', () => {
  const chart = parseGantt(toLines(`gantt
    title My Project
    dateFormat YYYY-MM-DD
    section Design
    Research  :done, des1, 2024-01-01, 3d
    Mockups   :active, des2, after des1, 2d
    section Build
    Implement :impl1, after des2, 5d`))

  it('parses the title and dateFormat', () => {
    expect(chart.title).toBe('My Project')
    expect(chart.dateFormat).toBe('YYYY-MM-DD')
    expect(chart.startDate).toBe('2024-01-01')
  })

  it('groups tasks into sections in source order', () => {
    expect(chart.sections.map(s => s.name)).toEqual(['Design', 'Build'])
    expect(chart.sections[0]!.tasks.map(t => t.name)).toEqual(['Research', 'Mockups'])
    expect(chart.sections[1]!.tasks.map(t => t.name)).toEqual(['Implement'])
  })

  it('computes absolute start/end day indices', () => {
    const research = chart.tasks.find(t => t.id === 'des1')!
    expect(research.startDay).toBe(0)
    expect(research.endDay).toBe(3)
    expect(research.tags).toContain('done')
  })

  it('resolves `after` dependencies to the referenced task end', () => {
    const mockups = chart.tasks.find(t => t.id === 'des2')!
    expect(mockups.startDay).toBe(3) // after des1 (ends day 3)
    expect(mockups.endDay).toBe(5)

    const impl = chart.tasks.find(t => t.id === 'impl1')!
    expect(impl.startDay).toBe(5) // after des2 (ends day 5)
    expect(impl.endDay).toBe(10)
  })

  it('falls back to a slug id when no explicit id is given', () => {
    const c = parseGantt(toLines(`gantt
      dateFormat YYYY-MM-DD
      section S
      Write the docs : 2024-02-01, 2d`))
    expect(c.tasks[0]!.id).toBe('write-the-docs')
  })

  it('disambiguates duplicate derived ids', () => {
    const c = parseGantt(toLines(`gantt
      dateFormat YYYY-MM-DD
      section S
      Task : 2024-01-01, 1d
      Task : 2024-01-02, 1d`))
    expect(c.tasks.map(t => t.id)).toEqual(['task', 'task-2'])
  })

  it('supports end dates and week durations', () => {
    const c = parseGantt(toLines(`gantt
      dateFormat YYYY-MM-DD
      section S
      A : a, 2024-01-01, 2024-01-04
      B : b, after a, 1w`))
    const a = c.tasks.find(t => t.id === 'a')!
    const b = c.tasks.find(t => t.id === 'b')!
    expect(a.durationDays).toBe(3)
    expect(b.startDay).toBe(3)
    expect(b.endDay).toBe(10) // 1 week = 7 days
  })
})
