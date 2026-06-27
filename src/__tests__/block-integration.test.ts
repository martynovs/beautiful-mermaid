/**
 * Identity integration tests for block (block-beta) (§0.7).
 * Blocks carry data-id; edges carry data-from / data-to.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

describe('renderMermaidSVG – block identity', () => {
  const svg = renderMermaidSVG(`block-beta
    columns 2
    Agent["Agent"] Tool["Tool"]
    Agent --> Tool`)

  it('renders to valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each block in a data-id node group', () => {
    expect(svg).toContain('data-id="Agent"')
    expect(svg).toContain('data-id="Tool"')
  })

  it('emits data-from / data-to on the edge', () => {
    expect(svg).toContain('data-from="Agent"')
    expect(svg).toContain('data-to="Tool"')
  })
})
