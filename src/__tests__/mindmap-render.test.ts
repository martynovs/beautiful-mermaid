/**
 * Render + identity tests for mindmap diagrams.
 *
 * These exercise parse → layout → render directly (NOT renderMermaidSVG), so
 * they pass RAW (untrimmed) lines to preserve indentation-driven nesting.
 */
import { describe, it, expect } from 'bun:test'
import { parseMindmap } from '../mindmap/parser.ts'
import { layoutMindmap } from '../mindmap/layout.ts'
import { renderMindmapSvg } from '../mindmap/renderer.ts'

const rawLines = (src: string) => src.split('\n')
const COLORS = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const SRC = `mindmap
  root((Mindmap))
    Origins
      Long history
      Popularisation
    Research
      On effectiveness
      On Automatic creation
    Tools
      Pen and paper
      Mermaid`

function render(src: string): string {
  const positioned = layoutMindmap(parseMindmap(rawLines(src)))
  return renderMindmapSvg(positioned, COLORS)
}

describe('renderMindmapSvg', () => {
  it('renders a valid SVG document', () => {
    const svg = render(SRC)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('renders node labels as text', () => {
    const svg = render(SRC)
    expect(svg).toContain('Mindmap')
    expect(svg).toContain('Origins')
    expect(svg).toContain('Pen and paper')
  })

  it('wraps each node in a data-id node group', () => {
    const svg = render(SRC)
    expect(svg).toContain('data-id="')
    expect(svg).toContain('data-id="Mindmap"')
    expect(svg).toContain('data-id="Origins"')
    // root + 3 categories + 6 leaves = 10 addressable nodes
    expect((svg.match(/class="node" data-id="/g) ?? []).length).toBe(10)
  })

  it('emits parent→child connectors carrying data-from / data-to', () => {
    const svg = render(SRC)
    expect(svg).toContain('data-from="Mindmap" data-to="Origins"')
    expect(svg).toContain('data-to="Pen and paper"')
  })

  it('positions the diagram with a non-zero canvas', () => {
    const positioned = layoutMindmap(parseMindmap(rawLines(SRC)))
    expect(positioned.width).toBeGreaterThan(0)
    expect(positioned.height).toBeGreaterThan(0)
    expect(positioned.nodes).toHaveLength(10)
    expect(positioned.connectors.length).toBeGreaterThan(0)
  })

  it('disambiguates duplicate node labels into unique data-ids', () => {
    const svg = render(`mindmap
  Root
    Branch
      Shared
    Other
      Shared`)
    expect(svg).toContain('data-id="Shared"')
    expect(svg).toContain('data-id="Shared-2"')
  })
})
