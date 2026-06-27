/**
 * Render + identity tests for timeline diagrams.
 *
 * Wired directly through parse → layout → render (the public dispatch in
 * src/index.ts is not yet hooked up for `timeline`). Every event must be
 * addressable via the identity contract (data-id).
 */
import { describe, it, expect } from 'bun:test'
import { parseTimeline } from '../timeline/parser.ts'
import { layoutTimeline } from '../timeline/layout.ts'
import { renderTimelineSvg } from '../timeline/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111' }

const render = (src: string) =>
  renderTimelineSvg(layoutTimeline(parseTimeline(toLines(src))), colors)

describe('renderTimelineSvg', () => {
  const svg = render(`timeline
    title Social media
    section Early
    2002 : LinkedIn
    2004 : Facebook : Google
    section Later
    2005 : YouTube`)

  it('renders a well-formed SVG with the title', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Social media')
  })

  it('wraps every event in a data-id node', () => {
    expect(svg).toContain('<g class="node" data-id="LinkedIn">')
    expect(svg).toContain('data-id="Facebook"')
    expect(svg).toContain('data-id="Google"')
    expect(svg).toContain('data-id="YouTube"')
  })

  it('renders section header bands and period labels', () => {
    expect(svg).toContain('tl-section-band')
    expect(svg).toContain('>Early<')
    expect(svg).toContain('>2002<')
  })

  it('disambiguates duplicate event ids with a #n suffix', () => {
    const dup = render(`timeline
      2002 : Launch
      2003 : Launch`)
    expect(dup).toContain('data-id="Launch"')
    expect(dup).toContain('data-id="Launch#2"')
  })
})
