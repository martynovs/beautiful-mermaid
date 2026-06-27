/**
 * Parser tests for kanban boards.
 *
 * Kanban nesting is indentation-based, so — unlike most diagram types — these
 * tests pass RAW lines (split on '\n' with NO trim) so leading whitespace
 * survives to distinguish columns from cards.
 */
import { describe, it, expect } from 'bun:test'
import { parseKanban } from '../kanban/parser.ts'

const toRawLines = (src: string) => src.split('\n')

describe('parseKanban', () => {
  it('parses columns with their indented cards', () => {
    const k = parseKanban(toRawLines(`kanban
  todo[Todo]
    docs[Create Documentation]
    tests[Write Tests]
  done[Done]
    review[Code Review]`))

    expect(k.columns.map(c => c.id)).toEqual(['todo', 'done'])
    expect(k.columns[0]!.title).toBe('Todo')
    expect(k.columns[0]!.cards.map(c => c.id)).toEqual(['docs', 'tests'])
    expect(k.columns[0]!.cards[0]!.text).toBe('Create Documentation')
    expect(k.columns[1]!.cards.map(c => c.id)).toEqual(['review'])
  })

  it('parses card metadata (@{ ... }) and ignores it gracefully when absent', () => {
    const k = parseKanban(toRawLines(`kanban
  inProgress[In Progress]
    feature[Build Feature]@{ assigned: 'Bob', ticket: "PROJ-1", priority: 'Very High' }
    chore[Cleanup]`))

    const card = k.columns[0]!.cards[0]!
    expect(card.metadata).toEqual({ assigned: 'Bob', ticket: 'PROJ-1', priority: 'Very High' })
    expect(k.columns[0]!.cards[1]!.metadata).toBeUndefined()
  })

  it('handles columns at the top level (zero indent) with indented cards', () => {
    const k = parseKanban(toRawLines(`kanban
a[A]
  c1[Card 1]
b[B]
  c2[Card 2]`))

    expect(k.columns.map(c => c.id)).toEqual(['a', 'b'])
    expect(k.columns[0]!.cards.map(c => c.id)).toEqual(['c1'])
    expect(k.columns[1]!.cards.map(c => c.id)).toEqual(['c2'])
  })

  it('disambiguates duplicate ids so identifiers stay unique', () => {
    const k = parseKanban(toRawLines(`kanban
  todo[Todo]
    dup[One]
  done[Done]
    dup[Two]`))

    const ids = [
      ...k.columns.flatMap(c => [c.id, ...c.cards.map(card => card.id)]),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(k.columns[1]!.cards[0]!.id).toBe('dup#2')
  })
})
