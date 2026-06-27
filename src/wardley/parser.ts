import type { WardleyMap, WardleyComponent, WardleyLink, WardleyComponentKind, WardleyLinkStyle } from './types.ts'

// ============================================================================
// Wardley map parser
//
// Parses the Mermaid `wardley-beta` (also `wardley`) syntax into a typed
// WardleyMap. Lines arrive already trimmed and comment-stripped; the header
// line is skipped here defensively.
//
// Supported subset:
//   wardley-beta | wardley                 (header, skipped)
//   title <text>
//   component <Name> [visibility, evolution]   (coords both 0..1)
//   anchor <Name> [visibility, evolution]      (a user / customer node)
//   <Name> [visibility, evolution]             (bare form, treated as component)
//   A -> B            solid dependency
//   A --> B           solid dependency (alt)
//   A -.-> B          dashed dependency
//   A +> B            flow dependency
//   A -> B; label     dependency with inline annotation
//
// Coordinate order matches Mermaid/OWM: [visibility, evolution] — visibility
// first (Y, value chain), evolution second (X). Both are clamped to 0..1.
// ============================================================================

/**
 * Parse a Mermaid wardley map from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseWardleyMap(lines: string[]): WardleyMap {
  const map: WardleyMap = { components: [], links: [] }

  for (const line of lines) {
    // Header: `wardley` / `wardley-beta` (possibly trailing text) — skip.
    if (/^wardley(-beta)?\b/i.test(line)) continue

    // Title line.
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      map.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    // Component / anchor with [visibility, evolution] coordinates.
    const comp = parseComponent(line)
    if (comp) {
      map.components.push(comp)
      continue
    }

    // Dependency link.
    const link = parseLink(line)
    if (link) {
      map.links.push(link)
      continue
    }
  }

  return map
}

/** Parse `component|anchor Name [v, e]` (keyword optional). Returns null on miss. */
function parseComponent(line: string): WardleyComponent | null {
  const m = line.match(
    /^(?:(component|anchor)\s+)?(.+?)\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]\s*$/i,
  )
  if (!m) return null

  const kind: WardleyComponentKind = (m[1] ?? 'component').toLowerCase() === 'anchor' ? 'anchor' : 'component'
  const name = stripQuotes(m[2]!.trim())
  if (!name) return null

  const visibility = clamp01(parseFloat(m[3]!))
  const evolution = clamp01(parseFloat(m[4]!))
  if (!Number.isFinite(visibility) || !Number.isFinite(evolution)) return null

  return { name, visibility, evolution, kind }
}

/** Parse a dependency link `A -> B` / `A -.-> B` / `A +> B` (`; label` optional). */
function parseLink(line: string): WardleyLink | null {
  // Operator alternation ordered longest-first so `-->` beats `->`.
  const m = line.match(/^(.+?)\s*(-\.->|-->|->|\+>)\s*([^;]+?)\s*(?:;\s*(.+?)\s*)?$/)
  if (!m) return null

  const from = stripQuotes(m[1]!.trim())
  const to = stripQuotes(m[3]!.trim())
  if (!from || !to) return null

  const op = m[2]!
  const style: WardleyLinkStyle = op === '-.->' ? 'dashed' : op === '+>' ? 'flow' : 'solid'
  const label = m[4]?.trim()

  return { from, to, label: label || undefined, style }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
