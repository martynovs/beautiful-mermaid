/**
 * Render + identity tests for git graphs.
 * Drives parse → layout → render directly (not renderMermaidSVG).
 * Each commit is addressable via <g class="node" data-id>; edges carry
 * data-from / data-to.
 */
import { describe, it, expect } from 'bun:test'
import { parseGitGraph } from '../gitgraph/parser.ts'
import { layoutGitGraph } from '../gitgraph/layout.ts'
import { renderGitGraphSvg } from '../gitgraph/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) =>
  renderGitGraphSvg(layoutGitGraph(parseGitGraph(toLines(src))), colors)

describe('renderGitGraphSvg – git graph identity', () => {
  const svg = render(`gitGraph
    commit id: "init"
    branch develop
    commit id: "work"
    checkout main
    commit id: "fix"
    merge develop`)

  it('renders to valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each commit in a data-id node', () => {
    expect(svg).toContain('data-id="')
    expect(svg).toContain('<g class="node" data-id="init">')
    expect(svg).toContain('data-id="work"')
    expect(svg).toContain('data-id="fix"')
  })

  it('emits branch / merge edges carrying data-from and data-to', () => {
    expect(svg).toContain('data-from="')
    // The develop branch line: init → work.
    expect(svg).toContain('data-from="init" data-to="work"')
  })

  it('renders the merge edge across lanes (develop head → merge commit)', () => {
    // The merge commit links back to the develop head ("work").
    expect(svg).toContain('data-from="work" data-to="')
  })

  it('shows branch labels and a tag', () => {
    const tagged = render(`gitGraph
      commit tag: "v1.0"
      branch develop
      commit`)
    expect(tagged).toContain('develop')
    expect(tagged).toContain('v1.0')
  })
})
