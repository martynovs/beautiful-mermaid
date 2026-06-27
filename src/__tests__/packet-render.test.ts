/**
 * Render + identity tests for packet diagrams.
 * Each field is addressable via a deterministic, unique data-id.
 */
import { describe, it, expect } from 'bun:test'
import { parsePacketDiagram } from '../packet/parser.ts'
import { layoutPacketDiagram } from '../packet/layout.ts'
import { renderPacketSvg } from '../packet/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111' }

const render = (src: string) =>
  renderPacketSvg(layoutPacketDiagram(parsePacketDiagram(toLines(src))), colors)

describe('renderPacketSvg', () => {
  const svg = render(`packet title TCP Header
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"`)

  it('renders valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('renders the title', () => {
    expect(svg).toContain('TCP Header')
  })

  it('wraps each field in a data-id node', () => {
    expect(svg).toContain('data-id="')
    expect(svg).toContain('<g class="node" data-id="source-port"')
    expect(svg).toContain('data-id="destination-port"')
    expect(svg).toContain('data-id="sequence-number"')
  })

  it('renders a rectangle per field segment', () => {
    expect((svg.match(/class="packet-field-rect"/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('disambiguates duplicate labels with unique data-ids', () => {
    const dup = render(`packet\n  0-3: "Reserved"\n  4-7: "Reserved"`)
    expect(dup).toContain('data-id="reserved"')
    expect(dup).toContain('data-id="reserved-2"')
  })
})
