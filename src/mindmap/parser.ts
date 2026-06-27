import type { Mindmap, MindmapNode, MindmapShape } from './types.ts'

// ============================================================================
// Mindmap parser
//
// Parses Mermaid `mindmap` syntax into a typed tree.
//
// Supported syntax:
//   mindmap                    (header)
//   Root                       (plain text → root node)
//     Child                    (indentation = nesting depth)
//       id[Square]             (optional leading id + shape brackets)
//
// Node shapes (text is extracted from inside the delimiters):
//   id[text]     square
//   (text)       round
//   ((text))     circle
//   ))text((     bang
//   )text(       cloud
//   {{text}}     hexagon
//   text         default (no brackets)
//
// IMPORTANT — indentation drives the hierarchy. This parser infers nesting from
// each line's LEADING WHITESPACE, so it MUST receive the RAW lines split only on
// '\n'. Do NOT pre-trim the lines before calling parseMindmap: trimming destroys
// the indentation and collapses every node to the same level. (The shared
// dispatcher in src/index.ts trims lines — mindmap must be wired to pass raw,
// untrimmed lines instead.)
// ============================================================================

interface RawNode {
  id?: string
  label: string
  shape: MindmapShape
  indent: number
  children: RawNode[]
}

/**
 * Parse a Mermaid mindmap from raw (untrimmed) lines.
 *
 * @param lines Source lines split on '\n' WITHOUT trimming — leading spaces/tabs
 *   are required to recover the hierarchy. Comment lines (`%%`) are skipped.
 */
export function parseMindmap(lines: string[]): Mindmap {
  const roots: RawNode[] = []
  // Stack of open ancestors with their indentation levels.
  const stack: RawNode[] = []

  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const stripped = raw.trim()
    if (stripped.startsWith('%%')) continue

    // Header: `mindmap`
    if (/^mindmap\b/i.test(stripped)) continue

    const parsed = parseNodeLine(stripped)
    if (!parsed) continue

    const indent = leadingIndent(raw)
    const node: RawNode = { ...parsed, indent, children: [] }

    // Pop ancestors at the same or deeper indent than this node.
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1]!.children.push(node)
    }
    stack.push(node)
  }

  // Build the public tree: a single named root when there is exactly one,
  // otherwise a synthetic container holding the forest.
  const used = new Set<string>()
  let root: MindmapNode
  if (roots.length === 1) {
    root = build(roots[0]!, 0, used)
  } else {
    root = { id: '', label: '', shape: 'default', depth: 0, children: [] }
    root.children = roots.map(r => build(r, 1, used))
  }

  return { root }
}

// ----------------------------------------------------------------------------
// Tree construction
// ----------------------------------------------------------------------------

function build(raw: RawNode, depth: number, used: Set<string>): MindmapNode {
  // The identity contract derives ids from the node *text*; the optional
  // bracket-prefix id (`id[text]`) is shape metadata we don't key on.
  const base = (raw.label && raw.label.length > 0 ? raw.label : raw.id) || 'node'
  const id = uniqueId(base, used)
  const node: MindmapNode = {
    id,
    label: raw.label,
    shape: raw.shape,
    depth,
    children: [],
  }
  node.children = raw.children.map(c => build(c, depth + 1, used))
  return node
}

// ----------------------------------------------------------------------------
// Line parsing
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

/** Shape delimiter pairs, ordered most-specific-first (longest delimiters win). */
const SHAPES: Array<{ shape: MindmapShape; open: string; close: string }> = [
  { shape: 'circle', open: '((', close: '))' },
  { shape: 'bang', open: '))', close: '((' },
  { shape: 'hexagon', open: '{{', close: '}}' },
  { shape: 'cloud', open: ')', close: '(' },
  { shape: 'square', open: '[', close: ']' },
  { shape: 'round', open: '(', close: ')' },
]

/**
 * Parse a node line (already trimmed) into an optional id, label and shape.
 *
 * `id[text]` → id="id", label="text"; `((text))` → label="text"; plain text →
 * label=text, shape="default". Trailing `:::class` / `::icon(...)` metadata is
 * stripped (treated as decoration we don't render).
 */
function parseNodeLine(line: string): { id?: string; label: string; shape: MindmapShape } | null {
  // Drop trailing icon / class decorations: `::icon(fa fa-book)` or `:::cls`.
  let text = line
    .replace(/::icon\([^)]*\)\s*$/, '')
    .replace(/:::[^\s]+\s*$/, '')
    .trim()
  if (text.length === 0) return null

  for (const { shape, open, close } of SHAPES) {
    if (text.length > open.length + close.length && text.endsWith(close)) {
      const inner = text.slice(0, text.length - close.length)
      const idx = inner.indexOf(open)
      if (idx < 0) continue
      const id = inner.slice(0, idx).trim()
      const label = inner.slice(idx + open.length).trim()
      if (label.length === 0) continue
      return { id: id || undefined, label: stripQuotes(label), shape }
    }
  }

  // Plain text node (no shape brackets).
  return { label: stripQuotes(text), shape: 'default' }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  const out = `${base}-${n}`
  used.add(out)
  return out
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
