/**
 * Identity + render integration tests for pie charts (§2.1).
 * Each slice is addressable via data-id (its label) + data-value.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

describe('renderMermaidSVG – pie identity', () => {
  const svg = renderMermaidSVG(`pie title Pets
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`)

  it('renders to valid SVG with the title', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Pets')
  })

  it('wraps each slice in a data-id node carrying its value', () => {
    expect(svg).toContain('<g class="node" data-id="Dogs" data-value="386">')
    expect(svg).toContain('data-id="Cats" data-value="85"')
    expect(svg).toContain('data-id="Rats" data-value="15"')
  })

  it('renders a wedge path per slice', () => {
    expect((svg.match(/class="pie-slice pie-color-/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('renders a full disc for a single 100% slice', () => {
    const one = renderMermaidSVG(`pie\n  "Only" : 1`)
    expect(one).toContain('data-id="Only"')
    expect(one).toContain('<path')
  })
})
