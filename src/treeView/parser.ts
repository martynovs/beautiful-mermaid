import type { TreeView, TreeNode } from './types.ts'

// ============================================================================
// TreeView parser
//
// Parses Mermaid `treeView-beta` syntax into a typed TreeView hierarchy. A
// directory-style tree: each line is one node, nesting comes from leading
// whitespace, and a trailing `/` on a label marks a folder/directory.
//
// Supported syntax:
//   treeView-beta            (header; bare `treeView` also accepted)
//   title <text>             (optional standalone title)
//   my-project/              (a folder — trailing slash)
//       index.js             (a file — no trailing slash)
//       "name with spaces"   (quoted label, with or without trailing slash)
//       src/ ## description   (inline description after `##`, rendered italic)
//       index.js :::highlight (trailing :::className highlight — ignored)
//
// IMPORTANT — indentation drives the hierarchy. This parser infers nesting from
// each line's LEADING WHITESPACE, so it MUST receive the RAW lines split only
// on '\n'. Do NOT pre-trim the lines before calling parseTreeView: trimming
// destroys the indentation and collapses every node to the same level. (The
// shared dispatcher in src/index.ts trims lines — treeView must be wired to
// pass raw, untrimmed lines instead, like treemap/ishikawa.)
// ============================================================================

interface RawNode {
  label: string
  isFolderMark: boolean
  description?: string
  indent: number
  depth: number
  children: RawNode[]
}

/**
 * Parse a Mermaid treeView from raw (untrimmed) lines.
 *
 * @param lines Source lines split on '\n' WITHOUT trimming — leading spaces/tabs
 *   are required to recover the hierarchy. Comment lines (`%%`) are skipped.
 */
export function parseTreeView(lines: string[]): TreeView {
  const tree: TreeView = { nodes: [] }

  const roots: RawNode[] = []
  // Stack of open ancestors with their indentation levels.
  const stack: RawNode[] = []

  for (const raw of lines) {
    if (raw.trim().length === 0) continue
    const stripped = raw.trim()
    if (stripped.startsWith('%%')) continue

    // Header: `treeView` / `treeView-beta`
    if (/^treeview(-beta)?\b/i.test(stripped)) continue

    // Optional standalone title (unquoted, no trailing slash)
    const titleMatch = stripped.match(/^title\s+(.+)$/i)
    if (titleMatch && !stripped.endsWith('/')) {
      tree.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    const parsed = parseNodeLine(stripped)
    if (!parsed) continue

    const indent = leadingIndent(raw)
    const node: RawNode = {
      label: parsed.label,
      isFolderMark: parsed.isFolderMark,
      description: parsed.description,
      indent,
      depth: 0,
      children: [],
    }

    // Pop ancestors at the same or deeper indent than this node.
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop()
    }

    if (stack.length === 0) {
      node.depth = 0
      roots.push(node)
    } else {
      const parent = stack[stack.length - 1]!
      node.depth = parent.depth + 1
      parent.children.push(node)
    }
    stack.push(node)
  }

  const used = new Set<string>()
  tree.nodes = roots.map(r => build(r, '', used))
  return tree
}

// ----------------------------------------------------------------------------
// Tree construction
// ----------------------------------------------------------------------------

function build(raw: RawNode, parentPath: string, used: Set<string>): TreeNode {
  const path = uniquePath(parentPath ? `${parentPath}/${raw.label}` : raw.label, used)
  const children = raw.children.map(c => build(c, path, used))
  return {
    label: raw.label,
    path,
    // Explicit folder mark, or implied by having children.
    isFolder: raw.isFolderMark || children.length > 0,
    description: raw.description,
    depth: raw.depth,
    children,
  }
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

/** Parse a node line (already trimmed). Returns null if it yields no label. */
function parseNodeLine(line: string): { label: string; isFolderMark: boolean; description?: string } | null {
  let text = line

  // Pull off an inline description introduced by `##` (rest of the line).
  let description: string | undefined
  const descIdx = text.indexOf('##')
  if (descIdx >= 0) {
    description = text.slice(descIdx + 2).trim() || undefined
    text = text.slice(0, descIdx).trim()
  }

  // Drop a trailing :::class highlight assignment (styling is ignored).
  text = text.replace(/:::\s*[A-Za-z_][\w-]*\s*$/, '').trim()

  if (text.length === 0) return null

  // A trailing slash (outside or just after quotes) marks a directory.
  let isFolderMark = false
  if (text.endsWith('/')) {
    isFolderMark = true
    text = text.slice(0, -1).trim()
  }

  const label = stripQuotes(text).trim()
  if (label.length === 0) return null

  return { label, isFolderMark, description }
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

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
