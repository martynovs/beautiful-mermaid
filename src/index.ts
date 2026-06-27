// ============================================================================
// beautiful-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'beautiful-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export type { RenderOptions, MermaidGraph, PositionedGraph } from './types.ts'
export type { DiagramColors, ThemeName } from './theme.ts'
export { fromShikiTheme, THEMES, DEFAULTS } from './theme.ts'
export { parseMermaid } from './parser.ts'
export { renderMermaidASCII, renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'

import { decodeXML } from 'entities'
import { parseMermaid } from './parser.ts'
import { layoutGraphSync } from './layout.ts'
import { renderSvg } from './renderer.ts'
import type { RenderOptions } from './types.ts'
import type { DiagramColors } from './theme.ts'
import { DEFAULTS } from './theme.ts'

import { parseSequenceDiagram } from './sequence/parser.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { parseClassDiagram } from './class/parser.ts'
import { layoutClassDiagramSync } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { parseErDiagram } from './er/parser.ts'
import { layoutErDiagramSync } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'
import { parseXYChart } from './xychart/parser.ts'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'
import { parseQuadrantChart } from './quadrant/parser.ts'
import { layoutQuadrantChart } from './quadrant/layout.ts'
import { renderQuadrantSvg } from './quadrant/renderer.ts'
import { parseBlockDiagram } from './block/parser.ts'
import { layoutBlockDiagram } from './block/layout.ts'
import { renderBlockSvg } from './block/renderer.ts'
import { parsePieChart } from './pie/parser.ts'
import { layoutPieChart } from './pie/layout.ts'
import { renderPieSvg } from './pie/renderer.ts'
import { parsePacketDiagram } from './packet/parser.ts'
import { layoutPacketDiagram } from './packet/layout.ts'
import { renderPacketSvg } from './packet/renderer.ts'
import { parseRadarChart } from './radar/parser.ts'
import { layoutRadarChart } from './radar/layout.ts'
import { renderRadarSvg } from './radar/renderer.ts'
import { parseTimeline } from './timeline/parser.ts'
import { layoutTimeline } from './timeline/layout.ts'
import { renderTimelineSvg } from './timeline/renderer.ts'
import { parseJourney } from './journey/parser.ts'
import { layoutJourney } from './journey/layout.ts'
import { renderJourneySvg } from './journey/renderer.ts'
import { parseVennDiagram } from './venn/parser.ts'
import { layoutVennDiagram } from './venn/layout.ts'
import { renderVennSvg } from './venn/renderer.ts'
import { parseWardleyMap } from './wardley/parser.ts'
import { layoutWardleyMap } from './wardley/layout.ts'
import { renderWardleySvg } from './wardley/renderer.ts'
import { parseTreemap } from './treemap/parser.ts'
import { layoutTreemap } from './treemap/layout.ts'
import { renderTreemapSvg } from './treemap/renderer.ts'
import { parseIshikawa } from './ishikawa/parser.ts'
import { layoutIshikawa } from './ishikawa/layout.ts'
import { renderIshikawaSvg } from './ishikawa/renderer.ts'
import { parseKanban } from './kanban/parser.ts'
import { layoutKanban } from './kanban/layout.ts'
import { renderKanbanSvg } from './kanban/renderer.ts'
import { parseTreeView } from './treeView/parser.ts'
import { layoutTreeView } from './treeView/layout.ts'
import { renderTreeViewSvg } from './treeView/renderer.ts'
import { parseRequirementDiagram } from './requirement/parser.ts'
import { layoutRequirementDiagram } from './requirement/layout.ts'
import { renderRequirementSvg } from './requirement/renderer.ts'
import { parseMindmap } from './mindmap/parser.ts'
import { layoutMindmap } from './mindmap/layout.ts'
import { renderMindmapSvg } from './mindmap/renderer.ts'
import { parseSankey } from './sankey/parser.ts'
import { layoutSankey } from './sankey/layout.ts'
import { renderSankeySvg } from './sankey/renderer.ts'
import { parseGitGraph } from './gitgraph/parser.ts'
import { layoutGitGraph } from './gitgraph/layout.ts'
import { renderGitGraphSvg } from './gitgraph/renderer.ts'
import { parseGantt } from './gantt/parser.ts'
import { layoutGantt } from './gantt/layout.ts'
import { renderGanttSvg } from './gantt/renderer.ts'
import { parseEventModeling } from './eventmodeling/parser.ts'
import { layoutEventModeling } from './eventmodeling/layout.ts'
import { renderEventModelingSvg } from './eventmodeling/renderer.ts'
import { parseArchitecture } from './architecture/parser.ts'
import { layoutArchitecture } from './architecture/layout.ts'
import { renderArchitectureSvg } from './architecture/renderer.ts'
import { parseC4Diagram } from './c4/parser.ts'
import { layoutC4Diagram } from './c4/layout.ts'
import { renderC4Svg } from './c4/renderer.ts'
import { parseZenUML } from './zenuml/parser.ts'
import { layoutZenUML } from './zenuml/layout.ts'
import { renderZenUMLSvg } from './zenuml/renderer.ts'

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 */
function detectDiagramType(text: string): 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart' | 'quadrant' | 'block' | 'pie' | 'packet' | 'radar' | 'timeline' | 'journey' | 'venn' | 'wardley' | 'treemap' | 'ishikawa' | 'kanban' | 'treeview' | 'requirement' | 'mindmap' | 'sankey' | 'gitgraph' | 'eventmodeling' | 'gantt' | 'architecture' | 'c4' | 'zenuml' {
  const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? ''

  if (/^xychart(-beta)?\b/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'
  if (/^quadrantchart\b/.test(firstLine)) return 'quadrant'
  if (/^block(-beta)?\b/.test(firstLine)) return 'block'
  if (/^pie\b/.test(firstLine)) return 'pie'
  if (/^packet(-beta)?\b/.test(firstLine)) return 'packet'
  if (/^radar(-beta)?\b/.test(firstLine)) return 'radar'
  if (/^timeline\b/.test(firstLine)) return 'timeline'
  if (/^journey\b/.test(firstLine)) return 'journey'
  if (/^venn(-beta)?\b/.test(firstLine)) return 'venn'
  if (/^wardley(-beta)?\b/.test(firstLine)) return 'wardley'
  if (/^treemap(-beta)?\b/.test(firstLine)) return 'treemap'
  if (/^ishikawa(-beta)?\b/.test(firstLine)) return 'ishikawa'
  if (/^kanban\b/.test(firstLine)) return 'kanban'
  if (/^treeview(-beta)?\b/.test(firstLine)) return 'treeview'
  if (/^requirementdiagram\b/.test(firstLine)) return 'requirement'
  if (/^mindmap\b/.test(firstLine)) return 'mindmap'
  if (/^sankey(-beta)?\b/.test(firstLine)) return 'sankey'
  if (/^gitgraph\b/.test(firstLine)) return 'gitgraph'
  if (/^eventmodeling\b/.test(firstLine)) return 'eventmodeling'
  if (/^gantt\b/.test(firstLine)) return 'gantt'
  if (/^architecture(-beta)?\b/.test(firstLine)) return 'architecture'
  if (/^c4(context|container|component|dynamic|deployment)\b/.test(firstLine)) return 'c4'
  if (/^zenuml\b/.test(firstLine)) return 'zenuml'

  // Default: flowchart/state (handled by parseMermaid internally)
  return 'flowchart'
}

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/**
 * Render Mermaid diagram text to an SVG string — synchronously.
 *
 * Uses elk.bundled.js with a direct FakeWorker bypass (no setTimeout(0) delay).
 * The ELK singleton is created lazily on first use and cached forever.
 *
 * Use this in React components with useMemo() to avoid flash:
 *   const svg = useMemo(() => renderMermaidSVG(code, opts), [code])
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * const svg = renderMermaidSVG('graph TD\n  A --> B')
 *
 * // With theme
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // With CSS variables (for live theme switching)
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: 'var(--background)', fg: 'var(--foreground)', transparent: true
 * })
 * ```
 */
export function renderMermaidSVG(
  text: string,
  options: RenderOptions = {}
): string {
  // Decode XML entities that may leak from markdown parsers (e.g. rehype-raw).
  // Without this, escapeXml() double-encodes them: &lt; → &amp;lt; → literal "&lt;" in SVG.
  text = decodeXML(text)

  const colors = buildColors(options)
  const font = options.font ?? 'Inter'
  const transparent = options.transparent ?? false
  const diagramType = detectDiagramType(text)

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return renderSequenceSvg(positioned, colors, font, transparent)
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = layoutClassDiagramSync(diagram, options)
      return renderClassSvg(positioned, colors, font, transparent)
    }
    case 'er': {
      const diagram = parseErDiagram(lines)
      const positioned = layoutErDiagramSync(diagram, options)
      return renderErSvg(positioned, colors, font, transparent)
    }
    case 'xychart': {
      const chart = parseXYChart(lines)
      const positioned = layoutXYChart(chart, options)
      return renderXYChartSvg(positioned, colors, font, transparent, options.interactive ?? false)
    }
    case 'quadrant': {
      const chart = parseQuadrantChart(lines)
      const positioned = layoutQuadrantChart(chart, options)
      return renderQuadrantSvg(positioned, colors, font, transparent)
    }
    case 'block': {
      const diagram = parseBlockDiagram(lines)
      const positioned = layoutBlockDiagram(diagram, options)
      return renderBlockSvg(positioned, colors, font, transparent)
    }
    case 'pie': {
      const chart = parsePieChart(lines)
      const positioned = layoutPieChart(chart, options)
      return renderPieSvg(positioned, colors, font, transparent)
    }
    case 'packet': {
      const diagram = parsePacketDiagram(lines)
      const positioned = layoutPacketDiagram(diagram, options)
      return renderPacketSvg(positioned, colors, font, transparent)
    }
    case 'radar': {
      const chart = parseRadarChart(lines)
      const positioned = layoutRadarChart(chart, options)
      return renderRadarSvg(positioned, colors, font, transparent)
    }
    case 'timeline': {
      const t = parseTimeline(lines)
      const positioned = layoutTimeline(t, options)
      return renderTimelineSvg(positioned, colors, font, transparent)
    }
    case 'journey': {
      const journey = parseJourney(lines)
      const positioned = layoutJourney(journey, options)
      return renderJourneySvg(positioned, colors, font, transparent)
    }
    case 'venn': {
      const diagram = parseVennDiagram(lines)
      const positioned = layoutVennDiagram(diagram, options)
      return renderVennSvg(positioned, colors, font, transparent)
    }
    case 'wardley': {
      const map = parseWardleyMap(lines)
      const positioned = layoutWardleyMap(map, options)
      return renderWardleySvg(positioned, colors, font, transparent)
    }
    case 'treemap': {
      // Treemap is indentation-based — pass raw (untrimmed) lines so nesting survives.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0)
      const tree = parseTreemap(rawLines)
      const positioned = layoutTreemap(tree, options)
      return renderTreemapSvg(positioned, colors, font, transparent)
    }
    case 'ishikawa': {
      // Ishikawa is indentation-based — pass raw (untrimmed) lines so nesting survives.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0)
      const diagram = parseIshikawa(rawLines)
      const positioned = layoutIshikawa(diagram, options)
      return renderIshikawaSvg(positioned, colors, font, transparent)
    }
    case 'kanban': {
      // Kanban is indentation-based — pass raw (untrimmed) lines so nesting survives.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0)
      const board = parseKanban(rawLines)
      const positioned = layoutKanban(board, options)
      return renderKanbanSvg(positioned, colors, font, transparent)
    }
    case 'treeview': {
      // TreeView is indentation-based — pass raw (untrimmed) lines so nesting survives.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0)
      const tree = parseTreeView(rawLines)
      const positioned = layoutTreeView(tree, options)
      return renderTreeViewSvg(positioned, colors, font, transparent)
    }
    case 'requirement': {
      const diagram = parseRequirementDiagram(lines)
      const positioned = layoutRequirementDiagram(diagram, options)
      return renderRequirementSvg(positioned, colors, font, transparent)
    }
    case 'mindmap': {
      // Mindmap is indentation-based — pass raw (untrimmed) lines so nesting survives.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0)
      const mm = parseMindmap(rawLines)
      const positioned = layoutMindmap(mm, options)
      return renderMindmapSvg(positioned, colors, font, transparent)
    }
    case 'sankey': {
      const sankey = parseSankey(lines)
      const positioned = layoutSankey(sankey, options)
      return renderSankeySvg(positioned, colors, font, transparent)
    }
    case 'gitgraph': {
      const graph = parseGitGraph(lines)
      const positioned = layoutGitGraph(graph, options)
      return renderGitGraphSvg(positioned, colors, font, transparent)
    }
    case 'gantt': {
      const gantt = parseGantt(lines)
      const positioned = layoutGantt(gantt, options)
      return renderGanttSvg(positioned, colors, font, transparent)
    }
    case 'eventmodeling': {
      const em = parseEventModeling(lines)
      const positioned = layoutEventModeling(em, options)
      return renderEventModelingSvg(positioned, colors, font, transparent)
    }
    case 'architecture': {
      const arch = parseArchitecture(lines)
      const positioned = layoutArchitecture(arch, options)
      return renderArchitectureSvg(positioned, colors, font, transparent)
    }
    case 'c4': {
      const diagram = parseC4Diagram(lines)
      const positioned = layoutC4Diagram(diagram, options)
      return renderC4Svg(positioned, colors, font, transparent)
    }
    case 'zenuml': {
      const z = parseZenUML(lines)
      const positioned = layoutZenUML(z, options)
      return renderZenUMLSvg(positioned, colors, font, transparent)
    }
    case 'flowchart':
    default: {
      const graph = parseMermaid(text)
      const positioned = layoutGraphSync(graph, options)
      return renderSvg(positioned, colors, font, transparent)
    }
  }
}

/**
 * Render Mermaid diagram text to an SVG string — async.
 *
 * Same result as renderMermaidSVG() but returns a Promise.
 * Useful in async contexts (server handlers, data loaders, etc.)
 */
export async function renderMermaidSVGAsync(
  text: string,
  options: RenderOptions = {}
): Promise<string> {
  return renderMermaidSVG(text, options)
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `renderMermaidSVG` */
export const renderMermaidSync = renderMermaidSVG

/** @deprecated Use `renderMermaidSVGAsync` */
export const renderMermaid = renderMermaidSVGAsync
