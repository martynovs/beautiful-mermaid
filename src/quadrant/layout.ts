import type { QuadrantChart, PositionedQuadrantChart, PositionedText, PositionedAxisLabel, PositionedPoint } from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Quadrant chart layout engine
//
// Computes pixel coordinates for a square quadrant plot. No ELK needed —
// the x/y data space (0..1) maps directly onto the plot rectangle.
//
//   xScale(x) = plotX + x * plotSize          (0 = left, 1 = right)
//   yScale(y) = plotY + (1 - y) * plotSize     (0 = bottom, 1 = top → invert)
// ============================================================================

const Q = {
  plotSize: 480,
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  xLabelHeight: 34,
  yLabelStrip: 30,
  pointRadius: 6,
  pointLabelGap: 16,
} as const

/**
 * Lay out a parsed quadrant chart by computing pixel coordinates.
 */
export function layoutQuadrantChart(
  chart: QuadrantChart,
  _options: RenderOptions = {},
): PositionedQuadrantChart {
  const hasTitle = !!chart.title
  const hasXLabels = !!(chart.xAxis.left || chart.xAxis.right)
  const hasYLabels = !!(chart.yAxis.bottom || chart.yAxis.top)

  const size = Q.plotSize
  const top = Q.padding + (hasTitle ? Q.titleHeight : 0)
  const left = Q.padding + (hasYLabels ? Q.yLabelStrip : 0)
  const bottom = Q.padding + (hasXLabels ? Q.xLabelHeight : 0)
  const right = Q.padding

  const plotX = left
  const plotY = top
  const totalW = left + size + right
  const totalH = top + size + bottom

  const plotArea = { x: plotX, y: plotY, width: size, height: size }

  const xScale = (x: number) => plotX + x * size
  const yScale = (y: number) => plotY + (1 - y) * size
  const cx = plotX + size / 2
  const cy = plotY + size / 2

  // Center cross lines
  const crossLines = [
    { x1: cx, y1: plotY, x2: cx, y2: plotY + size },
    { x1: plotX, y1: cy, x2: plotX + size, y2: cy },
  ]

  // Quadrant fills — checkerboard tint (TR + BL tinted)
  const half = size / 2
  const quadrantFills = [
    { x: cx, y: plotY, width: half, height: half, tinted: true },        // q1 TR
    { x: plotX, y: plotY, width: half, height: half, tinted: false },    // q2 TL
    { x: plotX, y: cy, width: half, height: half, tinted: true },        // q3 BL
    { x: cx, y: cy, width: half, height: half, tinted: false },          // q4 BR
  ]

  // Quadrant labels — centered in each region
  const quadrantLabels: PositionedText[] = []
  const pushQuad = (text: string | undefined, qx: number, qy: number) => {
    if (text) quadrantLabels.push({ text, x: qx, y: qy })
  }
  pushQuad(chart.quadrants.q1, plotX + size * 0.75, plotY + size * 0.25) // top-right
  pushQuad(chart.quadrants.q2, plotX + size * 0.25, plotY + size * 0.25) // top-left
  pushQuad(chart.quadrants.q3, plotX + size * 0.25, plotY + size * 0.75) // bottom-left
  pushQuad(chart.quadrants.q4, plotX + size * 0.75, plotY + size * 0.75) // bottom-right

  // Axis labels
  const axisLabels: PositionedAxisLabel[] = []
  const xLabelY = plotY + size + Q.xLabelHeight / 2 + 2
  if (chart.xAxis.left) {
    axisLabels.push({ text: chart.xAxis.left, x: plotX + size * 0.25, y: xLabelY, anchor: 'middle' })
  }
  if (chart.xAxis.right) {
    axisLabels.push({ text: chart.xAxis.right, x: plotX + size * 0.75, y: xLabelY, anchor: 'middle' })
  }
  const yLabelX = plotX - Q.yLabelStrip / 2 - 2
  if (chart.yAxis.bottom) {
    axisLabels.push({ text: chart.yAxis.bottom, x: yLabelX, y: plotY + size * 0.75, anchor: 'middle', rotate: -90 })
  }
  if (chart.yAxis.top) {
    axisLabels.push({ text: chart.yAxis.top, x: yLabelX, y: plotY + size * 0.25, anchor: 'middle', rotate: -90 })
  }

  // Data points
  const points: PositionedPoint[] = chart.points.map(p => {
    const px = xScale(p.x)
    const py = yScale(p.y)
    return {
      name: p.name,
      cx: px,
      cy: py,
      labelX: px,
      labelY: py + Q.pointLabelGap,
    }
  })

  return {
    width: totalW,
    height: totalH,
    title: hasTitle ? { text: chart.title!, x: totalW / 2, y: Q.padding + Q.titleFontSize } : undefined,
    plotArea,
    crossLines,
    quadrantFills,
    quadrantLabels,
    axisLabels,
    points,
  }
}

export const QUADRANT_LAYOUT = Q
