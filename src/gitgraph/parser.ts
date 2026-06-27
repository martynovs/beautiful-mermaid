import type { GitGraph, GitBranch, GitCommit, GitCommitType, GitOrientation } from './types.ts'

// ============================================================================
// Git graph parser
//
// Parses Mermaid `gitGraph` syntax into a typed GitGraph structure.
//
// Supported directives:
//   gitGraph [LR:|TB:|BT:]          (header — skipped, may set orientation)
//   commit [id: "…"] [tag: "…"] [type: NORMAL|REVERSE|HIGHLIGHT]
//   branch <name>                   (creates + switches to a new lane)
//   checkout <name> | switch <name> (switches the current branch)
//   merge <name> [id: "…"] [tag: "…"] [type: …]
//   cherry-pick id: "…"             (applies a commit onto the current branch)
//
// Commit order and the current-branch pointer are maintained as lines are read.
// ============================================================================

const DEFAULT_MAIN = 'main'

/**
 * Parse a Mermaid git graph from preprocessed lines.
 * Lines should already be trimmed and comment-stripped. The header line
 * (`gitGraph …`) is skipped.
 */
export function parseGitGraph(lines: string[]): GitGraph {
  let orientation: GitOrientation = 'LR'

  const branchOrder = new Map<string, number>()
  const branches: GitBranch[] = []
  const commits: GitCommit[] = []
  /** Last commit id seen on each branch (its current head). */
  const heads = new Map<string, string | undefined>()
  const usedIds = new Set<string>()

  const ensureBranch = (name: string): void => {
    if (branchOrder.has(name)) return
    const order = branches.length
    branchOrder.set(name, order)
    branches.push({ name, order })
    if (!heads.has(name)) heads.set(name, undefined)
  }

  // The main branch always exists as lane 0.
  ensureBranch(DEFAULT_MAIN)
  let current = DEFAULT_MAIN

  let seq = 0

  const pushCommit = (
    branch: string,
    parents: string[],
    opts: { id?: string; tag?: string; type: GitCommitType; isMerge: boolean; isCherryPick: boolean },
  ): void => {
    const id = uniqueId(opts.id ?? genId(seq), usedIds)
    seq++
    commits.push({
      id,
      branch,
      parents: parents.filter((p): p is string => !!p),
      tag: opts.tag,
      type: opts.type,
      isMerge: opts.isMerge,
      isCherryPick: opts.isCherryPick,
    })
    heads.set(branch, id)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Header — skip, but capture orientation if present.
    const header = line.match(/^gitGraph\b\s*:?\s*(LR|TB|BT)?\s*:?/i)
    if (header && /^gitGraph/i.test(line)) {
      if (header[1]) orientation = header[1].toUpperCase() as GitOrientation
      continue
    }

    // commit …
    if (/^commit\b/i.test(line)) {
      const rest = line.replace(/^commit\b/i, '')
      pushCommit(current, [heads.get(current) ?? ''], {
        id: optStr(rest, 'id'),
        tag: optStr(rest, 'tag'),
        type: optType(rest) ?? 'NORMAL',
        isMerge: false,
        isCherryPick: false,
      })
      continue
    }

    // branch <name>
    const branchM = line.match(/^branch\s+(.+)$/i)
    if (branchM) {
      const name = unquote(firstToken(branchM[1]!.trim()))
      ensureBranch(name)
      // New branch starts from the current branch's head.
      heads.set(name, heads.get(current))
      current = name
      continue
    }

    // checkout <name> | switch <name>
    const checkoutM = line.match(/^(?:checkout|switch)\s+(.+)$/i)
    if (checkoutM) {
      const name = unquote(firstToken(checkoutM[1]!.trim()))
      ensureBranch(name)
      current = name
      continue
    }

    // merge <name> [opts]
    const mergeM = line.match(/^merge\s+(.+)$/i)
    if (mergeM) {
      const rest = mergeM[1]!.trim()
      const name = unquote(firstToken(rest))
      ensureBranch(name)
      const mergedHead = heads.get(name)
      pushCommit(current, [heads.get(current) ?? '', mergedHead ?? ''], {
        id: optStr(rest, 'id'),
        tag: optStr(rest, 'tag'),
        type: optType(rest) ?? 'NORMAL',
        isMerge: true,
        isCherryPick: false,
      })
      continue
    }

    // cherry-pick id: "…"
    const cherryM = line.match(/^cherry-pick\b(.*)$/i)
    if (cherryM) {
      const rest = cherryM[1]!.trim()
      const sourceId = optStr(rest, 'id')
      pushCommit(current, [heads.get(current) ?? '', sourceId ?? ''], {
        tag: optStr(rest, 'tag'),
        type: 'NORMAL',
        isMerge: false,
        isCherryPick: true,
      })
      continue
    }
  }

  return { orientation, branches, commits }
}

// ============================================================================
// Option parsing
// ============================================================================

/** Extract a quoted (or bare) value for `key: "value"`. */
function optStr(rest: string, key: string): string | undefined {
  const quoted = rest.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`, 'i'))
  if (quoted) return quoted[1]!.trim() || undefined
  const bare = rest.match(new RegExp(`${key}\\s*:\\s*([^\\s]+)`, 'i'))
  return bare ? bare[1]!.trim() || undefined : undefined
}

function optType(rest: string): GitCommitType | undefined {
  const m = rest.match(/type\s*:\s*(NORMAL|REVERSE|HIGHLIGHT)/i)
  return m ? (m[1]!.toUpperCase() as GitCommitType) : undefined
}

// ============================================================================
// Helpers
// ============================================================================

/** First whitespace-delimited token (the branch name), respecting quotes. */
function firstToken(s: string): string {
  const q = s.match(/^"([^"]*)"/)
  if (q) return q[0]
  return s.split(/\s+/)[0] ?? ''
}

function unquote(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

/** Deterministic, git-like short id derived from the commit sequence number. */
function genId(seq: number): string {
  const h = (Math.imul(seq + 1, 2654435761) >>> 0).toString(16).padStart(7, '0')
  return h.slice(0, 7)
}

/** Ensure uniqueness within the diagram by suffixing duplicates. */
function uniqueId(base: string, used: Set<string>): string {
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}
