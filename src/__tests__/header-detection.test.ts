/**
 * Header beta-suffix tolerance (§0.3).
 *
 * Types Mermaid ships (or shipped) with a `-beta` header must be detected with
 * or without the suffix, so source survives Mermaid's beta graduations. Wired
 * per type in the dispatcher via `(-beta)?`.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

const XY = (header: string) => `${header}
  x-axis [Jan, Feb]
  y-axis "Rev" 0 --> 100
  bar [30, 60]`

const BLOCK = (header: string) => `${header}
  columns 1
  A["Alpha"]`

describe('header beta-suffix tolerance', () => {
  it('detects xychart with and without -beta', () => {
    // Both dispatch to the xychart renderer (bars carry data-value)
    expect(renderMermaidSVG(XY('xychart-beta'))).toContain('data-value="30"')
    expect(renderMermaidSVG(XY('xychart'))).toContain('data-value="30"')
  })

  it('detects block with and without -beta', () => {
    // Both dispatch to the block renderer (blocks carry data-id)
    expect(renderMermaidSVG(BLOCK('block-beta'))).toContain('data-id="A"')
    expect(renderMermaidSVG(BLOCK('block'))).toContain('data-id="A"')
  })
})
