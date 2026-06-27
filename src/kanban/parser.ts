import type { Kanban, KanbanColumn, KanbanCard, KanbanCardMetadata } from './types.ts'

// ============================================================================
// Kanban parser
//
// Parses Mermaid `kanban` syntax into a typed Kanban board.
//
// Supported syntax:
//   kanban                                    (header)
//   title <text>                              (optional)
//   colId[Column Title]                       (a column)
//       cardId[Card text]                     (a card, indented under a column)
//       cardId[Card text]@{ assigned: 'x', priority: 'High' }
//
// IMPORTANT — indentation drives the column/card split. A line is a COLUMN
// when its leading whitespace is at (or below) the first node's indent level;
// anything more indented is a CARD belonging to the most recent column. This
// parser therefore MUST receive the RAW lines split only on '\n'. Do NOT
// pre-trim the lines before calling parseKanban: trimming destroys the
// indentation and collapses every card into a column. The shared dispatcher in
// src/index.ts trims lines — kanban must be wired to pass raw, untrimmed lines
// instead (see the treemap/ishikawa cases for the same pattern).
// ============================================================================

/**
 * Parse a Mermaid kanban board from raw (untrimmed) lines.
 *
 * @param lines Source lines split on '\n' WITHOUT trimming — leading spaces/tabs
 *   are required to tell columns from cards. Comment lines (`%%`) are skipped.
 */
export function parseKanban(lines: string[]): Kanban {
  const kanban: Kanban = { columns: [] }
  const usedIds = new Set<string>()

  let columnIndent: number | null = null
  let current: KanbanColumn | null = null

  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const stripped = raw.trim()
    if (stripped.startsWith('%%')) continue

    // Header: `kanban`
    if (/^kanban\b/i.test(stripped)) continue

    // Optional standalone title (no bracket — distinguishes from a `title[...]` node)
    const titleMatch = stripped.match(/^title\s+(.+)$/i)
    if (titleMatch && !stripped.includes('[')) {
      kanban.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    const node = parseNodeLine(stripped)
    if (!node) continue

    const indent = leadingIndent(raw)
    if (columnIndent === null) columnIndent = indent

    // Shallowest indent (or anything when no column is open yet) → column.
    const isColumn = current === null || indent <= columnIndent

    if (isColumn) {
      current = { id: uniqueId(node.id, usedIds), title: node.text, cards: [] }
      kanban.columns.push(current)
    } else {
      const card: KanbanCard = { id: uniqueId(node.id, usedIds), text: node.text }
      if (node.metadata) card.metadata = node.metadata
      current!.cards.push(card)
    }
  }

  return kanban
}

// ----------------------------------------------------------------------------
// Line parsing
// ----------------------------------------------------------------------------

interface ParsedNode {
  id: string
  text: string
  metadata?: KanbanCardMetadata
}

/** Parse a node line (already trimmed): `id[Text]` with optional `@{ ... }`. */
function parseNodeLine(line: string): ParsedNode | null {
  let rest = line
  let metadata: KanbanCardMetadata | undefined

  // Split off a trailing metadata block `@{ ... }`.
  const metaIdx = rest.indexOf('@{')
  if (metaIdx !== -1) {
    metadata = parseMetadata(rest.slice(metaIdx))
    rest = rest.slice(0, metaIdx).trim()
  }

  // `id[Label]`
  const m = rest.match(/^([A-Za-z0-9_-]+)\s*\[(.*)\]\s*$/)
  if (m) return { id: m[1]!, text: stripQuotes(m[2]!.trim()), metadata }

  // Bare `id` (label == id)
  const bare = rest.match(/^([A-Za-z0-9_-]+)\s*$/)
  if (bare) return { id: bare[1]!, text: bare[1]!, metadata }

  return null
}

/** Parse `@{ assigned: 'x', ticket: "Y", priority: High }` → metadata object. */
function parseMetadata(block: string): KanbanCardMetadata | undefined {
  const inner = block.replace(/^@\{/, '').replace(/\}\s*$/, '')
  const meta: KanbanCardMetadata = {}
  const re = /([A-Za-z_][\w-]*)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/g
  let m: RegExpExecArray | null
  let found = false
  while ((m = re.exec(inner)) !== null) {
    const key = m[1]!
    const value = (m[2] ?? m[3] ?? m[4] ?? '').trim()
    meta[key] = value
    found = true
  }
  return found ? meta : undefined
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Count leading whitespace columns (tabs expand to 4). */
function leadingIndent(line: string): number {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n += 1
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

/** Ensure every emitted id is unique within the board (identity contract). */
function uniqueId(id: string, used: Set<string>): string {
  if (!used.has(id)) {
    used.add(id)
    return id
  }
  let n = 2
  while (used.has(`${id}#${n}`)) n += 1
  const out = `${id}#${n}`
  used.add(out)
  return out
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
