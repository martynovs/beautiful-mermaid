/**
 * Render + identity tests for user journey diagrams.
 * Drives parse → layout → render directly (not renderMermaidSVG).
 * Each task is addressable via data-id + data-value (its score).
 */
import { describe, it, expect } from 'bun:test'
import { parseJourney } from '../journey/parser.ts'
import { layoutJourney } from '../journey/layout.ts'
import { renderJourneySvg } from '../journey/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) =>
  renderJourneySvg(layoutJourney(parseJourney(toLines(src))), colors)

describe('renderJourneySvg – journey identity', () => {
  const svg = render(`journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me, Cat
    section Be at work
      Do work: 1: Me, Cat`)

  it('renders to valid SVG with the title', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('My working day')
  })

  it('wraps each task in a data-id node carrying its score', () => {
    expect(svg).toContain('data-id="')
    expect(svg).toContain('<g class="node" data-id="Make tea" data-value="5">')
    expect(svg).toContain('data-id="Go upstairs" data-value="3"')
    expect(svg).toContain('data-id="Do work" data-value="1"')
  })

  it('renders section names and actor lists', () => {
    expect(svg).toContain('Go to work')
    expect(svg).toContain('Be at work')
    expect(svg).toContain('Me, Cat')
  })

  it('disambiguates duplicate task names into unique ids', () => {
    const dup = render(`journey
      section A
        Wait: 2: Me
      section B
        Wait: 4: Me`)
    expect(dup).toContain('data-id="Wait" data-value="2"')
    expect(dup).toContain('data-id="Wait-2" data-value="4"')
  })
})
