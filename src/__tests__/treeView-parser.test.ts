/**
 * Parser tests for treeView diagrams.
 *
 * treeView is indentation-driven, so these tests pass RAW (untrimmed) lines —
 * split on '\n' with NO `.trim()` — exactly as the dispatcher must.
 */
import { describe, it, expect } from 'bun:test'
import { parseTreeView } from '../treeView/parser.ts'
import type { TreeNode } from '../treeView/types.ts'

const toRawLines = (src: string) => src.split('\n')

/** Flatten the forest in DFS order for easy assertions. */
function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n)
    flatten(n.children, out)
  }
  return out
}

describe('parseTreeView', () => {
  it('builds nesting from indentation', () => {
    const t = parseTreeView(toRawLines(`treeView-beta
    my-project/
        src/
            index.js
        package.json`))

    expect(t.nodes).toHaveLength(1)
    const root = t.nodes[0]!
    expect(root.label).toBe('my-project')
    expect(root.children.map(c => c.label)).toEqual(['src', 'package.json'])
    const src = root.children[0]!
    expect(src.children.map(c => c.label)).toEqual(['index.js'])
    expect(root.depth).toBe(0)
    expect(src.depth).toBe(1)
    expect(src.children[0]!.depth).toBe(2)
  })

  it('distinguishes folders (trailing slash or children) from files', () => {
    const t = parseTreeView(toRawLines(`treeView-beta
    root/
        sub/
            leaf.ts
        readme.md`))
    const byLabel = new Map(flatten(t.nodes).map(n => [n.label, n]))

    // Explicit trailing-slash folders
    expect(byLabel.get('root')!.isFolder).toBe(true)
    expect(byLabel.get('sub')!.isFolder).toBe(true)
    // Plain files
    expect(byLabel.get('leaf.ts')!.isFolder).toBe(false)
    expect(byLabel.get('readme.md')!.isFolder).toBe(false)
  })

  it('treats a node with children as a folder even without a trailing slash', () => {
    const t = parseTreeView(toRawLines(`treeView-beta
    "my project"
        src/
            index.js`))
    const root = t.nodes[0]!
    expect(root.label).toBe('my project')
    expect(root.isFolder).toBe(true)
  })

  it('assigns hierarchical paths and disambiguates duplicate labels', () => {
    const t = parseTreeView(toRawLines(`treeView-beta
    app/
        a/
            index.ts
        b/
            index.ts`))
    const paths = flatten(t.nodes).map(n => n.path)
    expect(paths).toContain('app/a/index.ts')
    expect(paths).toContain('app/b/index.ts')
    // Every path is unique — no collision between the two index.ts files.
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('parses quoted labels and inline ## descriptions, ignoring :::class', () => {
    const t = parseTreeView(toRawLines(`treeView-beta
    src/ ## source code
        "index file.js" :::highlight ## entry point`))
    const src = t.nodes[0]!
    expect(src.label).toBe('src')
    expect(src.isFolder).toBe(true)
    expect(src.description).toBe('source code')

    const file = src.children[0]!
    expect(file.label).toBe('index file.js')
    expect(file.description).toBe('entry point')
    expect(file.isFolder).toBe(false)
  })

  it('accepts a bare `treeView` header and supports multiple roots', () => {
    const t = parseTreeView(toRawLines(`treeView
    alpha/
        a.txt
    beta/
        b.txt`))
    expect(t.nodes.map(n => n.label)).toEqual(['alpha', 'beta'])
  })
})
