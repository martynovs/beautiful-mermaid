import type { PieChart, PieSlice } from './types.ts'

// ============================================================================
// Pie chart parser
//
// Parses Mermaid `pie` syntax into a typed PieChart structure.
//
// Supported directives:
//   pie [showData] [title <text>]
//   title <text>
//   "Label" : <value>            (value >= 0; quotes optional)
// ============================================================================

/**
 * Parse a Mermaid pie chart from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parsePieChart(lines: string[]): PieChart {
  const chart: PieChart = { slices: [] }

  for (const line of lines) {
    // Header: `pie`, optionally with `showData` and/or `title <text>`
    const headerMatch = line.match(/^pie\b(.*)$/i)
    if (headerMatch) {
      let rest = headerMatch[1]!.trim()
      if (/^showdata\b/i.test(rest)) {
        chart.showData = true
        rest = rest.replace(/^showdata\b/i, '').trim()
      }
      const t = rest.match(/^title\s+(.+)$/i)
      if (t) chart.title = stripQuotes(t[1]!.trim())
      continue
    }

    // Standalone title line
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      chart.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    // Slice: `"Label" : value`
    const slice = parseSlice(line)
    if (slice) chart.slices.push(slice)
  }

  return chart
}

/** Parse a slice line `"Label" : value`. Returns null if it doesn't match. */
function parseSlice(line: string): PieSlice | null {
  const m = line.match(/^(?:"([^"]*)"|'([^']*)'|([^:]+?))\s*:\s*(-?\d*\.?\d+)\s*$/)
  if (!m) return null
  const label = (m[1] ?? m[2] ?? m[3] ?? '').trim()
  const value = parseFloat(m[4]!)
  if (!label || !Number.isFinite(value) || value < 0) return null
  return { label, value }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
