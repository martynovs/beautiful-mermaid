/**
 * Identity + render tests for sankey diagrams.
 *
 * Drives the pipeline directly (parse → layout → render) rather than through
 * renderMermaidSVG, exercising the self-contained sankey module in isolation.
 */
import { describe, it, expect } from 'bun:test'
import { parseSankey } from '../sankey/parser.ts'
import { layoutSankey } from '../sankey/layout.ts'
import { renderSankeySvg } from '../sankey/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) => {
  const s = parseSankey(src.split('\n').map(l => l.trim()).filter(Boolean))
  const positioned = layoutSankey(s)
  return renderSankeySvg(positioned, colors)
}

describe('renderSankeySvg – sankey identity', () => {
  const svg = render(`sankey
A,B,10
A,C,5
B,D,8
C,D,4`)

  it('renders valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each node in a data-id group', () => {
    expect(svg).toContain('data-id="')
    expect(svg).toContain('<g class="node" data-id="A">')
    expect(svg).toContain('data-id="B"')
    expect(svg).toContain('data-id="D"')
  })

  it('emits flow bands carrying their endpoints and value', () => {
    expect(svg).toContain('data-from="')
    expect(svg).toContain('data-from="A" data-to="B" data-value="10"')
    expect(svg).toContain('data-from="C" data-to="D" data-value="4"')
  })

  it('uses theme CSS variables and accent-derived per-node fills', () => {
    expect(svg).toContain('var(--_text)')
    expect(svg).toContain('.sankey-color-0 { fill: var(--accent')
    expect(svg).toContain('.sankey-color-1')
    expect(svg).toContain('var(--bg)')
  })
})
