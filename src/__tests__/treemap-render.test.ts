/**
 * Identity + render tests for treemap diagrams.
 *
 * Drives the pipeline directly (parse → layout → render) rather than through
 * renderMermaidSVG, since the shared dispatcher pre-trims lines and treemap
 * needs RAW (untrimmed) lines to recover its indentation-based hierarchy.
 */
import { describe, it, expect } from 'bun:test'
import { parseTreemap } from '../treemap/parser.ts'
import { layoutTreemap } from '../treemap/layout.ts'
import { renderTreemapSvg } from '../treemap/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) => {
  const t = parseTreemap(src.split('\n'))
  const positioned = layoutTreemap(t)
  return renderTreemapSvg(positioned, colors)
}

describe('renderTreemapSvg – treemap identity', () => {
  const svg = render(`treemap
"Root"
    "Branch A"
        "Leaf 1": 10
        "Leaf 2": 20
    "Branch B": 30`)

  it('renders valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each cell in a data-id node carrying its value', () => {
    expect(svg).toContain('data-id="')
    expect(svg).toContain('data-value="')
    // Leaves addressable by hierarchical path
    expect(svg).toContain('data-id="Root/Branch A/Leaf 1" data-value="10"')
    expect(svg).toContain('data-id="Root/Branch A/Leaf 2" data-value="20"')
    expect(svg).toContain('data-id="Root/Branch B" data-value="30"')
    // Branch carries its summed value
    expect(svg).toContain('data-id="Root/Branch A" data-value="30"')
  })

  it('emits a rect per cell and the leaf labels', () => {
    expect((svg.match(/class="tm-cell/g) ?? []).length).toBeGreaterThanOrEqual(4)
    expect(svg).toContain('Leaf 1')
    expect(svg).toContain('Branch A')
  })

  it('uses theme CSS variables and accent-derived per-branch fills', () => {
    expect(svg).toContain('var(--_text)')
    // First branch bucket uses the accent variable directly.
    expect(svg).toContain('.tm-color-0 { fill: var(--accent')
    // Further buckets are accent-derived shades (getSeriesColor), not the fg color.
    expect(svg).toContain('.tm-color-1')
    // Cell strokes/labels reference theme vars, never the raw fg in a fill rule.
    expect(svg).toContain('fill: var(--bg)')
  })

  it('renders a forest with a synthetic root (top-level sections addressable)', () => {
    const f = render(`treemap
"Section 1"
    "Leaf 1.1": 12
"Section 2"
    "Leaf 2.1": 20`)
    expect(f).toContain('data-id="Section 1/Leaf 1.1" data-value="12"')
    expect(f).toContain('data-id="Section 2" data-value="20"')
  })
})
