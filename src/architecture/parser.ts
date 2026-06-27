import type { Architecture, ArchGroup, ArchService, ArchJunction, ArchEdge, Side } from './types.ts'

// ============================================================================
// Architecture (architecture-beta) parser
//
// Parses Mermaid `architecture-beta` syntax into a typed Architecture.
//
// Supported syntax (one statement per preprocessed line):
//   architecture-beta                       — header (also accepts `architecture`)
//   group <id>(<icon>)[<Title>] [in <grp>]  — a container (icon/title optional)
//   service <id>(<icon>)[<Title>] [in <grp>]— an icon node
//   junction <id> [in <grp>]                — a four-way connection point
//   <a>:<Side> -- <Side>:<b>                — a plain edge
//   <a>:<Side> --> <Side>:<b>               — a directional edge (arrow at end)
//   <a>:<Side> <-- <Side>:<b>               — arrow at the start
// where Side ∈ {L,R,T,B}. Endpoints may carry an optional `{group}` marker
// (`a{grp}:R`) which we tolerate and ignore for self-contained layout.
//
// Lines should already be trimmed and comment-stripped; the header is skipped.
// ============================================================================

const GROUP_RE =
  /^group\s+([A-Za-z0-9_]+)\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?\s*(?:\bin\s+([A-Za-z0-9_]+))?\s*$/i
const SERVICE_RE =
  /^service\s+([A-Za-z0-9_]+)\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?\s*(?:\bin\s+([A-Za-z0-9_]+))?\s*$/i
const JUNCTION_RE =
  /^junction\s+([A-Za-z0-9_]+)\s*(?:\bin\s+([A-Za-z0-9_]+))?\s*$/i
// Endpoint: id with optional {group} marker, then ':' and a side letter.
const EDGE_RE =
  /^([A-Za-z0-9_]+)(?:\{[A-Za-z0-9_]*\})?:([LRTBlrtb])\s*(<?-{1,2}>?)\s*([LRTBlrtb]):([A-Za-z0-9_]+)(?:\{[A-Za-z0-9_]*\})?$/

/**
 * Parse a Mermaid architecture-beta diagram from preprocessed lines.
 */
export function parseArchitecture(lines: string[]): Architecture {
  const groups: ArchGroup[] = []
  const services: ArchService[] = []
  const junctions: ArchJunction[] = []
  const edges: ArchEdge[] = []
  let seq = 0

  for (const line of lines) {
    // Header — skip (`architecture-beta` or bare `architecture`)
    if (/^architecture(-beta)?\b/i.test(line)) continue

    const g = line.match(GROUP_RE)
    if (g) {
      groups.push({
        id: g[1]!,
        icon: cleanOpt(g[2]),
        title: cleanTitle(g[3], g[1]!),
        parent: cleanOpt(g[4]),
        seq: seq++,
      })
      continue
    }

    const s = line.match(SERVICE_RE)
    if (s) {
      services.push({
        id: s[1]!,
        icon: cleanOpt(s[2]),
        title: cleanTitle(s[3], s[1]!),
        group: cleanOpt(s[4]),
        seq: seq++,
      })
      continue
    }

    const j = line.match(JUNCTION_RE)
    if (j) {
      junctions.push({ id: j[1]!, group: cleanOpt(j[2]), seq: seq++ })
      continue
    }

    const e = line.match(EDGE_RE)
    if (e) {
      const arrow = e[3]!
      edges.push({
        from: e[1]!,
        fromSide: e[2]!.toUpperCase() as Side,
        to: e[5]!,
        toSide: e[4]!.toUpperCase() as Side,
        arrowStart: arrow.includes('<'),
        arrowEnd: arrow.includes('>'),
      })
      continue
    }
  }

  return { groups, services, junctions, edges }
}

/** Trim an optional capture, returning undefined when empty/absent. */
function cleanOpt(s: string | undefined): string | undefined {
  if (s === undefined) return undefined
  const t = s.trim()
  return t.length > 0 ? t : undefined
}

/** Resolve a `[Title]` capture, falling back to the id when missing. */
function cleanTitle(s: string | undefined, id: string): string {
  const t = cleanOpt(s)
  return t ?? id
}
