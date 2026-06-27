/**
 * Render tests for C4 diagrams — parse + layout + render directly.
 */
import { describe, it, expect } from 'bun:test'
import { parseC4Diagram } from '../c4/parser.ts'
import { layoutC4Diagram } from '../c4/layout.ts'
import { renderC4Svg } from '../c4/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

const render = (src: string) =>
  renderC4Svg(layoutC4Diagram(parseC4Diagram(toLines(src))), colors)

describe('renderC4Svg', () => {
  it('renders a well-formed SVG with addressable elements and edges', () => {
    const svg = render(`C4Context
      Person(customer, "Personal Banking Customer", "A customer of the bank")
      System(banking, "Internet Banking System", "Lets customers view accounts")
      System_Ext(email, "E-Mail System", "Microsoft Exchange")
      Rel(customer, banking, "Uses")
      Rel(banking, email, "Sends e-mails", "SMTP")`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')

    // Identity contract: every element addressable by alias.
    expect(svg).toContain('data-id="customer"')
    expect(svg).toContain('data-id="banking"')
    expect(svg).toContain('data-id="email"')

    // Edges carry endpoints.
    expect(svg).toContain('data-from="customer"')
    expect(svg).toContain('data-to="banking"')

    // No hardcoded colors — theme CSS vars only.
    expect(svg).toContain('var(--_text)')

    // Each element box carries an icon (person glyph + registry icons),
    // colored via the theme through the c4-icon class.
    expect(svg).toContain('c4-icon')
    expect(svg).toContain('bm-icon') // registry-rendered system icon
    expect(svg).toContain('.c4-icon { color: var(--_text); }')
  })

  it('renders distinct icons for person, system, db and queue elements', () => {
    const svg = render(`C4Container
      Person(customer, "Customer")
      Container(web, "Web App", "Java")
      ContainerDb(db, "Database", "PostgreSQL")
      ContainerQueue(mq, "Message Bus", "Kafka")`)

    // Person → inline hand-drawn glyph (head circle + shoulders arc).
    expect(svg).toContain('<circle cx="12" cy="7" r="4"/>')
    // Db / Queue variants reach the registry's database / queue glyphs.
    expect(svg).toContain('bm-icon c4-icon')
  })

  it('renders boundaries and container technology', () => {
    const svg = render(`C4Container
      System_Boundary(c1, "Internet Banking") {
        Container(web, "Web Application", "Java, Spring MVC", "Delivers content")
      }
      Person(customer, "Customer")
      Rel(customer, web, "Uses", "HTTPS")`)

    expect(svg).toContain('data-id="web"')
    expect(svg).toContain('data-from="customer"')
    expect(svg).toContain('data-to="web"')
    expect(svg).toContain('Internet Banking')
  })
})
