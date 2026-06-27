/**
 * Render tests for event-modeling diagrams.
 * Exercises parse → layout → render directly (not via renderMermaidSVG).
 */
import { describe, it, expect } from 'bun:test'
import { parseEventModeling } from '../eventmodeling/parser.ts'
import { layoutEventModeling } from '../eventmodeling/layout.ts'
import { renderEventModelingSvg } from '../eventmodeling/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const SRC = `eventmodeling
  title Change Password
  tf 01 ui UserUI
  tf 02 cmd ChangePassword
  tf 03 evt PasswordChanged
  tf 04 rmo AccountView`

function render(src: string): string {
  const diagram = parseEventModeling(toLines(src))
  const positioned = layoutEventModeling(diagram)
  return renderEventModelingSvg(positioned, colors)
}

describe('renderEventModelingSvg', () => {
  it('produces a well-formed SVG document', () => {
    const svg = render(SRC)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('emits an addressable data-id for every frame (identity contract)', () => {
    const svg = render(SRC)
    expect(svg).toContain('data-id="')
    for (const id of ['01', '02', '03', '04']) {
      expect(svg).toContain(`data-id="${id}"`)
    }
  })

  it('emits inferred relations carrying data-from / data-to', () => {
    const svg = render(SRC)
    expect(svg).toContain('class="edge"')
    expect(svg).toContain('data-from="01"')
    expect(svg).toContain('data-to="02"')
  })

  it('renders the title and the three swimlane labels', () => {
    const svg = render(SRC)
    expect(svg).toContain('Change Password')
    expect(svg).toContain('UI / Automation')
    expect(svg).toContain('Command / Read Model')
    expect(svg).toContain('Events')
  })

  it('has positive canvas dimensions', () => {
    const positioned = layoutEventModeling(parseEventModeling(toLines(SRC)))
    expect(positioned.width).toBeGreaterThan(0)
    expect(positioned.height).toBeGreaterThan(0)
  })
})
