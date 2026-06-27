import type {
  RadarChart,
  PositionedRadarChart,
  PositionedRadarAxis,
  PositionedRadarSeries,
  PositionedRadarPoint,
  RadarLegendItem,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Radar chart layout engine
//
// Computes pixel geometry for a polar radar plot + a legend column to its right.
// No ELK needed — axis angles map directly onto a circle.
//
//   axis i sits at angle  -90° + 360°·i/n   (top, sweeping clockwise)
//   a value v maps to radius  (v / scaleMax) · R  along its axis
// ============================================================================

const P = {
  radius: 160,
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  /** Extra room around the disc for axis labels */
  labelMargin: 64,
  rings: 4,
  legendGap: 36,
  legendRowH: 24,
  legendSwatch: 14,
  legendSwatchGap: 8,
  legendFontSize: 14,
  legendFontWeight: 400,
} as const

/**
 * Lay out a parsed radar chart by computing pixel geometry.
 */
export function layoutRadarChart(
  chart: RadarChart,
  _options: RenderOptions = {},
): PositionedRadarChart {
  const hasTitle = !!chart.title
  const R = P.radius
  const top = P.padding + (hasTitle ? P.titleHeight : 0)
  const cx = P.padding + P.labelMargin + R
  const cy = top + P.labelMargin + R

  const n = Math.max(chart.axes.length, 1)

  // Radial scale: explicit `max`, else the largest plotted value (min 1).
  const dataMax = chart.series.reduce(
    (m, s) => Math.max(m, ...s.values.map(v => (Number.isFinite(v) ? v : 0))),
    0,
  )
  const scaleMax = chart.max && chart.max > 0 ? chart.max : Math.max(dataMax, 1)

  // Angle for axis i: start at top (-90°), sweep clockwise.
  const angleAt = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n

  // Axes (spokes + outer-ring labels)
  const axes: PositionedRadarAxis[] = chart.axes.map((a, i) => {
    const ang = angleAt(i)
    const x = cx + R * Math.cos(ang)
    const y = cy + R * Math.sin(ang)
    const lx = cx + (R + 18) * Math.cos(ang)
    const ly = cy + (R + 18) * Math.sin(ang)
    const cosA = Math.cos(ang)
    const anchor: 'start' | 'middle' | 'end' =
      Math.abs(cosA) < 0.25 ? 'middle' : cosA > 0 ? 'start' : 'end'
    return { id: a.id, label: a.label, angle: ang, x, y, labelX: lx, labelY: ly, labelAnchor: anchor }
  })

  // Concentric graticule rings (inner → outer)
  const rings: number[] = []
  for (let k = 1; k <= P.rings; k++) rings.push((R * k) / P.rings)

  // Series polygons
  const series: PositionedRadarSeries[] = chart.series.map((s, si) => {
    const points: PositionedRadarPoint[] = []
    for (let i = 0; i < n; i++) {
      const axis = chart.axes[i]
      const axisId = axis ? axis.id : `axis${i}`
      const v = Number.isFinite(s.values[i]!) ? s.values[i]! : 0
      const rr = (Math.max(0, v) / scaleMax) * R
      const ang = angleAt(i)
      points.push({
        id: `${s.id}::${axisId}`,
        axisId,
        value: v,
        x: cx + rr * Math.cos(ang),
        y: cy + rr * Math.sin(ang),
      })
    }
    const path =
      points.length > 0
        ? 'M' + points.map(p => `${rnd(p.x)},${rnd(p.y)}`).join(' L') + ' Z'
        : ''
    return { id: s.id, label: s.label, colorIndex: si, path, points }
  })

  // Legend column to the right of the disc
  const legendX = cx + R + P.labelMargin + P.legendGap
  const legendTextX = legendX + P.legendSwatch + P.legendSwatchGap
  const legend: RadarLegendItem[] = []
  let maxLegendTextW = 0
  chart.series.forEach((s, i) => {
    const rowY = top + i * P.legendRowH + P.legendRowH / 2
    maxLegendTextW = Math.max(
      maxLegendTextW,
      estimateTextWidth(s.label, P.legendFontSize, P.legendFontWeight),
    )
    legend.push({
      label: s.label,
      x: legendTextX,
      y: rowY,
      swatchX: legendX,
      swatchY: rowY - P.legendSwatch / 2,
      colorIndex: i,
    })
  })

  const discBottom = cy + R + P.labelMargin
  const legendBottom = top + chart.series.length * P.legendRowH
  const width =
    chart.series.length > 0 ? legendTextX + maxLegendTextW + P.padding : cx + R + P.labelMargin + P.padding
  const height = Math.max(discBottom, legendBottom) + P.padding

  return {
    width,
    height,
    title: hasTitle ? { text: chart.title!, x: width / 2, y: P.padding + P.titleFontSize } : undefined,
    cx,
    cy,
    radius: R,
    rings,
    axes,
    series,
    legend,
  }
}

function rnd(n: number): string {
  return String(Math.round(n * 10) / 10)
}

export const RADAR_LAYOUT = P
