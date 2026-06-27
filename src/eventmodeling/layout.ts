import type {
  EventModeling, EntityType, SwimlaneId,
  PositionedEventModeling, PositionedFrame, PositionedLane,
  PositionedRelation, AxisLabel,
} from './types.ts'
import type { Point, RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Event modeling layout engine
//
// Computes pixel geometry for an event-modeling diagram. No ELK needed — the
// layout is a fixed grid: one column per time frame (ordered by number) and
// three swimlane rows. Each frame is a single box at (its column, its lane).
// Inferred relations connect consecutive frames as straight, border-clipped
// polylines.
// ============================================================================

const EM = {
  /** Canvas padding around the whole diagram. */
  padding: 32,
  /** Left gutter reserved for swimlane labels. */
  laneLabelWidth: 150,
  /** Height of the time-axis number strip above the lanes. */
  axisHeight: 28,
  /** Reserved height for the optional title. */
  titleHeight: 40,
  titleFontSize: 18,
  /** Horizontal gap between columns. */
  colGap: 28,
  /** Minimum column width. */
  minColWidth: 120,
  /** Box height inside a lane. */
  boxHeight: 56,
  /** Vertical padding above/below the box within its lane band. */
  lanePadV: 18,
  /** Horizontal inset of the box within its column. */
  boxInsetX: 8,
  /** Label font metrics, for column width estimation. */
  labelFontSize: 13,
  labelFontWeight: 500,
} as const

/** Fixed lane order, top to bottom, with display labels. */
const LANES: ReadonlyArray<{ id: SwimlaneId; label: string }> = [
  { id: 'ui-automation', label: 'UI / Automation' },
  { id: 'command-readmodel', label: 'Command / Read Model' },
  { id: 'events', label: 'Events' },
]

/** A distinct palette index per entity type (drives a distinct fill). */
const TYPE_COLOR_INDEX: Record<EntityType, number> = {
  ui: 0,
  pcr: 1,
  cmd: 2,
  rmo: 3,
  evt: 4,
}

/**
 * Lay out a parsed event-modeling diagram by computing pixel coordinates.
 */
export function layoutEventModeling(
  diagram: EventModeling,
  options: RenderOptions = {},
): PositionedEventModeling {
  const padding = options.padding ?? EM.padding
  const colGap = options.nodeSpacing ?? EM.colGap

  const hasTitle = !!diagram.title
  const laneHeight = EM.boxHeight + EM.lanePadV * 2

  // Columns are the frames ordered by their number (stable for ties).
  const ordered = diagram.frames
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.numeric - b.f.numeric || a.i - b.i)
    .map(x => x.f)

  // Uniform column width fits the widest entity name.
  const labelMax = Math.max(
    0,
    ...ordered.map(f => estimateTextWidth(f.name, EM.labelFontSize, EM.labelFontWeight)),
  )
  const colWidth = Math.max(EM.minColWidth, Math.ceil(labelMax) + 32)

  const gridLeft = padding + EM.laneLabelWidth
  const top = padding + (hasTitle ? EM.titleHeight : 0) + EM.axisHeight

  const laneTop = (s: number) => top + s * laneHeight
  const colX = (c: number) => gridLeft + c * (colWidth + colGap)
  const laneIndex = (id: SwimlaneId) => LANES.findIndex(l => l.id === id)

  const cols = ordered.length
  const width = gridLeft + (cols > 0 ? cols * colWidth + (cols - 1) * colGap : 0) + padding
  const height = top + LANES.length * laneHeight + padding

  // Swimlanes.
  const lanes: PositionedLane[] = LANES.map((lane, s) => ({
    id: lane.id,
    label: lane.label,
    y: laneTop(s),
    height: laneHeight,
    labelX: padding,
    labelY: laneTop(s) + laneHeight / 2,
  }))

  // Frame boxes + time-axis labels.
  const frames: PositionedFrame[] = []
  const axis: AxisLabel[] = []
  const byId = new Map<string, PositionedFrame>()

  ordered.forEach((f, c) => {
    const x = colX(c) + EM.boxInsetX
    const w = colWidth - EM.boxInsetX * 2
    const s = laneIndex(f.swimlane)
    const y = laneTop(s) + EM.lanePadV

    const positioned: PositionedFrame = {
      id: f.number,
      number: f.number,
      type: f.type,
      name: f.name,
      swimlane: f.swimlane,
      x, y, width: w, height: EM.boxHeight,
      colorIndex: TYPE_COLOR_INDEX[f.type],
    }
    frames.push(positioned)
    byId.set(f.number, positioned)

    axis.push({
      text: f.number,
      x: colX(c) + colWidth / 2,
      y: top - EM.axisHeight / 2,
    })
  })

  // Inferred relations: connect consecutive frames (the diagram reads as a
  // left-to-right sequence). Each connector is border-clipped at both ends.
  const relations: PositionedRelation[] = []
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i]!
    const b = frames[i + 1]!
    const ca = center(a)
    const cb = center(b)
    relations.push({
      from: a.id,
      to: b.id,
      points: [borderPoint(a, cb), borderPoint(b, ca)],
    })
  }

  return {
    width,
    height,
    title: hasTitle ? { text: diagram.title!, x: width / 2, y: padding + EM.titleFontSize } : undefined,
    lanes,
    axis,
    frames,
    relations,
  }
}

function center(b: PositionedFrame): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/**
 * Find where the ray from the center of `rect` toward `towards` exits the
 * rectangle border, so connectors touch box edges rather than their centers.
 */
function borderPoint(rect: PositionedFrame, towards: Point): Point {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const dx = towards.x - cx
  const dy = towards.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const halfW = rect.width / 2
  const halfH = rect.height / 2
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)

  return { x: cx + dx * scale, y: cy + dy * scale }
}

export const EM_LAYOUT = EM
