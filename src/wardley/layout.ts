import type {
  WardleyMap,
  PositionedWardleyMap,
  PositionedText,
  PositionedAxisLabel,
  PositionedComponent,
  PositionedLink,
} from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Wardley map layout engine
//
// Computes pixel coordinates for a square wardley plot. Like the quadrant
// chart, the [visibility, evolution] data space (both 0..1) maps directly onto
// the plot rectangle — no ELK needed:
//
//   xScale(evolution)  = plotX + evolution * size           (0 = left, 1 = right)
//   yScale(visibility) = plotY + (1 - visibility) * size    (0 = bottom → invert)
//
// The evolution axis is divided into the four classic Wardley stages
// (Genesis · Custom-Built · Product · Commodity) by dashed gridlines.
// ============================================================================

const W = {
  plotSize: 480,
  padding: 24,
  titleHeight: 40,
  titleFontSize: 18,
  /** Room below the plot for stage labels + the evolution end labels. */
  xLabelHeight: 48,
  yLabelStrip: 30,
  dotRadius: 6,
  labelGap: 16,
} as const

/** The four canonical evolution stages, with the center of each quarter. */
const STAGES = ['Genesis', 'Custom-Built', 'Product', 'Commodity'] as const

/**
 * Lay out a parsed wardley map by computing pixel coordinates.
 */
export function layoutWardleyMap(
  map: WardleyMap,
  _options: RenderOptions = {},
): PositionedWardleyMap {
  const hasTitle = !!map.title

  const size = W.plotSize
  const top = W.padding + (hasTitle ? W.titleHeight : 0)
  const left = W.padding + W.yLabelStrip
  const bottom = W.padding + W.xLabelHeight
  const right = W.padding

  const plotX = left
  const plotY = top
  const totalW = left + size + right
  const totalH = top + size + bottom

  const plotArea = { x: plotX, y: plotY, width: size, height: size }

  const xScale = (evolution: number) => plotX + evolution * size
  const yScale = (visibility: number) => plotY + (1 - visibility) * size

  // Evolution stage divider lines at 0.25 / 0.5 / 0.75.
  const gridLines = [0.25, 0.5, 0.75].map(e => ({
    x1: xScale(e),
    y1: plotY,
    x2: xScale(e),
    y2: plotY + size,
  }))

  // Stage labels centered in each quarter, below the plot.
  const stageY = plotY + size + 16
  const stageLabels: PositionedText[] = STAGES.map((text, i) => ({
    text,
    x: xScale((i + 0.5) / STAGES.length),
    y: stageY,
  }))

  // Axis labels — evolution ends below the plot, visibility rotated at the left.
  const axisY = plotY + size + W.xLabelHeight - 6
  const axisLabels: PositionedAxisLabel[] = [
    { text: 'Evolution', x: plotX + size / 2, y: axisY, anchor: 'middle' },
    { text: 'Visibility', x: plotX - W.yLabelStrip / 2 - 2, y: plotY + size / 2, anchor: 'middle', rotate: -90 },
  ]

  // Components — disambiguate duplicate names into unique ids and map [v, e].
  const idCounts = new Map<string, number>()
  const idByName = new Map<string, string>()
  const components: PositionedComponent[] = map.components.map(c => {
    const seen = idCounts.get(c.name) ?? 0
    idCounts.set(c.name, seen + 1)
    const id = seen === 0 ? c.name : `${c.name}#${seen + 1}`
    if (!idByName.has(c.name)) idByName.set(c.name, id) // first occurrence wins for links

    const cx = xScale(c.evolution)
    const cy = yScale(c.visibility)
    return {
      id,
      name: c.name,
      kind: c.kind,
      cx,
      cy,
      labelX: cx,
      labelY: cy + W.labelGap,
    }
  })

  // Links — resolve endpoints to component centers; drop dangling links.
  const byId = new Map(components.map(c => [c.id, c]))
  const links: PositionedLink[] = []
  for (const l of map.links) {
    const fromId = idByName.get(l.from)
    const toId = idByName.get(l.to)
    if (!fromId || !toId) continue
    const a = byId.get(fromId)
    const b = byId.get(toId)
    if (!a || !b) continue
    links.push({ from: fromId, to: toId, style: l.style, x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy })
  }

  return {
    width: totalW,
    height: totalH,
    title: hasTitle ? { text: map.title!, x: totalW / 2, y: W.padding + W.titleFontSize } : undefined,
    plotArea,
    gridLines,
    stageLabels,
    axisLabels,
    links,
    components,
  }
}

export const WARDLEY_LAYOUT = W
