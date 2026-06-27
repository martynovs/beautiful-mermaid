/**
 * Parser tests for packet diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parsePacketDiagram } from '../packet/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parsePacketDiagram', () => {
  it('parses a bit range into { start, end, label }', () => {
    const d = parsePacketDiagram(toLines(`packet
      0-15: "Source Port"
      16-31: "Destination Port"`))
    expect(d.fields).toEqual([
      { start: 0, end: 15, label: 'Source Port' },
      { start: 16, end: 31, label: 'Destination Port' },
    ])
  })

  it('parses a single-bit field', () => {
    const d = parsePacketDiagram(toLines(`packet\n  16: "Flag"`))
    expect(d.fields[0]).toEqual({ start: 16, end: 16, label: 'Flag' })
  })

  it('accepts the legacy packet-beta header', () => {
    const d = parsePacketDiagram(toLines(`packet-beta\n  0-7: "Version"`))
    expect(d.fields).toEqual([{ start: 0, end: 7, label: 'Version' }])
  })

  it('supports the +count bits syntax continuing from the previous end', () => {
    const d = parsePacketDiagram(toLines(`packet
      +1: "A"
      +8: "B"
      9-15: "C"`))
    expect(d.fields).toEqual([
      { start: 0, end: 0, label: 'A' },
      { start: 1, end: 8, label: 'B' },
      { start: 9, end: 15, label: 'C' },
    ])
  })

  it('parses a title and strips inline comments', () => {
    const d = parsePacketDiagram(toLines(`packet\n  title TCP Header\n  0-15: "Source Port" %% 16 bits`))
    expect(d.title).toBe('TCP Header')
    expect(d.fields[0]).toEqual({ start: 0, end: 15, label: 'Source Port' })
  })

  it('ignores malformed field lines', () => {
    const d = parsePacketDiagram(toLines(`packet\n  31-0: "Backwards"\n  0-3: "Good"`))
    expect(d.fields).toEqual([{ start: 0, end: 3, label: 'Good' }])
  })
})
