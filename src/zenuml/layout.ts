import type { ZenUML, ZenFragment, PositionedZenUML, PositionedParticipant, ZenLifeline, PositionedZenMessage, PositionedZenFragment } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// ZenUML layout engine
//
// Self-contained timeline layout (no ELK) — mirrors the sequence diagram:
//   1. Space participants horizontally based on label widths + a min gap.
//   2. Stack messages vertically in source order.
//   3. Run vertical lifelines from each participant box to the diagram bottom.
// ============================================================================

const ZEN = {
  /** Padding around the entire diagram */
  padding: 30,
  /** Minimum gap between participant centers */
  participantGap: 140,
  /** Participant box height */
  participantHeight: 40,
  /** Horizontal padding inside participant boxes */
  participantPadX: 16,
  /** Vertical space between participant boxes and first message */
  headerGap: 24,
  /** Vertical space per message row */
  messageRowHeight: 42,
  /** Extra vertical space for self-messages (they loop back) */
  selfMessageHeight: 30,
  /** Minimum participant box width */
  minParticipantWidth: 80,
  /** Vertical space reserved above a message for a fragment header/tab */
  fragmentHeaderHeight: 30,
  /** Vertical space reserved above a message for a fragment section divider */
  fragmentSectionHeight: 22,
  /** Vertical padding below the last inner message before a fragment closes */
  fragmentBottomPad: 12,
  /** Horizontal padding from the spanned lifelines to the fragment box edges */
  fragmentPadX: 14,
} as const

/**
 * Lay out a parsed ZenUML diagram into absolute coordinates.
 */
export function layoutZenUML(
  diagram: ZenUML,
  _options: RenderOptions = {},
): PositionedZenUML {
  if (diagram.participants.length === 0) {
    return { width: 0, height: 0, participants: [], lifelines: [], messages: [], fragments: [] }
  }

  // 1. Participant widths (account for annotator stereotype line too).
  const widths = diagram.participants.map(p => {
    const labelW = estimateTextWidth(p.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
    const annW = p.annotator
      ? estimateTextWidth(`«${p.annotator}»`, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      : 0
    return Math.max(Math.max(labelW, annW) + ZEN.participantPadX * 2, ZEN.minParticipantWidth)
  })

  // Horizontal centers with a minimum gap between neighbours.
  const centerX: number[] = []
  let cursor = ZEN.padding + widths[0]! / 2
  for (let i = 0; i < diagram.participants.length; i++) {
    if (i > 0) {
      const minGap = Math.max(ZEN.participantGap, (widths[i - 1]! + widths[i]!) / 2 + 40)
      cursor += minGap
    }
    centerX.push(cursor)
  }

  const indexById = new Map<string, number>()
  diagram.participants.forEach((p, i) => indexById.set(p.id, i))

  // 2. Position participant boxes at the top.
  const topY = ZEN.padding
  const participants: PositionedParticipant[] = diagram.participants.map((p, i) => ({
    id: p.id,
    label: p.label,
    ...(p.annotator ? { annotator: p.annotator } : {}),
    x: centerX[i]!,
    y: topY,
    width: widths[i]!,
    height: ZEN.participantHeight,
  }))

  // 3. Stack messages vertically in source order, reserving vertical space for
  //    fragment headers (when a fragment opens), section dividers, and bottom
  //    padding (when a fragment closes). Fragment box extents are recorded as
  //    we go so nested fragments inset naturally.
  const opensAt = new Map<number, ZenFragment[]>()
  const closesAt = new Map<number, ZenFragment[]>()
  const sectionAt = new Map<number, ZenFragment['sections']>()
  for (const f of diagram.fragments) {
    push(opensAt, f.startIndex, f)
    push(closesAt, f.endIndex, f)
    for (const s of f.sections) {
      const list = sectionAt.get(s.index) ?? []
      list.push(s)
      sectionAt.set(s.index, list)
    }
  }
  // Outermost fragments open first (smaller top) and close last (larger bottom).
  for (const list of opensAt.values()) list.sort((a, b) => a.depth - b.depth)
  for (const list of closesAt.values()) list.sort((a, b) => b.depth - a.depth)

  const fragBox = new Map<ZenFragment, { topY: number; bottomY: number }>()
  const sectionY = new Map<ZenUML['fragments'][number]['sections'][number], number>()

  let messageY = topY + ZEN.participantHeight + ZEN.headerGap
  const messages: PositionedZenMessage[] = []
  for (let i = 0; i < diagram.messages.length; i++) {
    // Fragments opening here reserve header space (outermost first).
    for (const f of opensAt.get(i) ?? []) {
      fragBox.set(f, { topY: messageY, bottomY: messageY })
      messageY += ZEN.fragmentHeaderHeight
    }
    // Section dividers beginning here reserve a divider row.
    for (const s of sectionAt.get(i) ?? []) {
      sectionY.set(s, messageY)
      messageY += ZEN.fragmentSectionHeight
    }

    const m = diagram.messages[i]!
    const fromIdx = indexById.get(m.from) ?? 0
    const toIdx = indexById.get(m.to) ?? 0
    const isSelf = m.from === m.to

    messages.push({
      from: m.from,
      to: m.to,
      label: m.label,
      kind: m.kind,
      lineStyle: m.lineStyle,
      arrowHead: m.arrowHead,
      x1: centerX[fromIdx]!,
      x2: centerX[toIdx]!,
      y: messageY,
      isSelf,
    })

    messageY += isSelf
      ? ZEN.selfMessageHeight + ZEN.messageRowHeight
      : ZEN.messageRowHeight

    // Fragments whose last inner message was `i` close here.
    for (const f of closesAt.get(i + 1) ?? []) {
      messageY += ZEN.fragmentBottomPad
      const box = fragBox.get(f)
      if (box) box.bottomY = messageY
    }
  }

  // Any fragments that never enclosed a message (or opened past the last
  // message) get a minimal box so they still render.
  for (const f of diagram.fragments) {
    if (!fragBox.has(f)) {
      fragBox.set(f, { topY: messageY, bottomY: messageY + ZEN.fragmentHeaderHeight })
      messageY += ZEN.fragmentHeaderHeight + ZEN.fragmentBottomPad
    }
    const box = fragBox.get(f)!
    if (box.bottomY <= box.topY + ZEN.fragmentHeaderHeight) {
      box.bottomY = box.topY + ZEN.fragmentHeaderHeight + 10
    }
  }

  const diagramBottom = messageY + ZEN.padding

  // 3b. Resolve fragment boxes — horizontal span from the lifelines they touch.
  const fragments: PositionedZenFragment[] = diagram.fragments.map(f => {
    let left = Infinity
    let right = -Infinity
    for (let i = f.startIndex; i < f.endIndex; i++) {
      const m = diagram.messages[i]
      if (!m) continue
      const a = centerX[indexById.get(m.from) ?? 0]!
      const b = centerX[indexById.get(m.to) ?? 0]!
      left = Math.min(left, a, b)
      right = Math.max(right, a, b)
      if (m.from === m.to) right = Math.max(right, a + 30) // self-message loop
    }
    if (!isFinite(left)) {
      // Empty fragment — span all participants.
      left = centerX[0]!
      right = centerX[centerX.length - 1]!
    }
    const pad = Math.max(ZEN.fragmentPadX - f.depth * 3, 6)
    const box = fragBox.get(f)!
    const boxLeft = left - pad
    const boxRight = right + pad
    return {
      type: f.type,
      label: f.label,
      x: boxLeft,
      y: box.topY,
      width: boxRight - boxLeft,
      height: box.bottomY - box.topY,
      depth: f.depth,
      dividers: f.sections.map(s => ({
        y: sectionY.get(s) ?? box.topY,
        keyword: s.keyword,
        label: s.label,
      })),
    }
  })
  // Draw outermost fragments first (behind nested ones).
  fragments.sort((a, b) => a.depth - b.depth)

  // 4. Lifelines from each participant box to the bottom.
  const lifelines: ZenLifeline[] = diagram.participants.map((p, i) => ({
    participantId: p.id,
    x: centerX[i]!,
    topY: topY + ZEN.participantHeight,
    bottomY: diagramBottom - ZEN.padding,
  }))

  // 5. Diagram bounds — include self-message loop labels on the right.
  let maxX = 0
  for (let i = 0; i < participants.length; i++) {
    maxX = Math.max(maxX, participants[i]!.x + widths[i]! / 2)
  }
  for (const m of messages) {
    if (m.isSelf && m.label) {
      const loopW = 30
      const labelW = estimateTextWidth(m.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      maxX = Math.max(maxX, m.x1 + loopW + 8 + labelW + 8)
    }
  }
  // Fragment boxes (and their header tabs) may extend past the lifelines.
  for (const f of fragments) {
    maxX = Math.max(maxX, f.x + f.width)
    const tabW = estimateTextWidth(
      `${f.type}${f.label ? ` [${f.label}]` : ''}`,
      FONT_SIZES.edgeLabel,
      FONT_WEIGHTS.groupHeader,
    ) + 16
    maxX = Math.max(maxX, f.x + tabW)
  }

  return {
    width: Math.max(maxX + ZEN.padding, 200),
    height: Math.max(diagramBottom, 100),
    participants,
    lifelines,
    messages,
    fragments,
  }
}

/** Push a value onto a Map-of-arrays. */
function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key) ?? []
  list.push(value)
  map.set(key, list)
}
