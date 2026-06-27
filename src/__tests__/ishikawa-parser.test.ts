/**
 * Parser tests for ishikawa (fishbone) diagrams.
 *
 * IMPORTANT: ishikawa nesting is inferred from leading whitespace, so these
 * tests pass RAW (untrimmed) lines — `src.split('\n')` with NO per-line trim.
 * (The src/index.ts pre-processor trims lines; the dispatcher must special-case
 * ishikawa and feed parseIshikawa untrimmed lines.)
 */
import { describe, it, expect } from 'bun:test'
import { parseIshikawa } from '../ishikawa/parser.ts'

// Raw lines: split on '\n' only, indentation preserved.
const rawLines = (src: string) => src.split('\n')

describe('parseIshikawa', () => {
  it('parses the effect, categories and nested causes from indentation', () => {
    const d = parseIshikawa(rawLines(`ishikawa-beta
Slow API Response
  Infrastructure
    Underpowered instances
    No CDN
  Code
    N+1 queries
    Missing caching
  Process
    No load testing`))

    expect(d.effect).toBe('Slow API Response')
    expect(d.categories.map(c => c.text)).toEqual(['Infrastructure', 'Code', 'Process'])

    const infra = d.categories[0]!
    expect(infra.causes.map(c => c.text)).toEqual(['Underpowered instances', 'No CDN'])

    const code = d.categories[1]!
    expect(code.causes.map(c => c.text)).toEqual(['N+1 queries', 'Missing caching'])
  })

  it('infers categories vs causes from depth, not a fixed level', () => {
    const d = parseIshikawa(rawLines(`ishikawa
The Effect
    People
        Training
    Method
        Steps`))
    expect(d.effect).toBe('The Effect')
    expect(d.categories.map(c => c.text)).toEqual(['People', 'Method'])
    expect(d.categories[0]!.causes.map(c => c.text)).toEqual(['Training'])
  })

  it('supports deeper than one level of cause nesting', () => {
    const d = parseIshikawa(rawLines(`ishikawa-beta
Defects
  Materials
    Supplier
      Late delivery
      Wrong spec`))
    const supplier = d.categories[0]!.causes[0]!
    expect(supplier.text).toBe('Supplier')
    expect(supplier.causes.map(c => c.text)).toEqual(['Late delivery', 'Wrong spec'])
  })

  it('ignores blank lines and %% comments, and accepts the header keyword', () => {
    const d = parseIshikawa(rawLines(`ishikawa-beta
%% a comment
Problem

  Category A
    Cause 1`))
    expect(d.effect).toBe('Problem')
    expect(d.categories).toHaveLength(1)
    expect(d.categories[0]!.text).toBe('Category A')
    expect(d.categories[0]!.causes[0]!.text).toBe('Cause 1')
  })
})
