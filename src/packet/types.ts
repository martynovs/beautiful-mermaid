// ============================================================================
// Packet diagram types
//
// Models the parsed and positioned representations of a Mermaid `packet`
// diagram — a byte/bit-field map laid out as a wrapping grid of 32 bits per
// row, each field a rectangle spanning its bit range.
// ============================================================================

/** Parsed packet diagram — logical structure from mermaid text */
export interface PacketDiagram {
  title?: string
  fields: PacketField[]
}

/** A single field occupies an inclusive bit range `[start, end]`. */
export interface PacketField {
  start: number
  end: number
  label: string
}

// ============================================================================
// Positioned packet diagram — ready for SVG rendering
// ============================================================================

export interface PositionedPacketDiagram {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  fields: PositionedPacketField[]
}

export interface PositionedPacketField {
  /** Deterministic, unique-within-diagram id derived from the label */
  id: string
  label: string
  start: number
  end: number
  /** One segment per grid row the field crosses (fields can wrap at 32 bits) */
  segments: PacketSegment[]
}

export interface PacketSegment {
  x: number
  y: number
  width: number
  height: number
  startBit: number
  endBit: number
  /** Center anchor for the field label inside this segment */
  labelX: number
  labelY: number
}
