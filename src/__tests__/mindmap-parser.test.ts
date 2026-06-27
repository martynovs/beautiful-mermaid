/**
 * Parser tests for mindmap diagrams.
 *
 * NOTE: parseMindmap infers the hierarchy from each line's LEADING WHITESPACE,
 * so these tests pass RAW (untrimmed) lines — split on '\n' only. Trimming would
 * destroy the indentation and collapse the tree.
 */
import { describe, it, expect } from 'bun:test'
import { parseMindmap } from '../mindmap/parser.ts'
import type { MindmapNode } from '../mindmap/types.ts'

/** Split into raw lines WITHOUT trimming (indentation is load-bearing). */
const toRawLines = (src: string) => src.split('\n')

const find = (node: MindmapNode, label: string): MindmapNode | undefined => {
  if (node.label === label) return node
  for (const c of node.children) {
    const hit = find(c, label)
    if (hit) return hit
  }
  return undefined
}

describe('parseMindmap', () => {
  const src = `mindmap
  Root
    Child A
      Grandchild A1
      Grandchild A2
    Child B`

  it('builds the indentation-based tree with a single root', () => {
    const m = parseMindmap(toRawLines(src))
    expect(m.root.label).toBe('Root')
    expect(m.root.depth).toBe(0)
    expect(m.root.children.map(c => c.label)).toEqual(['Child A', 'Child B'])

    const childA = m.root.children[0]!
    expect(childA.depth).toBe(1)
    expect(childA.children.map(c => c.label)).toEqual(['Grandchild A1', 'Grandchild A2'])
    expect(childA.children[0]!.depth).toBe(2)
  })

  it('extracts text and shape from bracket delimiters', () => {
    const m = parseMindmap(toRawLines(`mindmap
  root((Origin))
    id1[Square]
    (Round)
    {{Hexagon}}
    ))Bang((
    )Cloud(`))
    expect(m.root.label).toBe('Origin')
    expect(m.root.shape).toBe('circle')

    const labels = m.root.children.map(c => ({ label: c.label, shape: c.shape }))
    expect(labels).toEqual([
      { label: 'Square', shape: 'square' },
      { label: 'Round', shape: 'round' },
      { label: 'Hexagon', shape: 'hexagon' },
      { label: 'Bang', shape: 'bang' },
      { label: 'Cloud', shape: 'cloud' },
    ])
  })

  it('derives the data-id from the node text (not the bracket-prefix id)', () => {
    const m = parseMindmap(toRawLines(`mindmap
  Root
    id1[Square]
    Plain`))
    expect(find(m.root, 'Square')!.id).toBe('Square')
    expect(find(m.root, 'Plain')!.id).toBe('Plain')
  })

  it('derives unique ids that disambiguate duplicate labels', () => {
    const m = parseMindmap(toRawLines(`mindmap
  Root
    Topic
      Other
    Topic
      Other`))
    const ids: string[] = []
    const walk = (n: MindmapNode) => { ids.push(n.id); n.children.forEach(walk) }
    walk(m.root)
    // Every id is unique within the diagram.
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('Other')
    expect(ids).toContain('Other-2')
    expect(ids).toContain('Topic')
    expect(ids).toContain('Topic-2')
  })

  it('wraps multiple top-level nodes in a synthetic root', () => {
    const m = parseMindmap(toRawLines(`mindmap
  First
  Second`))
    expect(m.root.label).toBe('')
    expect(m.root.id).toBe('')
    expect(m.root.children.map(c => c.label)).toEqual(['First', 'Second'])
    expect(m.root.children[0]!.depth).toBe(1)
  })

  it('ignores comments and the header line', () => {
    const m = parseMindmap(toRawLines(`mindmap
  %% this is a comment
  Root
    Leaf`))
    expect(m.root.label).toBe('Root')
    expect(m.root.children.map(c => c.label)).toEqual(['Leaf'])
  })
})
