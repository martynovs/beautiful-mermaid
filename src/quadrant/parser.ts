import type { QuadrantChart, QuadrantPoint } from './types.ts'

// ============================================================================
// Quadrant chart parser
//
// Parses Mermaid quadrantChart syntax into a typed QuadrantChart structure.
//
// Supported directives:
//   quadrantChart
//   title <text>
//   x-axis <left> --> <right>            (or just: x-axis <left>)
//   y-axis <bottom> --> <top>            (or just: y-axis <bottom>)
//   quadrant-1 <label>  (top-right)
//   quadrant-2 <label>  (top-left)
//   quadrant-3 <label>  (bottom-left)
//   quadrant-4 <label>  (bottom-right)
//   <name>: [<x>, <y>]                   (x, y in 0..1)
// ============================================================================

/**
 * Parse a Mermaid quadrantChart from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseQuadrantChart(lines: string[]): QuadrantChart {
  const chart: QuadrantChart = {
    xAxis: {},
    yAxis: {},
    quadrants: {},
    points: [],
  }

  for (const line of lines) {
    // Header
    if (/^quadrantchart\b/i.test(line)) continue

    // Title
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      chart.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    // x-axis "Left --> Right" or "Left"
    const xMatch = line.match(/^x-axis\s+(.+)$/i)
    if (xMatch) {
      const [a, b] = splitEnds(xMatch[1]!)
      chart.xAxis = { left: a, right: b }
      continue
    }

    // y-axis "Bottom --> Top" or "Bottom"
    const yMatch = line.match(/^y-axis\s+(.+)$/i)
    if (yMatch) {
      const [a, b] = splitEnds(yMatch[1]!)
      chart.yAxis = { bottom: a, top: b }
      continue
    }

    // quadrant-N <label>
    const quadMatch = line.match(/^quadrant-([1-4])\s+(.+)$/i)
    if (quadMatch) {
      const key = `q${quadMatch[1]}` as 'q1' | 'q2' | 'q3' | 'q4'
      chart.quadrants[key] = stripQuotes(quadMatch[2]!.trim())
      continue
    }

    // <name>: [x, y]
    const point = parsePoint(line)
    if (point) chart.points.push(point)
  }

  return chart
}

/** Split an axis spec into its two ends on `-->` (right may be undefined). */
function splitEnds(spec: string): [string | undefined, string | undefined] {
  const parts = spec.split('-->')
  const left = stripQuotes(parts[0]!.trim())
  const right = parts.length > 1 ? stripQuotes(parts[1]!.trim()) : undefined
  return [left || undefined, right]
}

/** Parse a data point line: `name: [x, y]`. Returns null if it doesn't match. */
function parsePoint(line: string): QuadrantPoint | null {
  const m = line.match(/^(.+?):\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]\s*$/)
  if (!m) return null
  return {
    name: stripQuotes(m[1]!.trim()),
    x: clamp01(parseFloat(m[2]!)),
    y: clamp01(parseFloat(m[3]!)),
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
