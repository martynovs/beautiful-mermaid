/**
 * Render integration tests for kanban boards.
 *
 * Drives parse → layout → render directly (not renderMermaidSVG) so the module
 * can be verified without wiring the dispatcher. Raw, untrimmed lines are used
 * because kanban nesting is indentation-based.
 */
import { describe, it, expect } from 'bun:test'
import { parseKanban } from '../kanban/parser.ts'
import { layoutKanban } from '../kanban/layout.ts'
import { renderKanbanSvg } from '../kanban/renderer.ts'

const colors = { bg: '#ffffff', fg: '#111111' }

const render = (src: string) =>
  renderKanbanSvg(layoutKanban(parseKanban(src.split('\n'))), colors)

describe('renderKanbanSvg', () => {
  it('produces a self-contained SVG with addressable card ids', () => {
    const svg = render(`kanban
  todo[Todo]
    docs[Create Documentation]@{ assigned: 'Alice', priority: 'High' }
    tests[Write Tests]
  done[Done]
    review[Code Review]`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('data-id="')
    // Each card is addressable.
    expect(svg).toContain('data-id="docs"')
    expect(svg).toContain('data-id="tests"')
    expect(svg).toContain('data-id="review"')
    // Columns carry data-id too.
    expect(svg).toContain('data-id="todo"')
    // Metadata is rendered.
    expect(svg).toContain('Alice')
  })

  it('renders an empty board without throwing', () => {
    const svg = render('kanban')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('uses theme CSS variables, not hardcoded colors', () => {
    const svg = render(`kanban
  a[A]
    c[Card]`)
    expect(svg).toContain('var(--_text)')
    expect(svg).not.toMatch(/fill="#[0-9a-fA-F]{6}"/)
  })
})
