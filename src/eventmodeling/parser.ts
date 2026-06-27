import type { EventModeling, EventFrame, EntityType, SwimlaneId } from './types.ts'

// ============================================================================
// Event modeling parser
//
// Parses Mermaid `eventmodeling` syntax into a typed EventModeling structure.
//
// Supported directives:
//   eventmodeling                          — header (skipped)
//   title <text>                           — optional diagram title
//   tf <NN> <type> <Name>                  — compact time-frame declaration
//   timeframe <NN> <type> <Name>           — relaxed time-frame declaration
//
// `<type>` is one of the five entity types, in compact or relaxed spelling:
//   ui                    → ui   (UI/Automation)
//   pcr  | processor      → pcr  (UI/Automation)
//   cmd  | command        → cmd  (Command/Read Model)
//   rmo  | readmodel      → rmo  (Command/Read Model)
//   evt  | event          → evt  (Events)
//
// `<Name>` may carry an inline data block (`{ ... }`) which is stripped, and a
// `Namespace.Entity` prefix which is preserved as part of the display name.
// ============================================================================

/** Maps both compact and relaxed type spellings to a canonical EntityType. */
const TYPE_ALIASES: Record<string, EntityType> = {
  ui: 'ui',
  pcr: 'pcr',
  processor: 'pcr',
  cmd: 'cmd',
  command: 'cmd',
  rmo: 'rmo',
  readmodel: 'rmo',
  rm: 'rmo',
  evt: 'evt',
  event: 'evt',
}

/** Which swimlane each entity type lives in. */
const TYPE_SWIMLANE: Record<EntityType, SwimlaneId> = {
  ui: 'ui-automation',
  pcr: 'ui-automation',
  cmd: 'command-readmodel',
  rmo: 'command-readmodel',
  evt: 'events',
}

/**
 * Parse a Mermaid event-modeling diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped. The header line is
 * skipped if present.
 */
export function parseEventModeling(lines: string[]): EventModeling {
  const diagram: EventModeling = { frames: [] }
  const seenIds = new Set<string>()

  for (const line of lines) {
    // Header line — skip.
    if (/^eventmodeling\b/i.test(line)) continue

    // title <text>
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      diagram.title = titleMatch[1]!.trim()
      continue
    }

    const frame = parseFrame(line, seenIds)
    if (frame) diagram.frames.push(frame)
  }

  return diagram
}

/**
 * Parse a time-frame line (`tf`/`timeframe <number> <type> <name>`).
 * Returns null when the line doesn't match. Ensures the resulting id is unique
 * across the diagram so element identities never collide.
 */
function parseFrame(line: string, seenIds: Set<string>): EventFrame | null {
  const m = line.match(/^(?:tf|timeframe)\s+(\S+)\s+([A-Za-z]+)\s+(.+)$/i)
  if (!m) return null

  const number = m[1]!.trim()
  const type = TYPE_ALIASES[m[2]!.toLowerCase()]
  if (!type) return null

  // Strip an inline data block and trim whitespace from the name.
  const name = m[3]!.replace(/\{[^}]*\}/g, '').trim()
  if (!name) return null

  const id = uniqueId(number, seenIds)
  const numeric = parseInt(number.replace(/\D/g, ''), 10)

  return {
    number: id,
    numeric: Number.isFinite(numeric) ? numeric : seenIds.size,
    type,
    name,
    swimlane: TYPE_SWIMLANE[type],
  }
}

/** Deterministically disambiguate a colliding frame number. */
function uniqueId(base: string, seen: Set<string>): string {
  let id = base
  let n = 2
  while (seen.has(id)) id = `${base}#${n++}`
  seen.add(id)
  return id
}
