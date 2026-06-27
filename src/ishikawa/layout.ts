import type {
  Ishikawa,
  IshikawaCause,
  PositionedIshikawa,
  PositionedCategory,
  PositionedCause,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'

// ============================================================================
// Ishikawa (fishbone) layout engine
//
// No ELK needed — the geometry is a deterministic skeleton:
//
//   - a horizontal spine runs tail (left) → effect head (right)
//   - categories attach at evenly spaced points along the spine and angle
//     outward as bones, alternating above / below the spine
//   - direct causes hang off each category bone as horizontal sub-bones;
//     nested causes recurse outward, stepping further from the spine
//
// Everything is laid out in a local coordinate space (spine on y = 0) while a
// bounding box is accumulated, then the whole drawing is translated so its
// top-left sits at `padding, padding`.
// ============================================================================

const L = {
  padding: 28,
  tailStub: 54,        // spine length left of the first category attachment
  categoryGap: 200,    // horizontal distance between category attachments
  headGap: 72,         // gap from last attachment to the effect head box
  boneAngleDeg: 62,    // angle of category bones from the spine
  baseBoneLen: 92,     // category bone length with no causes
  causeStep: 34,       // extra category bone length per direct cause
  causeLineLen: 70,    // horizontal sub-bone length for a cause
  causeLabelGap: 8,    // gap between a cause sub-bone end and its label
  causeRowH: 26,       // vertical step between nested sub-causes
  causeIndent: 22,     // horizontal step inward for nested sub-causes
  catLabelGap: 12,     // gap between a bone end and its category label
  catFontSize: 14,
  catFontWeight: 600,
  causeFontSize: 12,
  causeFontWeight: 400,
  effectFontSize: 16,
  effectFontWeight: 700,
  headPadX: 16,
  headPadY: 11,
} as const

/**
 * Lay out a parsed ishikawa diagram by computing pixel geometry.
 */
export function layoutIshikawa(d: Ishikawa, _options: RenderOptions = {}): PositionedIshikawa {
  const angle = (L.boneAngleDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // Unique, human-readable ids derived from text + hierarchy, disambiguated.
  const seen = new Set<string>()
  const uniqId = (base: string): string => {
    const root = base.trim() || 'node'
    let id = root
    let n = 2
    while (seen.has(id)) id = `${root}-${n++}`
    seen.add(id)
    return id
  }

  // Bounding box accumulator (local space).
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0
  const track = (x: number, y: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const n = d.categories.length
  const effectId = uniqId(d.effect)

  // Spine geometry (y = 0). Attachment points march left → right.
  const attachX = (i: number) => L.tailStub + i * L.categoryGap
  const headLeftX = (n > 0 ? attachX(n - 1) : L.tailStub) + L.headGap
  track(0, 0)
  track(headLeftX, 0)

  // Effect head box on the right.
  const effectW = estimateTextWidth(d.effect, L.effectFontSize, L.effectFontWeight)
  const boxW = effectW + 2 * L.headPadX
  const boxH = L.effectFontSize + 2 * L.headPadY
  const head = {
    id: effectId,
    text: d.effect,
    x: headLeftX + boxW / 2,
    y: 0,
    boxX: headLeftX,
    boxY: -boxH / 2,
    boxW,
    boxH,
  }
  track(head.boxX, head.boxY)
  track(head.boxX + boxW, head.boxY + boxH)

  const categories: PositionedCategory[] = d.categories.map((cat, i) => {
    const above = i % 2 === 0
    const dir = above ? -1 : 1
    const ax = attachX(i)
    const ay = 0

    const directCount = cat.causes.length
    const boneLen = L.baseBoneLen + directCount * L.causeStep
    const ex = ax - boneLen * cos
    const ey = ay + dir * boneLen * sin

    const catId = uniqId(cat.text)
    const labelX = ex
    const labelY = above ? ey - L.catLabelGap : ey + L.catLabelGap + L.catFontSize
    const catW = estimateTextWidth(cat.text, L.catFontSize, L.catFontWeight)

    track(ax, ay)
    track(ex, ey)
    track(labelX - catW / 2, above ? labelY - L.catFontSize : labelY)
    track(labelX + catW / 2, above ? labelY : labelY)

    // Direct causes branch off points along the bone.
    const causes: PositionedCause[] = []
    cat.causes.forEach((cause, ci) => {
      const t = directCount === 1 ? 0.6 : 0.32 + (0.6 * ci) / (directCount - 1)
      const px = ax - boneLen * cos * t
      const py = ay + dir * boneLen * sin * t
      emitCause(cause, px, py, dir, catId, causes, uniqId, track)
    })

    return { id: catId, text: cat.text, bone: { x1: ax, y1: ay, x2: ex, y2: ey }, labelX, labelY, above, causes }
  })

  // Normalize: translate so the drawing's top-left sits at (padding, padding).
  const dx = L.padding - minX
  const dy = L.padding - minY
  const width = Math.ceil(maxX - minX + 2 * L.padding)
  const height = Math.ceil(maxY - minY + 2 * L.padding)

  const spine = { x1: 0 + dx, y1: 0 + dy, x2: headLeftX + dx, y2: 0 + dy }
  head.x += dx
  head.y += dy
  head.boxX += dx
  head.boxY += dy
  for (const cat of categories) {
    cat.bone.x1 += dx; cat.bone.y1 += dy; cat.bone.x2 += dx; cat.bone.y2 += dy
    cat.labelX += dx; cat.labelY += dy
    for (const cause of cat.causes) {
      cause.bone.x1 += dx; cause.bone.y1 += dy; cause.bone.x2 += dx; cause.bone.y2 += dy
      cause.labelX += dx; cause.labelY += dy
    }
  }

  return { width, height, spine, head, categories }
}

/**
 * Emit a cause (and, recursively, its sub-causes) as horizontal sub-bones.
 * Each cause draws a horizontal line from its attachment point leftward; nested
 * sub-causes step further inward and outward (away from the spine).
 */
function emitCause(
  cause: IshikawaCause,
  px: number,
  py: number,
  dir: number,
  parentId: string,
  out: PositionedCause[],
  uniqId: (base: string) => string,
  track: (x: number, y: number) => void,
): void {
  const qx = px - L.causeLineLen
  const qy = py
  const id = uniqId(cause.text)
  const labelX = qx - L.causeLabelGap
  const labelY = qy
  const w = estimateTextWidth(cause.text, L.causeFontSize, L.causeFontWeight)

  out.push({ id, text: cause.text, parentId, bone: { x1: px, y1: py, x2: qx, y2: qy }, labelX, labelY })
  track(px, py)
  track(qx, qy)
  track(labelX - w, labelY - L.causeFontSize / 2)
  track(labelX, labelY + L.causeFontSize / 2)

  // Nested sub-causes stack outward from the parent cause's label end.
  let sy = qy + dir * L.causeRowH
  for (const sub of cause.causes) {
    emitCause(sub, qx - L.causeIndent, sy, dir, id, out, uniqId, track)
    sy += dir * L.causeRowH
  }
}

export const ISHIKAWA_LAYOUT = L
