/**
 * Render + identity integration tests for radar charts.
 *
 * Imports parse + layout + render directly (NOT renderMermaidSVG) so the module
 * is exercised without touching src/index.ts dispatch.
 */
import { describe, it, expect } from 'bun:test'
import { parseRadarChart } from '../radar/parser.ts'
import { layoutRadarChart } from '../radar/layout.ts'
import { renderRadarSvg } from '../radar/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) =>
  renderRadarSvg(layoutRadarChart(parseRadarChart(toLines(src))), colors)

describe('renderRadarSvg – radar identity', () => {
  const svg = render(`radar-beta
    title Skills
    axis A["Axis A"], B["Axis B"], C, D, E
    curve s1["Series 1"]{1,2,3,4,5}
    curve s2["Series 2"]{5,4,3,2,1}`)

  it('renders valid SVG with the title', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Skills')
  })

  it('wraps each series in a data-id node', () => {
    expect(svg).toContain('<g class="node" data-id="s1"')
    expect(svg).toContain('<g class="node" data-id="s2"')
  })

  it('emits a unique data-id per plotted vertex', () => {
    expect(svg).toContain('data-id="s1::A"')
    expect(svg).toContain('data-id="s1::E"')
    expect(svg).toContain('data-id="s2::C"')
    expect(svg).toContain('data-id="')
  })

  it('renders a polygon path per series', () => {
    expect((svg.match(/class="radar-area radar-color-/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('renders graticule rings and axis labels', () => {
    expect(svg).toContain('class="radar-ring"')
    expect(svg).toContain('Axis A')
  })
})
