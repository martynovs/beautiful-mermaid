import type { Treemap, TreemapNode } from './types.ts'

// ============================================================================
// Treemap parser
//
// Parses Mermaid `treemap` syntax into a typed Treemap hierarchy.
//
// Supported syntax:
//   treemap[-beta]            (header)
//   title <text>             (optional)
//   "Branch"                 (a node with no value; nesting comes from indent)
//       "Leaf" : <value>     (a leaf carries a numeric value)
//   "Leaf" : <value>:::cls   (trailing :::class is ignored)
//
// IMPORTANT — indentation drives the hierarchy. This parser infers nesting
// from each line's LEADING WHITESPACE, so it MUST receive the RAW lines split
// only on '\n'. Do NOT pre-trim the lines before calling parseTreemap: trimming
// destroys the indentation and collapses every node to the same level. (The
// shared dispatcher in src/index.ts trims lines — treemap must be wired to pass
// raw, untrimmed lines instead. See the module README note in the PR.)
// ============================================================================

interface RawNode {
  label: string
  parsedValue?: number
  indent: number
  children: RawNode[]
}

/**
 * Parse a Mermaid treemap from raw (untrimmed) lines.
 *
 * @param lines Source lines split on '\n' WITHOUT trimming — leading spaces/tabs
 *   are required to recover the hierarchy. Comment lines (`%%`) are skipped.
 */
export function parseTreemap(lines: string[]): Treemap {
  const tree: Treemap = { root: synthRoot() }

  const roots: RawNode[] = []
  // Stack of open ancestors with their indentation levels.
  const stack: RawNode[] = []

  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const stripped = raw.trim()
    if (stripped.startsWith('%%')) continue

    // Header: `treemap` / `treemap-beta`
    if (/^treemap(-beta)?\b/i.test(stripped)) continue

    // Optional standalone title (unquoted, no colon)
    const titleMatch = stripped.match(/^title\s+(.+)$/i)
    if (titleMatch && !stripped.startsWith('"') && !stripped.includes(':')) {
      tree.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    const parsed = parseNodeLine(stripped)
    if (!parsed) continue

    const indent = leadingIndent(raw)
    const node: RawNode = { label: parsed.label, parsedValue: parsed.value, indent, children: [] }

    // Pop ancestors that are at the same or deeper indent than this node.
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
  if (roots.length === 1) {
    tree.root = build(roots[0]!, '', used)
  } else {
    const root = synthRoot()
    root.children = roots.map(r => build(r, '', used))
    tree.root = root
  }

  // Compute branch values (sum of descendants) and assign color buckets.
  computeValue(tree.root)
  tree.root.children.forEach((child, i) => assignColor(child, i))

  return tree
}

// ----------------------------------------------------------------------------
// Tree construction
// ----------------------------------------------------------------------------

function build(raw: RawNode, parentPath: string, used: Set<string>): TreemapNode {
  const path = uniquePath(parentPath ? `${parentPath}/${raw.label}` : raw.label, used)
  const node: TreemapNode = {
    label: raw.label,
    path,
    value: raw.parsedValue ?? 0,
    children: [],
    colorIndex: -1,
  }
  node.children = raw.children.map(c => build(c, path, used))
  return node
}

/** Post-order: branch value = sum of children; leaf value = explicit value. */
function computeValue(node: TreemapNode): number {
  if (node.children.length > 0) {
    node.value = node.children.reduce((sum, c) => sum + computeValue(c), 0)
  }
  return node.value
}

function assignColor(node: TreemapNode, index: number): void {
  node.colorIndex = index
  for (const child of node.children) assignColor(child, index)
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

/** Parse a node line (already trimmed): `"Label"` or `"Label" : value`. */
function parseNodeLine(line: string): { label: string; value?: number } | null {
  // Drop a trailing :::class assignment before parsing.
  const text = line.replace(/:::\s*[A-Za-z_][\w-]*\s*$/, '').trim()

  // Quoted label, optional `: value`
  let m = text.match(/^"([^"]*)"\s*(?::\s*(-?\d*\.?\d+))?\s*$/)
  if (m) {
    const value = m[2] != null ? parseFloat(m[2]) : undefined
    if (value != null && (!Number.isFinite(value) || value < 0)) return { label: m[1]!.trim() }
    return { label: m[1]!.trim(), value }
  }

  // Unquoted label with a value: `Label : value`
  m = text.match(/^([^:]+?)\s*:\s*(-?\d*\.?\d+)\s*$/)
  if (m) {
    const value = parseFloat(m[2]!)
    if (!Number.isFinite(value) || value < 0) return { label: m[1]!.trim() }
    return { label: m[1]!.trim(), value }
  }

  // Bare unquoted branch label (no colon, no quotes)
  if (text.length > 0 && !text.includes(':')) {
    return { label: stripQuotes(text) }
  }

  return null
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path)
    return path
  }
  let n = 2
  while (used.has(`${path}#${n}`)) n += 1
  const out = `${path}#${n}`
  used.add(out)
  return out
}

function synthRoot(): TreemapNode {
  return { label: '', path: '', value: 0, children: [], colorIndex: -1 }
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
