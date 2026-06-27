import type { PieChart, PositionedPieChart, PositionedSlice, PieLegendItem } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Pie chart layout engine
//
// Computes pixel geometry for a pie chart + a legend column to its right.
// No ELK needed — slice angles map directly onto a circle.
//
//   angle starts at -90° (top) and sweeps clockwise.
// ============================================================================

const P = {
  radius: 150,
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  legendGap: 28,
  legendRowH: 24,
  legendSwatch: 14,
  legendSwatchGap: 8,
  legendFontSize: 14,
  legendFontWeight: 400,
  innerLabelRadius: 0.62,
} as const

/**
 * Lay out a parsed pie chart by computing pixel geometry.
 */
export function layoutPieChart(chart: PieChart, _options: RenderOptions = {}): PositionedPieChart {
  const hasTitle = !!chart.title
  const R = P.radius
  const top = P.padding + (hasTitle ? P.titleHeight : 0)
  const cx = P.padding + R
  const cy = top + R

  const total = chart.slices.reduce((s, sl) => s + sl.value, 0) || 1

  const legendX = cx + R + P.legendGap
  const legendTextX = legendX + P.legendSwatch + P.legendSwatchGap

  const slices: PositionedSlice[] = []
  const legend: PieLegendItem[] = []
  let maxLegendTextW = 0

  let angle = -Math.PI / 2 // start at top
  chart.slices.forEach((sl, i) => {
    const frac = sl.value / total
    const a0 = angle
    const a1 = angle + frac * Math.PI * 2
    angle = a1
    const percent = frac * 100

    let path: string
    if (frac >= 0.9999) {
      // Single full slice — draw a complete disc (a wedge arc would be degenerate)
      path = `M${rr(cx - R)},${rr(cy)} a${R},${R} 0 1 0 ${rr(2 * R)},0 a${R},${R} 0 1 0 ${rr(-2 * R)},0 Z`
    } else {
      const x0 = cx + R * Math.cos(a0)
      const y0 = cy + R * Math.sin(a0)
      const x1 = cx + R * Math.cos(a1)
      const y1 = cy + R * Math.sin(a1)
      const largeArc = a1 - a0 > Math.PI ? 1 : 0
      path = `M${rr(cx)},${rr(cy)} L${rr(x0)},${rr(y0)} A${R},${R} 0 ${largeArc} 1 ${rr(x1)},${rr(y1)} Z`
    }

    const mid = (a0 + a1) / 2
    const lr = R * P.innerLabelRadius
    slices.push({
      label: sl.label,
      value: sl.value,
      percent,
      path,
      labelX: cx + lr * Math.cos(mid),
      labelY: cy + lr * Math.sin(mid),
      colorIndex: i,
    })

    const rowY = top + i * P.legendRowH + P.legendRowH / 2
    const labelText = chart.showData ? `${sl.label} (${formatVal(sl.value)})` : sl.label
    maxLegendTextW = Math.max(maxLegendTextW, estimateTextWidth(labelText, P.legendFontSize, P.legendFontWeight))
    legend.push({
      label: labelText,
      value: sl.value,
      percent,
      x: legendTextX,
      y: rowY,
      swatchX: legendX,
      swatchY: rowY - P.legendSwatch / 2,
      colorIndex: i,
    })
  })

  const legendBottom = top + chart.slices.length * P.legendRowH
  const width = legendTextX + maxLegendTextW + P.padding
  const height = Math.max(cy + R, legendBottom) + P.padding

  return {
    width,
    height,
    title: hasTitle ? { text: chart.title!, x: width / 2, y: P.padding + P.titleFontSize } : undefined,
    slices,
    legend,
  }
}

function formatVal(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

function rr(n: number): string {
  return String(Math.round(n * 10) / 10)
}

export const PIE_LAYOUT = P
