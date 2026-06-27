/**
 * Render + identity tests for ishikawa (fishbone) diagrams.
 *
 * These exercise parse → layout → render directly (NOT renderMermaidSVG), so
 * they pass RAW (untrimmed) lines to preserve indentation-driven nesting.
 */
import { describe, it, expect } from 'bun:test'
import { parseIshikawa } from '../ishikawa/parser.ts'
import { layoutIshikawa } from '../ishikawa/layout.ts'
import { renderIshikawaSvg } from '../ishikawa/renderer.ts'

const rawLines = (src: string) => src.split('\n')
const COLORS = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const SRC = `ishikawa-beta
Slow API Response
  Infrastructure
    Underpowered instances
    No CDN
  Code
    N+1 queries
    Missing caching
  Process
    No load testing`

function render(src: string): string {
  const positioned = layoutIshikawa(parseIshikawa(rawLines(src)))
  return renderIshikawaSvg(positioned, COLORS)
}

describe('renderIshikawaSvg', () => {
  it('renders a valid SVG document', () => {
    const svg = render(SRC)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('renders the effect, categories and causes as text', () => {
    const svg = render(SRC)
    expect(svg).toContain('Slow API Response')
    expect(svg).toContain('Infrastructure')
    expect(svg).toContain('N+1 queries')
  })

  it('wraps the effect, each category and each cause in a data-id node', () => {
    const svg = render(SRC)
    expect(svg).toContain('data-id="')
    expect(svg).toContain('data-id="Slow API Response"')
    expect(svg).toContain('data-id="Infrastructure"')
    expect(svg).toContain('data-id="Underpowered instances"')
    // effect + 3 categories + 5 causes (2 + 2 + 1) = 9 addressable nodes
    expect((svg.match(/class="node" data-id="/g) ?? []).length).toBe(9)
  })

  it('disambiguates duplicate cause labels into unique data-ids', () => {
    const svg = render(`ishikawa
Effect
  Cat A
    Other
  Cat B
    Other`)
    expect(svg).toContain('data-id="Other"')
    expect(svg).toContain('data-id="Other-2"')
  })

  it('emits connector lines carrying data-from / data-to', () => {
    const svg = render(SRC)
    expect(svg).toContain('data-from="Slow API Response" data-to="Infrastructure"')
    expect(svg).toContain('data-to="N+1 queries"')
  })

  it('positions the diagram with a non-zero canvas', () => {
    const positioned = layoutIshikawa(parseIshikawa(rawLines(SRC)))
    expect(positioned.width).toBeGreaterThan(0)
    expect(positioned.height).toBeGreaterThan(0)
    expect(positioned.categories).toHaveLength(3)
  })
})
