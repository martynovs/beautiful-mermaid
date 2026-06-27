/**
 * Render + identity integration tests for venn diagrams.
 *
 * Imports parse + layout + render directly (NOT renderMermaidSVG) so the module
 * is exercised without touching src/index.ts dispatch.
 */
import { describe, it, expect } from 'bun:test'
import { parseVennDiagram } from '../venn/parser.ts'
import { layoutVennDiagram } from '../venn/layout.ts'
import { renderVennSvg } from '../venn/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) =>
  renderVennSvg(layoutVennDiagram(parseVennDiagram(toLines(src))), colors)

describe('renderVennSvg – venn identity', () => {
  const svg = render(`venn-beta
    title Pets
    set Dogs
    set Cats
    union Dogs, Cats`)

  it('renders valid SVG with the title', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Pets')
  })

  it('wraps each set in a data-id node with a circle', () => {
    expect(svg).toContain('<g class="node" data-id="Dogs">')
    expect(svg).toContain('<g class="node" data-id="Cats">')
    expect(svg).toContain('data-id="')
    expect(svg).toContain('<circle')
  })

  it('renders one circle per set', () => {
    expect((svg.match(/<circle/g) ?? []).length).toBe(2)
  })

  it('makes the overlap region addressable via its member set ids', () => {
    expect(svg).toContain('data-id="Dogs∩Cats"')
  })

  it('omits the cramped derived "∩" caption from the lens', () => {
    // The region stays addressable, but no "Dogs ∩ Cats" text is drawn.
    expect(svg).toContain('data-id="Dogs∩Cats"')
    expect(svg).not.toContain('Dogs ∩ Cats')
    expect(svg).not.toContain('class="venn-union-label"')
    expect(svg).toContain('<g class="node venn-union" data-id="Dogs∩Cats"></g>')
  })

  it('lays out three sets as three circles', () => {
    const three = render(`venn-beta
      set A
      set B
      set C
      union A, B, C`)
    expect((three.match(/<circle/g) ?? []).length).toBe(3)
    expect(three).toContain('data-id="A∩B∩C"')
  })
})
