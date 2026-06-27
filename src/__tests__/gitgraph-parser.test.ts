/**
 * Parser tests for git graphs.
 */
import { describe, it, expect } from 'bun:test'
import { parseGitGraph } from '../gitgraph/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseGitGraph', () => {
  it('parses commits on the default main branch in order', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit
      commit
      commit`))
    expect(g.commits).toHaveLength(3)
    expect(g.commits.every(c => c.branch === 'main')).toBe(true)
    // Each commit links back to the previous one on the branch.
    expect(g.commits[0]!.parents).toEqual([])
    expect(g.commits[1]!.parents).toEqual([g.commits[0]!.id])
    expect(g.commits[2]!.parents).toEqual([g.commits[1]!.id])
  })

  it('honors explicit ids, tags and types', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit id: "root" tag: "v1.0" type: HIGHLIGHT`))
    const c = g.commits[0]!
    expect(c.id).toBe('root')
    expect(c.tag).toBe('v1.0')
    expect(c.type).toBe('HIGHLIGHT')
  })

  it('creates branches and switches the current branch', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit
      branch develop
      commit
      checkout main
      commit`))
    expect(g.branches.map(b => b.name)).toEqual(['main', 'develop'])
    expect(g.branches.find(b => b.name === 'develop')!.order).toBe(1)
    // Second commit is on develop, third is back on main.
    expect(g.commits[1]!.branch).toBe('develop')
    expect(g.commits[2]!.branch).toBe('main')
    // The first develop commit branches off the main head.
    expect(g.commits[1]!.parents).toEqual([g.commits[0]!.id])
  })

  it('accepts switch as an alias for checkout and quoted branch names', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit
      branch "feature-x"
      commit
      switch main
      commit`))
    expect(g.branches.map(b => b.name)).toContain('feature-x')
    expect(g.commits[2]!.branch).toBe('main')
  })

  it('records a merge commit with two parents across lanes', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit
      branch develop
      commit
      checkout main
      merge develop`))
    const merge = g.commits.find(c => c.isMerge)!
    expect(merge).toBeDefined()
    expect(merge.branch).toBe('main')
    // Parents: main head + develop head.
    expect(merge.parents).toHaveLength(2)
    const mainHead = g.commits[0]!.id
    const developHead = g.commits[1]!.id
    expect(merge.parents).toEqual([mainHead, developHead])
  })

  it('disambiguates duplicate explicit ids', () => {
    const g = parseGitGraph(toLines(`gitGraph
      commit id: "dup"
      commit id: "dup"`))
    expect(g.commits[0]!.id).toBe('dup')
    expect(g.commits[1]!.id).toBe('dup-2')
  })
})
