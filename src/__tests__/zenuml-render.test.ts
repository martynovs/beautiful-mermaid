/**
 * Render tests for the ZenUML diagram (§5.1).
 * Drives parse → layout → render directly (not renderMermaidSVG, since dispatch
 * in index.ts is intentionally left untouched by this spike).
 */
import { describe, it, expect } from 'bun:test'
import { parseZenUML } from '../zenuml/parser.ts'
import { layoutZenUML } from '../zenuml/layout.ts'
import { renderZenUMLSvg } from '../zenuml/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111', accent: '#3b82f6' }

function render(src: string): string {
  const lines = src
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('%%'))
  return renderZenUMLSvg(layoutZenUML(parseZenUML(lines)), colors)
}

describe('renderZenUMLSvg', () => {
  const svg = render(`zenuml
    @Actor User
    participant Server
    User->Server: GET /data
    Server.query() {
      return rows
    }
    Server->User: 200 OK`)

  it('renders a valid SVG document', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each participant in a data-id node group', () => {
    expect(svg).toContain('data-id="User"')
    expect(svg).toContain('data-id="Server"')
  })

  it('emits message arrows carrying data-from / data-to', () => {
    expect(svg).toContain('data-from="')
    expect(svg).toContain('data-to="')
    expect(svg).toContain('data-from="User" data-to="Server"')
  })

  it('uses theme CSS variables, not hardcoded colors', () => {
    expect(svg).toContain('var(--_line)')
    expect(svg).not.toMatch(/fill="#[0-9a-fA-F]{3,6}"/)
  })

  it('renders the annotator stereotype', () => {
    expect(svg).toContain('data-annotator="Actor"')
  })
})

describe('renderZenUMLSvg – return arrows', () => {
  const svg = render(`zenuml
    @Actor User
    @Boundary LoginPage
    @Control AuthService
    @Database UserDB
    User->LoginPage: enter credentials
    LoginPage.authenticate(user, pass) {
      AuthService.validate() {
        UserDB.findUser()
        return record
      }
      return token
    }
    LoginPage->User: show dashboard`)

  it('emits dashed return messages (data-kind="return")', () => {
    expect(svg).toContain('data-kind="return"')
    expect(svg).toContain('stroke-dasharray="6 4"')
  })

  it('uses the open arrow head marker for returns', () => {
    expect(svg).toContain('url(#zen-arrow-open)')
  })

  it('draws a return arrow from UserDB back to AuthService', () => {
    expect(svg).toContain('data-from="UserDB" data-to="AuthService" data-label="" data-kind="return"')
  })

  it('draws a return arrow from AuthService back to LoginPage labelled "record"', () => {
    expect(svg).toContain('data-from="AuthService" data-to="LoginPage" data-label="record" data-kind="return"')
  })
})

describe('renderZenUMLSvg – fragments', () => {
  const svg = render(`zenuml
    @Actor User
    participant Server
    loop (3 times) {
      User->Server: poll
      alt (ready) {
        Server->User: data
      } else {
        Server->User: wait
      }
    }`)

  it('renders a fragment box with a class hook', () => {
    expect(svg).toContain('class="fragment"')
  })

  it('renders a loop fragment with its label tab', () => {
    expect(svg).toContain('data-type="loop"')
    expect(svg).toContain('loop [3 times]')
  })

  it('renders a nested alt fragment with an else divider', () => {
    expect(svg).toContain('data-type="alt"')
    expect(svg).toContain('alt [ready]')
    expect(svg).toContain('else')
  })

  it('keeps fragment styling on theme variables (no hardcoded colors)', () => {
    expect(svg).toContain('var(--_group-hdr)')
    expect(svg).not.toMatch(/fill="#[0-9a-fA-F]{3,6}"/)
  })
})
