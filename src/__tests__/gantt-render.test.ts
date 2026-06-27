/**
 * Render tests for gantt charts — parse + layout + render directly.
 */
import { describe, it, expect } from 'bun:test'
import { parseGantt } from '../gantt/parser.ts'
import { layoutGantt } from '../gantt/layout.ts'
import { renderGanttSvg } from '../gantt/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const render = (src: string) =>
  renderGanttSvg(layoutGantt(parseGantt(toLines(src))), colors)

describe('renderGanttSvg', () => {
  const svg = render(`gantt
    title Roadmap
    dateFormat YYYY-MM-DD
    section Design
    Research  :done, des1, 2024-01-01, 3d
    Mockups   :active, des2, after des1, 2d
    section Build
    Implement :impl1, after des2, 5d
    Launch    :milestone, m1, after impl1, 0d`)

  it('produces a well-formed SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each task in a data-id node group', () => {
    expect(svg).toContain('<g class="node" data-id="des1">')
    expect(svg).toContain('data-id="des2"')
    expect(svg).toContain('data-id="impl1"')
    expect(svg).toContain('data-id="m1"')
  })

  it('renders the title and a milestone diamond', () => {
    expect(svg).toContain('>Roadmap<')
    expect(svg).toContain('gantt-milestone')
  })

  it('uses theme CSS variables, not hardcoded colors', () => {
    expect(svg).toContain('var(--_text)')
    expect(svg).toContain('var(--_line)')
  })

  it('positions tasks across a non-trivial timeline', () => {
    const positioned = layoutGantt(parseGantt(toLines(`gantt
      dateFormat YYYY-MM-DD
      section S
      A : a, 2024-01-01, 5d`)))
    expect(positioned.width).toBeGreaterThan(0)
    expect(positioned.height).toBeGreaterThan(0)
    expect(positioned.tasks).toHaveLength(1)
  })
})
