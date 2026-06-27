/**
 * Render + identity tests for wardley maps.
 * Exercises parse → layout → render directly (not renderMermaidSVG).
 */
import { describe, it, expect } from 'bun:test'
import { parseWardleyMap } from '../wardley/parser.ts'
import { layoutWardleyMap } from '../wardley/layout.ts'
import { renderWardleySvg } from '../wardley/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const SRC = `wardley-beta
  title Tea Shop
  anchor Customer [0.95, 0.5]
  component Cup of Tea [0.9, 0.6]
  component Kettle [0.4, 0.55]
  Customer -> Cup of Tea
  Cup of Tea -.-> Kettle`

function render(src: string): string {
  return renderWardleySvg(layoutWardleyMap(parseWardleyMap(toLines(src))), colors)
}

describe('renderWardleySvg', () => {
  const svg = render(SRC)

  it('renders to a valid SVG document', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each component in a data-id node group', () => {
    expect(svg).toContain('data-id="Customer"')
    expect(svg).toContain('data-id="Cup of Tea"')
    expect(svg).toContain('data-id="Kettle"')
  })

  it('emits dependency links carrying data-from / data-to', () => {
    expect(svg).toContain('data-from="Customer"')
    expect(svg).toContain('data-to="Cup of Tea"')
  })

  it('renders the title and evolution stage axis', () => {
    expect(svg).toContain('Tea Shop')
    expect(svg).toContain('Genesis')
    expect(svg).toContain('Commodity')
  })

  it('disambiguates duplicate component names into unique ids', () => {
    const dup = render('wardley-beta\n  component Foo [0.2,0.2]\n  component Foo [0.8,0.8]')
    expect(dup).toContain('data-id="Foo"')
    expect(dup).toContain('data-id="Foo#2"')
  })
})
