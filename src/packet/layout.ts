import type { PacketDiagram, PositionedPacketDiagram, PositionedPacketField, PacketSegment } from './types.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Packet diagram layout engine
//
// Lays fields out as a wrapping grid of 32 bits per row (the standard packet
// diagram width). Each field becomes one or more rectangles — a field that
// crosses a 32-bit boundary is split into one segment per row it occupies.
// No ELK needed: bit index maps directly onto a column.
// ============================================================================

const P = {
  bitsPerRow: 32,
  cellWidth: 26,
  rectHeight: 32,
  numberStripH: 16,
  rowGap: 10,
  padding: 24,
  titleHeight: 38,
  titleFontSize: 18,
} as const

/**
 * Lay out a parsed packet diagram by computing pixel geometry.
 */
export function layoutPacketDiagram(
  diagram: PacketDiagram,
  _options: RenderOptions = {},
): PositionedPacketDiagram {
  const hasTitle = !!diagram.title
  const top = P.padding + (hasTitle ? P.titleHeight : 0)
  const rowBlockH = P.numberStripH + P.rectHeight + P.rowGap

  const maxEndBit = diagram.fields.reduce((m, f) => Math.max(m, f.end), -1)
  const rowCount = maxEndBit >= 0 ? Math.floor(maxEndBit / P.bitsPerRow) + 1 : 0

  const usedIds = new Map<string, number>()
  const fields: PositionedPacketField[] = diagram.fields.map(f => {
    const id = makeUniqueId(f.label, usedIds)
    const segments: PacketSegment[] = []

    let bit = f.start
    while (bit <= f.end) {
      const row = Math.floor(bit / P.bitsPerRow)
      const rowLastBit = (row + 1) * P.bitsPerRow - 1
      const segEnd = Math.min(f.end, rowLastBit)
      const colStart = bit - row * P.bitsPerRow
      const colEnd = segEnd - row * P.bitsPerRow

      const x = P.padding + colStart * P.cellWidth
      const width = (colEnd - colStart + 1) * P.cellWidth
      const y = top + row * rowBlockH + P.numberStripH

      segments.push({
        x,
        y,
        width,
        height: P.rectHeight,
        startBit: bit,
        endBit: segEnd,
        labelX: x + width / 2,
        labelY: y + P.rectHeight / 2,
      })

      bit = segEnd + 1
    }

    return { id, label: f.label, start: f.start, end: f.end, segments }
  })

  const width = P.padding * 2 + P.bitsPerRow * P.cellWidth
  const height = rowCount > 0 ? top + rowCount * rowBlockH - P.rowGap + P.padding : top + P.padding

  return {
    width,
    height,
    title: hasTitle ? { text: diagram.title!, x: width / 2, y: P.padding + P.titleFontSize } : undefined,
    fields,
  }
}

/**
 * Derive a deterministic, unique-within-diagram id from a field label.
 * Duplicate labels get a numeric suffix so every data-id is unique.
 */
function makeUniqueId(label: string, used: Map<string, number>): string {
  const base = slugify(label) || 'field'
  const seen = used.get(base) ?? 0
  used.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen + 1}`
}

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const PACKET_LAYOUT = P
