/**
 * Render tests for treeView diagrams.
 *
 * Drives the pipeline directly (parse → layout → render), NOT renderMermaidSVG,
 * since the shared dispatcher is not modified by this change. Passes RAW
 * (untrimmed) lines so indentation-based nesting survives.
 */
import { describe, it, expect } from 'bun:test'
import { parseTreeView } from '../treeView/parser.ts'
import { layoutTreeView } from '../treeView/layout.ts'
import { renderTreeViewSvg } from '../treeView/renderer.ts'
import type { DiagramColors } from '../theme.ts'

const colors: DiagramColors = { bg: '#ffffff', fg: '#111111' }

const render = (src: string) =>
  renderTreeViewSvg(layoutTreeView(parseTreeView(src.split('\n'))), colors)

describe('renderTreeViewSvg', () => {
  it('emits a well-formed SVG with addressable nodes', () => {
    const svg = render(`treeView-beta
    my-project/
        src/
            index.js
        package.json`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('data-id="')
    // Hierarchical path identity, including a nested file.
    expect(svg).toContain('data-id="my-project/src/index.js"')
  })

  it('keys duplicate filenames by distinct hierarchical paths', () => {
    const svg = render(`treeView-beta
    app/
        a/
            index.ts
        b/
            index.ts`)
    expect(svg).toContain('data-id="app/a/index.ts"')
    expect(svg).toContain('data-id="app/b/index.ts"')
  })

  it('emits connectors carrying data-from / data-to', () => {
    const svg = render(`treeView-beta
    root/
        child.txt`)
    expect(svg).toContain('data-from="root"')
    expect(svg).toContain('data-to="root/child.txt"')
  })

  it('uses theme CSS variables only — no hardcoded hex colors in the body', () => {
    const svg = render(`treeView-beta
    root/
        file.ts`)
    expect(svg).toContain('var(--_text)')
    expect(svg).toContain('var(--_line)')
    // The fg color is injected on the <svg> tag via svgOpenTag, but must not
    // appear as a hardcoded fill/stroke in the rendered shapes.
    const body = svg.slice(svg.indexOf('</style>'))
    expect(body).not.toContain('#111111')
  })
})
