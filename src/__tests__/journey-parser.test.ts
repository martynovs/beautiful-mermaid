/**
 * Parser tests for user journey diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseJourney } from '../journey/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseJourney', () => {
  it('parses sections with tasks, scores and actors', () => {
    const j = parseJourney(toLines(`journey
      title My working day
      section Go to work
        Make tea: 5: Me
        Go upstairs: 3: Me, Cat
      section Be at work
        Do work: 1: Me, Cat`))

    expect(j.title).toBe('My working day')
    expect(j.sections).toHaveLength(2)
    expect(j.sections[0]!.name).toBe('Go to work')
    expect(j.sections[1]!.name).toBe('Be at work')

    expect(j.sections[0]!.tasks).toEqual([
      { name: 'Make tea', score: 5, actors: ['Me'] },
      { name: 'Go upstairs', score: 3, actors: ['Me', 'Cat'] },
    ])
    expect(j.sections[1]!.tasks[0]).toEqual({ name: 'Do work', score: 1, actors: ['Me', 'Cat'] })
  })

  it('skips the journey header and parses a task with no actors', () => {
    const j = parseJourney(toLines(`journey
      section Solo
        Think: 4:`))
    expect(j.sections[0]!.tasks[0]).toEqual({ name: 'Think', score: 4, actors: [] })
  })

  it('clamps scores into the 1..5 range', () => {
    const j = parseJourney(toLines(`journey
      section Edge
        TooLow: 0: A
        TooHigh: 9: B`))
    expect(j.sections[0]!.tasks.map(t => t.score)).toEqual([1, 5])
  })

  it('collects tasks before any section into an implicit section', () => {
    const j = parseJourney(toLines(`journey
      Warm up: 2: Me`))
    expect(j.sections).toHaveLength(1)
    expect(j.sections[0]!.name).toBe('')
    expect(j.sections[0]!.tasks[0]).toEqual({ name: 'Warm up', score: 2, actors: ['Me'] })
  })
})
