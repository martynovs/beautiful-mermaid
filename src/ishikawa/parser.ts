import type { Ishikawa, IshikawaCategory, IshikawaCause } from './types.ts'

// ============================================================================
// Ishikawa (fishbone) parser
//
// Parses Mermaid `ishikawa` syntax into a typed Ishikawa structure.
//
//   ishikawa[-beta]
//   <effect>                  first content line — the fish head
//     <category>              one indent in — a major bone
//       <cause>               deeper — a cause under that category
//         <sub-cause>         deeper still — nests arbitrarily
//
// Hierarchy is inferred purely from leading whitespace, so this parser MUST be
// fed RAW (untrimmed) lines — `src.split('\n')` with NO `.trim()` per line.
// (The flowchart pre-processor in src/index.ts trims lines, which would erase
// the indentation this diagram depends on; the dispatcher must special-case
// ishikawa and pass untrimmed lines.)
// ============================================================================

interface RawNode {
  text: string
  indent: number
  children: RawNode[]
}

/**
 * Parse a Mermaid ishikawa diagram from RAW (untrimmed) lines.
 *
 * @param lines source split on '\n' only — leading whitespace MUST be intact.
 */
export function parseIshikawa(lines: string[]): Ishikawa {
  const diagram: Ishikawa = { effect: '', categories: [] }

  // Keep blank-stripped content lines with their measured indent, skipping the
  // header line and `%%` comments. Leading whitespace is what drives nesting.
  const content: Array<{ text: string; indent: number }> = []
  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const trimmed = raw.trim()
    if (trimmed.startsWith('%%')) continue
    if (/^ishikawa(-beta)?\b/i.test(trimmed)) continue
    content.push({ text: stripDecorations(trimmed), indent: leadingIndent(raw) })
  }

  if (content.length === 0) return diagram

  // First content line is the effect (the fish head).
  diagram.effect = content[0]!.text
  const rest = content.slice(1)
  if (rest.length === 0) return diagram

  // Build an indentation tree from the remaining lines. The shallowest of those
  // become categories; everything deeper becomes (nested) causes.
  const roots = buildTree(rest)
  diagram.categories = roots.map(toCategory)

  return diagram
}

/** Build a nesting tree from indent-tagged lines using an indent stack. */
function buildTree(lines: Array<{ text: string; indent: number }>): RawNode[] {
  const roots: RawNode[] = []
  const stack: RawNode[] = []

  for (const { text, indent } of lines) {
    const node: RawNode = { text, indent, children: [] }
    // Pop until the stack top is a strictly shallower (parent) node.
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop()
    }
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1]!.children.push(node)
    stack.push(node)
  }

  return roots
}

function toCategory(node: RawNode): IshikawaCategory {
  return { text: node.text, causes: node.children.map(toCause) }
}

function toCause(node: RawNode): IshikawaCause {
  return { text: node.text, causes: node.children.map(toCause) }
}

/** Count leading-whitespace columns, expanding tabs to the next 2-col stop. */
function leadingIndent(line: string): number {
  let col = 0
  for (const ch of line) {
    if (ch === ' ') col += 1
    else if (ch === '\t') col += 2 - (col % 2)
    else break
  }
  return col
}

/** Strip surrounding quotes and an optional `id["label"]` wrapper to plain text. */
function stripDecorations(s: string): string {
  // `id["Label"]` or `id[Label]` → the bracketed label
  const bracket = s.match(/^[^[\]"]*\[\s*"?([^"\]]*?)"?\s*\]$/)
  if (bracket) return bracket[1]!.trim()
  return s.replace(/^["']|["']$/g, '').trim()
}
