import type { VennDiagram, VennSet, VennUnion } from './types.ts'

// ============================================================================
// Venn diagram parser
//
// Parses the Mermaid `venn-beta` syntax into a typed VennDiagram structure.
//
// Supported directives (a reasonable subset of the beta grammar):
//   venn-beta | venn          header (skipped)
//   title <text>              optional diagram title
//   set <Id>                  define a set; <Id> bareword or "Quoted"
//   set <Id>["Display Label"] define a set with a separate display label
//   union <A>, <B> [, <C>...]  an overlap region referencing prior sets
//   text "<label>"            label attached to the most recent set/union
//
// A trailing `:N` size suffix (e.g. `set A:50`) is accepted but ignored.
// ============================================================================

type Target =
  | { kind: 'set'; ref: VennSet }
  | { kind: 'union'; ref: VennUnion }

/**
 * Parse a Mermaid venn diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseVennDiagram(lines: string[]): VennDiagram {
  const diagram: VennDiagram = { sets: [], unions: [] }
  let current: Target | null = null

  for (const line of lines) {
    // Header: `venn` / `venn-beta` — skip
    if (/^venn(-beta)?\b/i.test(line)) continue

    // Title
    const t = line.match(/^title\s+(.+)$/i)
    if (t) {
      diagram.title = stripQuotes(t[1]!.trim())
      continue
    }

    // Set declaration
    const s = line.match(/^set\s+(.+)$/i)
    if (s) {
      const set = parseSetDecl(s[1]!.trim())
      if (set) {
        diagram.sets.push(set)
        current = { kind: 'set', ref: set }
      }
      continue
    }

    // Union / intersection region
    const u = line.match(/^union\s+(.+)$/i)
    if (u) {
      const union = parseUnionDecl(u[1]!.trim(), diagram.sets, diagram.unions)
      if (union) {
        diagram.unions.push(union)
        current = { kind: 'union', ref: union }
      }
      continue
    }

    // Text label — attaches to the most recent set or union
    const tx = line.match(/^text\s+(.+)$/i)
    if (tx) {
      const label = parseTextDecl(tx[1]!.trim())
      if (label && current) {
        if (current.kind === 'set') current.ref.label = label
        else current.ref.label = label
      }
      continue
    }
  }

  return diagram
}

// ----------------------------------------------------------------------------
// Declaration parsers
// ----------------------------------------------------------------------------

/** Parse `Id`, `"Quoted"`, `Id["Display"]`, or `"Quoted"["Display"]`. */
function parseSetDecl(raw: string): VennSet | null {
  const s = stripSize(raw)
  const m = s.match(/^(?:"([^"]*)"|([^\s["':]+))\s*(?:\[\s*"?([^"\]]*?)"?\s*\])?\s*$/)
  if (!m) return null
  const id = (m[1] ?? m[2] ?? '').trim()
  if (!id) return null
  const label = (m[3] ?? '').trim() || id
  return { id, label }
}

/** Parse `A, B [, C ...]` with an optional trailing `["label"]`. */
function parseUnionDecl(raw: string, sets: VennSet[], unions: VennUnion[]): VennUnion | null {
  let s = stripSize(raw)

  let label: string | undefined
  const lm = s.match(/\[\s*"?([^"\]]*?)"?\s*\]\s*$/)
  if (lm) {
    label = lm[1]!.trim() || undefined
    s = s.slice(0, lm.index).trim()
  }

  const parts = s
    .split(',')
    .map(p => stripQuotes(p.trim()))
    .filter(Boolean)
  if (parts.length < 2) return null

  // Resolve each reference to a known set id (match by id, then by label).
  const setIds = parts.map(p => {
    const found = sets.find(st => st.id === p) ?? sets.find(st => st.label === p)
    return found ? found.id : p
  })

  const id = uniqueId(setIds.join('∩'), unions)
  return { id, setIds, label }
}

/** Parse `["label"]`, `"label"`, or a bare label. */
function parseTextDecl(raw: string): string | null {
  const b = raw.match(/^\[\s*"?([^"\]]*?)"?\s*\]$/)
  if (b) return b[1]!.trim() || null
  return stripQuotes(raw).trim() || null
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Strip a trailing `:N` size suffix (kept simple — ids never end in `:digits`). */
function stripSize(s: string): string {
  return s.replace(/:\s*\d+(?:\.\d+)?\s*$/, '').trim()
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

/** Ensure the union id is unique within the diagram (disambiguate duplicates). */
function uniqueId(base: string, unions: VennUnion[]): string {
  const taken = new Set(unions.map(u => u.id))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}#${i}`)) i++
  return `${base}#${i}`
}
