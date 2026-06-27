/**
 * Parser tests for timeline diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseTimeline } from '../timeline/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseTimeline', () => {
  it('parses periods and their events under an implicit section', () => {
    const t = parseTimeline(toLines(`timeline
      2002 : LinkedIn
      2004 : Facebook : Google
      2005 : YouTube`))
    expect(t.sections).toHaveLength(1)
    expect(t.sections[0]!.name).toBeUndefined()
    expect(t.sections[0]!.periods).toEqual([
      { label: '2002', events: ['LinkedIn'] },
      { label: '2004', events: ['Facebook', 'Google'] },
      { label: '2005', events: ['YouTube'] },
    ])
  })

  it('parses a title on the header line and as a standalone line', () => {
    const a = parseTimeline(toLines(`timeline title Social media\n  2002 : LinkedIn`))
    expect(a.title).toBe('Social media')
    const b = parseTimeline(toLines(`timeline\n  title History\n  2002 : LinkedIn`))
    expect(b.title).toBe('History')
  })

  it('groups periods into named sections', () => {
    const t = parseTimeline(toLines(`timeline
      title Project
      section Phase 1
      2024-01 : Planning : Team Setup
      section Phase 2
      2024-02 : Development
      2024-03 : Testing`))
    expect(t.sections.map(s => s.name)).toEqual(['Phase 1', 'Phase 2'])
    expect(t.sections[0]!.periods).toEqual([
      { label: '2024-01', events: ['Planning', 'Team Setup'] },
    ])
    expect(t.sections[1]!.periods.map(p => p.label)).toEqual(['2024-02', '2024-03'])
  })

  it('appends continuation events (`: event`) to the previous period', () => {
    const t = parseTimeline(toLines(`timeline
      2024-01 : Planning : Team Setup
      : Requirements
      : Kickoff`))
    expect(t.sections[0]!.periods[0]).toEqual({
      label: '2024-01',
      events: ['Planning', 'Team Setup', 'Requirements', 'Kickoff'],
    })
  })

  it('splits multiple events on a single line on `:`', () => {
    const t = parseTimeline(toLines(`timeline\n  2024-03 : Testing : Bug Fixes : Launch`))
    expect(t.sections[0]!.periods[0]!.events).toEqual(['Testing', 'Bug Fixes', 'Launch'])
  })
})
