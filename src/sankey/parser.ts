import type { Sankey, SankeyLink } from './types.ts'

// ============================================================================
// Sankey parser
//
// Parses Mermaid `sankey` syntax into a typed flow graph.
//
//   sankey            (also accepts `sankey-beta`)
//   source,target,value
//   Agricultural waste,Bio-conversion,124.729
//   ...
//
// After the header keyword the body is CSV: three columns interpreted as
// source, target and value. Fields may be wrapped in double quotes to contain
// commas or spaces; a literal double quote is written as a doubled `""`.
//
// A row whose value column is not a finite number (e.g. the optional
// `source,target,value` header row) is silently skipped.
// ============================================================================

/**
 * Parse a Mermaid sankey diagram from preprocessed (trimmed) lines.
 * Indentation is irrelevant — the body is CSV.
 */
export function parseSankey(lines: string[]): Sankey {
  const nodes: string[] = []
  const seen = new Set<string>()
  const links: SankeyLink[] = []

  const addNode = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name)
      nodes.push(name)
    }
  }

  for (const line of lines) {
    // Skip the header keyword line.
    if (/^sankey(-beta)?\b/i.test(line)) continue
    if (line.length === 0) continue

    const fields = parseCsvRow(line)
    if (fields.length < 3) continue

    const source = fields[0]!.trim()
    const target = fields[1]!.trim()
    const value = parseFloat(fields[2]!.trim())

    if (!source || !target) continue
    if (!Number.isFinite(value)) continue

    addNode(source)
    addNode(target)
    links.push({ source, target, value })
  }

  return { nodes, links }
}

/**
 * Split one CSV row into fields, honouring double-quoted fields that may
 * contain commas. A doubled quote (`""`) inside a quoted field is an escaped
 * literal double quote.
 */
function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}
