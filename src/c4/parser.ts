import type { C4Diagram, C4Element, C4ElementKind, C4ElementVariant, C4Relationship, C4Boundary, C4RelDirection } from './types.ts'

// ============================================================================
// C4 diagram parser
//
// Parses Mermaid C4 syntax into a typed C4Diagram structure.
//
// Supported header keywords (all handled identically):
//   C4Context | C4Container | C4Component | C4Dynamic | C4Deployment
//
// Supported elements (and their `*_Ext` / `*Db` / `*Queue` variants):
//   Person(alias, "label", "descr")
//   System(alias, "label", "descr")        System_Ext(...)
//   Container(alias, "label", "techn", "descr")
//   Component(alias, "label", "techn", "descr")
//
// Relationships:
//   Rel(from, to, "label", "techn"?)
//   Rel_D / Rel_U / Rel_L / Rel_R / Rel_Back / BiRel / RelIndex
//
// Boundaries (brace blocks, may span lines):
//   Enterprise_Boundary(alias, "label") { ... }
//   System_Boundary(alias, "label") { ... }
//   Container_Boundary(alias, "label") { ... }
// ============================================================================

/**
 * Parse a Mermaid C4 diagram from preprocessed lines.
 * Lines should already be trimmed and comment-stripped. The header line is
 * skipped; brace blocks may span multiple lines.
 */
export function parseC4Diagram(lines: string[]): C4Diagram {
  const elements: C4Element[] = []
  const relationships: C4Relationship[] = []
  const boundaries: C4Boundary[] = []

  // Stack of currently-open boundary aliases (innermost last).
  const stack: string[] = []
  // A boundary call whose `{` hasn't been seen yet (brace on the next line).
  let pending: C4Boundary | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Skip the diagram header keyword.
    if (/^C4(Context|Container|Component|Dynamic|Deployment)\b/i.test(line)) continue
    // Skip title and Update*/layout directives — keep elements intact.
    if (/^title\b/i.test(line)) continue

    // Standalone opening brace → promotes the pending boundary.
    if (line === '{') {
      if (pending) {
        stack.push(pending.alias)
        boundaries.push(pending)
        pending = null
      }
      continue
    }

    // Closing brace (optionally followed by an opening brace) closes a boundary.
    if (line.startsWith('}')) {
      stack.pop()
      continue
    }

    const call = parseCall(line)
    if (!call) continue
    const { name, args, openBrace } = call

    // --- Boundary blocks ---
    if (/_Boundary$/i.test(name) || /^(Deployment_Node|Node|Node_L|Node_R)$/i.test(name)) {
      const alias = args[0] ?? ''
      if (!alias) continue
      const boundary: C4Boundary = { alias, label: args[1] || alias, kind: boundaryKind(name) }
      if (openBrace) {
        stack.push(alias)
        boundaries.push(boundary)
      } else {
        pending = boundary
      }
      continue
    }

    // --- Relationships ---
    if (/^(Rel|BiRel)/i.test(name)) {
      const rel = parseRelationship(name, args)
      if (rel) relationships.push(rel)
      continue
    }

    // --- Elements ---
    const element = parseElement(name, args, stack[stack.length - 1])
    if (element) elements.push(element)
  }

  return { elements, relationships, boundaries }
}

// ============================================================================
// Line parsing
// ============================================================================

interface ParsedCall {
  name: string
  args: string[]
  /** Whether the line ends with an opening brace (boundary block start). */
  openBrace: boolean
}

/** Parse a `Name(arg, arg, ...)` call, optionally followed by `{`. */
function parseCall(line: string): ParsedCall | null {
  const m = line.match(/^([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*(\{)?\s*$/)
  if (!m) return null
  return { name: m[1]!, args: splitArgs(m[2]!), openBrace: !!m[3] }
}

/**
 * Split the comma-separated argument list of a call, honoring quoted strings
 * (commas inside quotes don't split) and stripping surrounding quotes.
 */
function splitArgs(inner: string): string[] {
  const args: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ',') {
      args.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim() || args.length > 0) args.push(cur.trim())
  // Drop trailing named args ($tags=..., $link=...) — keep positional values.
  return args.map(a => a.trim())
}

/** Map a boundary function name to a coarse kind. */
function boundaryKind(name: string): string {
  const lower = name.toLowerCase()
  if (lower.startsWith('enterprise')) return 'enterprise'
  if (lower.startsWith('system')) return 'system'
  if (lower.startsWith('container')) return 'container'
  return 'deployment'
}

/** Parse a Person/System/Container/Component element call. */
function parseElement(name: string, args: string[], boundary?: string): C4Element | null {
  const lower = name.toLowerCase()
  let kind: C4ElementKind
  if (lower.startsWith('person')) kind = 'person'
  else if (lower.startsWith('system')) kind = 'system'
  else if (lower.startsWith('container')) kind = 'container'
  else if (lower.startsWith('component')) kind = 'component'
  else return null

  const alias = args[0] ?? ''
  if (!alias) return null

  const external = /_ext$/i.test(name)
  // `*Db` / `*Queue` forms (optionally `_Ext`) keep their coarse kind but
  // carry a storage-shape variant that drives the icon glyph.
  let variant: C4ElementVariant | undefined
  if (/db(_ext)?$/i.test(name)) variant = 'db'
  else if (/queue(_ext)?$/i.test(name)) variant = 'queue'
  const label = args[1] || alias

  let techn: string | undefined
  let descr: string | undefined
  if (kind === 'container' || kind === 'component') {
    techn = cleanArg(args[2])
    descr = cleanArg(args[3])
  } else {
    descr = cleanArg(args[2])
  }

  return { alias, kind, variant, label, techn, descr, external, boundary }
}

/** Parse a Rel / BiRel / Rel_* / RelIndex relationship call. */
function parseRelationship(name: string, args: string[]): C4Relationship | null {
  const lower = name.toLowerCase()
  const bidirectional = lower.startsWith('birel')
  const isIndexed = lower === 'relindex'

  // RelIndex(index, from, to, label, ...) shifts the positional args by one.
  const base = isIndexed ? 1 : 0
  const from = args[base] ?? ''
  const to = args[base + 1] ?? ''
  if (!from || !to) return null
  const label = args[base + 2] ?? ''
  const techn = cleanArg(args[base + 3])

  return { from, to, label, techn, direction: relDirection(name), bidirectional }
}

/** Extract a directional hint from a `Rel_*` suffix. */
function relDirection(name: string): C4RelDirection | undefined {
  const m = name.match(/_(u|up|d|down|l|left|r|right)$/i)
  if (!m) return undefined
  const s = m[1]!.toLowerCase()
  if (s === 'u' || s === 'up') return 'up'
  if (s === 'd' || s === 'down') return 'down'
  if (s === 'l' || s === 'left') return 'left'
  if (s === 'r' || s === 'right') return 'right'
  return undefined
}

/** Normalize an optional arg: drop empties and named ($foo=...) args. */
function cleanArg(value: string | undefined): string | undefined {
  if (value == null) return undefined
  const v = value.trim()
  if (!v) return undefined
  if (/^\$?\w+\s*=/.test(v)) return undefined
  return v
}
