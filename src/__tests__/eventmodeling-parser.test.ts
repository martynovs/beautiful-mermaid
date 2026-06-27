/**
 * Parser tests for event-modeling diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseEventModeling } from '../eventmodeling/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseEventModeling', () => {
  it('parses compact `tf` frames with number, type, name and swimlane', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      tf 01 ui UserUI
      tf 02 cmd ChangePassword
      tf 03 evt PasswordChanged`))
    expect(e.frames).toEqual([
      { number: '01', numeric: 1, type: 'ui', name: 'UserUI', swimlane: 'ui-automation' },
      { number: '02', numeric: 2, type: 'cmd', name: 'ChangePassword', swimlane: 'command-readmodel' },
      { number: '03', numeric: 3, type: 'evt', name: 'PasswordChanged', swimlane: 'events' },
    ])
  })

  it('parses the relaxed `timeframe` form and relaxed type spellings', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      timeframe 1 processor Poller
      timeframe 2 command PlaceOrder
      timeframe 3 readmodel OrderView
      timeframe 4 event OrderPlaced`))
    expect(e.frames.map(f => f.type)).toEqual(['pcr', 'cmd', 'rmo', 'evt'])
    expect(e.frames.map(f => f.swimlane)).toEqual([
      'ui-automation', 'command-readmodel', 'command-readmodel', 'events',
    ])
  })

  it('maps every entity type to its swimlane', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      tf 01 ui A
      tf 02 pcr B
      tf 03 cmd C
      tf 04 rmo D
      tf 05 evt E`))
    expect(e.frames.map(f => [f.type, f.swimlane])).toEqual([
      ['ui', 'ui-automation'],
      ['pcr', 'ui-automation'],
      ['cmd', 'command-readmodel'],
      ['rmo', 'command-readmodel'],
      ['evt', 'events'],
    ])
  })

  it('parses an optional title and strips inline data blocks from names', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      title Password Change
      tf 01 ui CartUI {qty: 2}`))
    expect(e.title).toBe('Password Change')
    expect(e.frames[0]!.name).toBe('CartUI')
  })

  it('ignores malformed and unknown-type lines', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      tf 01 zzz Bogus
      tf 02 evt Good
      not a frame`))
    expect(e.frames).toEqual([
      { number: '02', numeric: 2, type: 'evt', name: 'Good', swimlane: 'events' },
    ])
  })

  it('disambiguates colliding frame numbers', () => {
    const e = parseEventModeling(toLines(`eventmodeling
      tf 01 ui A
      tf 01 evt B`))
    expect(e.frames.map(f => f.number)).toEqual(['01', '01#2'])
  })
})
