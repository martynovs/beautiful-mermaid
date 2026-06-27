import type { RadarChart, RadarAxis, RadarSeries } from './types.ts'

// ============================================================================
// Radar chart parser
//
// Parses Mermaid `radar` / `radar-beta` syntax into a typed RadarChart.
//
// Supported subset (Mermaid v11.6.0+):
//   radar-beta                       (header; bare `radar` also accepted)
//   title <text>
//   axis id1["Label1"], id2["Label2"], id3      (named axes; label optional)
//   curve id["Label"]{1,2,3,4,5}                 (ordered values, axis order)
//   curve id["Label"]{ a3: 30, a1: 20, a2: 10 } (key-value values, by axis id)
//   max <number>                                 (radial scale upper bound)
//
// Cosmetic directives (showLegend / graticule / ticks) are accepted and
// ignored — they do not affect the parsed structure.
// ============================================================================

/**
 * Parse a Mermaid radar chart from preprocessed lines.
 * Lines should already be trimmed and comment-stripped. The header line is skipped.
 */
export function parseRadarChart(lines: string[]): RadarChart {
  const chart: RadarChart = { axes: [], series: [] }

  for (const line of lines) {
    // Header: `radar` / `radar-beta`, optionally with a trailing `title`
    const headerMatch = line.match(/^radar(?:-beta)?\b(.*)$/i)
    if (headerMatch) {
      const rest = headerMatch[1]!.trim()
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

    // Radial scale upper bound: `max 100`
    const maxMatch = line.match(/^max\s+(-?\d*\.?\d+)\s*$/i)
    if (maxMatch) {
      const m = parseFloat(maxMatch[1]!)
      if (Number.isFinite(m) && m > 0) chart.max = m
      continue
    }

    // Axis definition(s): `axis id1["Label1"], id2, ...`
    const axisMatch = line.match(/^axis\s+(.+)$/i)
    if (axisMatch) {
      for (const def of splitTopLevel(axisMatch[1]!)) {
        const axis = parseAxis(def)
        if (axis) chart.axes.push(axis)
      }
      continue
    }

    // Curve / data series: `curve id["Label"]{values}`
    const series = parseCurve(line, chart.axes)
    if (series) chart.series.push(series)
  }

  dedupeIds(chart.axes)
  dedupeIds(chart.series)
  return chart
}

/** Parse a single axis token: `id["Label"]` or bare `id`. */
function parseAxis(def: string): RadarAxis | null {
  const m = def.trim().match(/^([A-Za-z0-9_]+)\s*(?:\[\s*(.*?)\s*\])?$/)
  if (!m) return null
  const id = m[1]!
  const label = m[2] != null && m[2] !== '' ? stripQuotes(m[2]) : id
  return { id, label }
}

/** Parse a curve line into a series with values aligned to `axes` order. */
function parseCurve(line: string, axes: RadarAxis[]): RadarSeries | null {
  const m = line.match(/^curve\s+([A-Za-z0-9_]+)\s*(?:\[\s*(.*?)\s*\])?\s*\{(.*)\}\s*$/i)
  if (!m) return null
  const id = m[1]!
  const label = m[2] != null && m[2] !== '' ? stripQuotes(m[2]) : id
  const body = m[3]!.trim()

  const n = axes.length
  const values = new Array<number>(Math.max(n, 0)).fill(0)

  if (/:/.test(body)) {
    // Key-value form: `axisId: value`
    for (const pair of splitTopLevel(body)) {
      const pm = pair.match(/^([A-Za-z0-9_]+)\s*:\s*(-?\d*\.?\d+)\s*$/)
      if (!pm) continue
      const idx = axes.findIndex(a => a.id === pm[1])
      const v = parseFloat(pm[2]!)
      if (idx >= 0 && Number.isFinite(v)) values[idx] = v
    }
  } else {
    // Ordered form: `1,2,3,...` aligned to axis order
    const ordered = splitTopLevel(body)
      .map(s => parseFloat(s.trim()))
      .map(v => (Number.isFinite(v) ? v : 0))
    // If axes weren't declared yet, length follows the value list.
    if (n === 0) return { id, label, values: ordered }
    ordered.forEach((v, i) => { if (i < n) values[i] = v })
  }

  return { id, label, values }
}

/** Split on commas that are not nested inside [] or {}. */
function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '[' || ch === '{' || ch === '(') depth++
    else if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Ensure every id is unique within the list, suffixing collisions. */
function dedupeIds(items: Array<{ id: string }>): void {
  const seen = new Map<string, number>()
  for (const item of items) {
    const count = seen.get(item.id) ?? 0
    if (count > 0) item.id = `${item.id}_${count}`
    seen.set(item.id.replace(/_\d+$/, ''), count + 1)
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
