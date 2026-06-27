/**
 * Render + identity integration tests for requirement diagrams.
 *
 * Imports parse + layout + render directly (NOT renderMermaidSVG) so the module
 * is exercised without touching src/index.ts dispatch.
 */
import { describe, it, expect } from 'bun:test'
import { parseRequirementDiagram } from '../requirement/parser.ts'
import { layoutRequirementDiagram } from '../requirement/layout.ts'
import { renderRequirementSvg } from '../requirement/renderer.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const colors = { bg: '#ffffff', fg: '#111111' }

const render = (src: string) =>
  renderRequirementSvg(layoutRequirementDiagram(parseRequirementDiagram(toLines(src))), colors)

describe('renderRequirementSvg – requirement identity', () => {
  const svg = render(`requirementDiagram
    requirement test_req {
      id: 1
      text: the test text.
      risk: high
      verifymethod: test
    }
    element test_entity {
      type: simulation
    }
    test_entity - satisfies -> test_req`)

  it('renders a well-formed SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each requirement and element in a data-id node', () => {
    expect(svg).toContain('<g class="node" data-id="test_req"')
    expect(svg).toContain('<g class="node" data-id="test_entity"')
    expect(svg).toContain('data-id="')
  })

  it('emits a relationship edge with data-from / data-to', () => {
    expect(svg).toContain('data-from="test_entity"')
    expect(svg).toContain('data-to="test_req"')
    expect(svg).toContain('data-from="')
  })

  it('shows requirement fields and stereotype', () => {
    expect(svg).toContain('id: 1')
    expect(svg).toContain('«Requirement»')
    expect(svg).toContain('«Element»')
    expect(svg).toContain('«satisfies»')
  })

  it('uses theme CSS variables and no hardcoded hex colors in markup', () => {
    expect(svg).toContain('var(--_line)')
    expect(svg).toContain('var(--_text)')
    // The only hex values should be the provided bg/fg in the root style attr.
    const body = svg.slice(svg.indexOf('</style>'))
    expect(body).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  it('handles reverse-direction relationships', () => {
    const r = render(`requirementDiagram
      requirement r1 {
        id: 1
      }
      element e1 {
        type: test
      }
      r1 <- traces - e1`)
    expect(r).toContain('data-from="e1"')
    expect(r).toContain('data-to="r1"')
  })
})
