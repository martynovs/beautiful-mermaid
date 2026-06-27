/**
 * Identity integration tests for quadrantChart (§0.7).
 * Every data point must be addressable via the stable identity contract.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

describe('renderMermaidSVG – quadrant identity', () => {
  const svg = renderMermaidSVG(`quadrantChart
    x-axis Low --> High
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]`)

  it('renders to valid SVG', () => {
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('wraps each point in a data-id node group', () => {
    expect(svg).toContain('<g class="node" data-id="Campaign A">')
    expect(svg).toContain('data-id="Campaign B"')
  })
})
