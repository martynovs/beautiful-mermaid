/**
 * Tests for the shared, type-agnostic icon registry.
 *
 * Glyphs are theme-driven (currentColor), individually addressable as a `<g>`
 * fragment, and unknown names degrade gracefully without throwing.
 */
import { describe, it, expect } from 'bun:test'
import { renderIcon, hasIcon, ICON_NAMES } from '../icons/registry.ts'

describe('renderIcon', () => {
  it('renders a known glyph as an SVG fragment using currentColor', () => {
    const svg = renderIcon('database', { x: 0, y: 0, size: 24 })
    expect(svg).toContain('<')
    expect(/path|rect/.test(svg)).toBe(true)
    expect(svg).toContain('currentColor')
    expect(svg).toContain('<g')
  })

  it('positions and scales via a transform', () => {
    const svg = renderIcon('folder', { x: 10, y: 20, size: 48 })
    expect(svg).toContain('translate(10 20)')
    expect(svg).toContain('scale(2)') // 48 / 24
  })

  it('applies an extra className when provided', () => {
    const svg = renderIcon('server', { x: 0, y: 0, size: 24, className: 'node-icon' })
    expect(svg).toContain('class="bm-icon node-icon"')
  })

  it('returns a non-empty fallback for unknown names without throwing', () => {
    let svg = ''
    expect(() => {
      svg = renderIcon('nope', { x: 0, y: 0, size: 24 })
    }).not.toThrow()
    expect(svg.length).toBeGreaterThan(0)
    expect(svg).toContain('rect')
    expect(svg).toContain('currentColor')
  })

  it('does not hardcode hex colors', () => {
    for (const name of ICON_NAMES) {
      const svg = renderIcon(name, { x: 0, y: 0, size: 24 })
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })
})

describe('hasIcon', () => {
  it('is true for a registered icon and false otherwise', () => {
    expect(hasIcon('database')).toBe(true)
    expect(hasIcon('nope')).toBe(false)
  })
})

describe('ICON_NAMES', () => {
  it('includes the common architecture/treeview icons', () => {
    expect(ICON_NAMES).toContain('folder')
    expect(ICON_NAMES).toContain('database')
    for (const expected of ['file', 'server', 'cloud', 'disk', 'internet', 'queue', 'cpu', 'unknown']) {
      expect(ICON_NAMES).toContain(expected)
    }
  })

  it('every listed name resolves via hasIcon', () => {
    for (const name of ICON_NAMES) expect(hasIcon(name)).toBe(true)
  })
})
