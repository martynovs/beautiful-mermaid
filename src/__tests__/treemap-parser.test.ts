/**
 * Parser tests for treemap diagrams.
 *
 * NOTE: parseTreemap infers the hierarchy from each line's LEADING WHITESPACE,
 * so these tests pass RAW (untrimmed) lines — split on '\n' only. Trimming would
 * destroy the indentation and collapse the tree.
 */
import { describe, it, expect } from 'bun:test'
import { parseTreemap } from '../treemap/parser.ts'
import type { TreemapNode } from '../treemap/types.ts'

/** Split into raw lines WITHOUT trimming (indentation is load-bearing). */
const toRawLines = (src: string) => src.split('\n')

const find = (node: TreemapNode, label: string): TreemapNode | undefined => {
  if (node.label === label) return node
  for (const c of node.children) {
    const hit = find(c, label)
    if (hit) return hit
  }
  return undefined
}

describe('parseTreemap', () => {
  const src = `treemap
"Root"
    "Branch A"
        "Leaf 1": 10
        "Leaf 2": 20
    "Branch B": 30`

  it('builds the indentation-based hierarchy', () => {
    const t = parseTreemap(toRawLines(src))
    expect(t.root.label).toBe('Root')
    expect(t.root.children.map(c => c.label)).toEqual(['Branch A', 'Branch B'])

    const branchA = t.root.children[0]!
    expect(branchA.children.map(c => c.label)).toEqual(['Leaf 1', 'Leaf 2'])
  })

  it('keeps explicit leaf values and sums branch values from descendants', () => {
    const t = parseTreemap(toRawLines(src))
    expect(find(t.root, 'Leaf 1')!.value).toBe(10)
    expect(find(t.root, 'Leaf 2')!.value).toBe(20)
    // "Branch B" has an explicit value and no children → leaf of value 30
    expect(find(t.root, 'Branch B')!.value).toBe(30)
    // "Branch A" = 10 + 20; "Root" = 30 + 30
    expect(find(t.root, 'Branch A')!.value).toBe(30)
    expect(t.root.value).toBe(60)
  })

  it('derives stable hierarchical ids that disambiguate duplicate labels', () => {
    const dup = `treemap
"Root"
    "Group"
        "Item": 1
    "Other"
        "Item": 2`
    const t = parseTreemap(toRawLines(dup))
    const paths: string[] = []
    const walk = (n: TreemapNode) => { paths.push(n.path); n.children.forEach(walk) }
    walk(t.root)
    expect(paths).toContain('Root/Group/Item')
    expect(paths).toContain('Root/Other/Item')
    // No two nodes share a path.
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('supports a forest (multiple top-level nodes) via a synthetic root', () => {
    const forest = `treemap
"Section 1"
    "Leaf 1.1": 12
"Section 2"
    "Leaf 2.1": 20
    "Leaf 2.2": 25`
    const t = parseTreemap(toRawLines(forest))
    expect(t.root.label).toBe('') // synthetic container
    expect(t.root.children.map(c => c.label)).toEqual(['Section 1', 'Section 2'])
    expect(find(t.root, 'Section 2')!.value).toBe(45)
  })

  it('parses an optional title and the treemap-beta header', () => {
    const t = parseTreemap(toRawLines(`treemap-beta
title My Tree
"Root"
    "A": 5`))
    expect(t.title).toBe('My Tree')
    expect(t.root.label).toBe('Root')
    expect(find(t.root, 'A')!.value).toBe(5)
  })
})
