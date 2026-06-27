import type { PacketDiagram, PacketField } from './types.ts'

// ============================================================================
// Packet diagram parser
//
// Parses Mermaid `packet` (and legacy `packet-beta`) syntax into a typed
// PacketDiagram structure.
//
// Supported directives:
//   packet | packet-beta            (header — skipped)
//   title <text>
//   <start>-<end>: "Field name"     (multi-bit range)
//   <bit>: "Field name"             (single bit/byte)
//   +<count>: "Field name"          (bits syntax — continues from prev end)
//
// Quotes around the field name are accepted but optional. Trailing `%%`
// comments are stripped defensively.
// ============================================================================

/**
 * Parse a Mermaid packet diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped. The header line
 * (`packet` / `packet-beta`) is skipped.
 */
export function parsePacketDiagram(lines: string[]): PacketDiagram {
  const diagram: PacketDiagram = { fields: [] }
  let cursor = 0 // next free bit, for the `+<count>` bits syntax

  for (const raw of lines) {
    const line = stripTrailingComment(raw).trim()
    if (!line) continue

    // Header: `packet` or `packet-beta`, optionally with a trailing title
    const headerMatch = line.match(/^packet(?:-beta)?\b(.*)$/i)
    if (headerMatch) {
      const rest = headerMatch[1]!.trim()
      const t = rest.match(/^title\s+(.+)$/i)
      if (t) diagram.title = stripQuotes(t[1]!.trim())
      continue
    }

    // Standalone title line
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      diagram.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    const field = parseField(line, cursor)
    if (field) {
      diagram.fields.push(field)
      cursor = field.end + 1
    }
  }

  return diagram
}

/**
 * Parse a field line. Returns null if it doesn't match.
 * Forms: `start-end: "Label"`, `bit: "Label"`, `+count: "Label"`.
 */
function parseField(line: string, cursor: number): PacketField | null {
  const m = line.match(/^(\+)?(\d+)(?:\s*-\s*(\d+))?\s*:\s*(.+)$/)
  if (!m) return null

  const isCount = m[1] === '+'
  const first = parseInt(m[2]!, 10)
  const second = m[3] !== undefined ? parseInt(m[3]!, 10) : undefined

  let start: number
  let end: number
  if (isCount) {
    // `+count` — `count` bits starting at the current cursor
    const count = first
    if (!Number.isFinite(count) || count < 1) return null
    start = cursor
    end = cursor + count - 1
  } else if (second !== undefined) {
    start = first
    end = second
  } else {
    start = first
    end = first
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null

  const label = stripQuotes(m[4]!.trim())
  if (!label) return null

  return { start, end, label }
}

function stripTrailingComment(s: string): string {
  const i = s.indexOf('%%')
  return i === -1 ? s : s.slice(0, i)
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
