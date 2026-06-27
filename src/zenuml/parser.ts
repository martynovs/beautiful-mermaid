import type { ZenUML, ZenParticipant, ZenFragment, ZenFragmentType } from './types.ts'

// ============================================================================
// ZenUML parser
//
// Parses the Mermaid `zenuml` textual sequence DSL into a ZenUML structure.
//
// Supported subset:
//   - Header line `zenuml` (skipped).
//   - Participant declarations:
//       participant A as Alice   (alias)
//       @Actor User              (annotator + name)
//       Database                 (bare name)
//   - Messages:
//       A->B: message            (explicit arrow; A--&gt;B for dashed)
//       Receiver.method(args)    (method call: receiver is the `to`, the
//                                 sender is the current/root context). A sync
//                                 call gets an IMPLICIT dashed return back to
//                                 its caller (unless an explicit `return`
//                                 already covers it).
//       B.method() { ... }       (nested block — receiver becomes the context
//                                 sender for inner messages)
//   - Returns:
//       return value  /  @return value
//                                (drawn back from the active context to its
//                                 caller, dashed/open). Suppresses the implicit
//                                 return of the enclosing call.
//   - Control-flow fragments (rendered as labelled boxes):
//       if (cond) { … } else { … }     → alt
//       alt (cond) { … } else { … }    → alt
//       opt (cond) { … }               → opt
//       loop/while/for/forEach (…) {…} → loop
//       par { … } and { … }            → par
//       try { … } catch (e) { … } finally { … } → try
//       critical { … } / group { … }   → critical / group
//     Fragments may nest. Their inner messages are still captured in source
//     order; the fragment records the message range it wraps.
// ============================================================================

/** Keywords that open a control-flow fragment block. */
const OPEN_KEYWORD =
  /^(if|alt|opt|loop|while|for|forEach|par|try|critical|group|section)\b\s*(.*)$/i

/** Continuation keywords that add a divider section to the current fragment. */
const DIVIDER_KEYWORD = /^(else\s+if|else|catch|finally|and)\b\s*(.*)$/i

type FrameKind = 'plain' | 'call' | 'fragment'

interface Frame {
  /** The participant acting as sender for messages in this frame */
  sender: string
  /** Who called into this frame (return target) */
  caller: string
  kind: FrameKind
  /** For `call` frames: the callee (source of the implicit return) */
  callSource?: string
  /** For `call` frames: the caller (target of the implicit return) */
  callTarget?: string
  /** For `call` frames: set once an explicit `return` covered this call */
  hasReturn?: boolean
  /** For `fragment` frames: the fragment being built */
  fragment?: ZenFragment
}

/**
 * Parse a Mermaid ZenUML diagram from preprocessed (trimmed, comment-stripped)
 * lines. The first line is expected to be the `zenuml` header.
 */
export function parseZenUML(lines: string[]): ZenUML {
  const diagram: ZenUML = { participants: [], messages: [], fragments: [] }
  const ids = new Set<string>()

  const frames: Frame[] = []
  // A fragment frame that was just popped by a `}` but may be reopened by a
  // following divider (`else`/`catch`/`finally`/`and`). Finalized lazily.
  let pending: Frame | null = null

  const base = (): Frame => {
    const root = diagram.participants[0]?.id ?? ''
    return { sender: root, caller: root, kind: 'plain' }
  }
  const current = (): Frame => frames[frames.length - 1] ?? base()

  const fragmentDepth = (): number =>
    frames.reduce((n, f) => n + (f.kind === 'fragment' ? 1 : 0), 0)

  /** Finalize a pending (closed-but-not-reopened) fragment frame. */
  const finalizePending = (): void => {
    if (pending && pending.fragment) {
      diagram.fragments.push(pending.fragment)
    }
    pending = null
  }

  /** Pop one frame, emitting an implicit return / finalizing a fragment. */
  const closeFrame = (): void => {
    finalizePending()
    const f = frames.pop()
    if (!f) return
    if (f.kind === 'call' && !f.hasReturn && f.callSource && f.callTarget) {
      diagram.messages.push({
        from: f.callSource,
        to: f.callTarget,
        label: '',
        kind: 'return',
        lineStyle: 'dashed',
        arrowHead: 'open',
      })
    }
    if (f.kind === 'fragment' && f.fragment) {
      f.fragment.endIndex = diagram.messages.length
      pending = f // may be reopened by a following divider
    }
  }

  /** Mark the nearest enclosing call frame as explicitly returned. */
  const markCallReturned = (): void => {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i]!.kind === 'call') {
        frames[i]!.hasReturn = true
        return
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!

    // Skip the header line.
    if (i === 0 && /^zenuml\b/i.test(line)) continue
    if (/^zenuml\b/i.test(line) && line.trim().toLowerCase() === 'zenuml') continue

    // --- Continuation divider: `} else {`, `} catch (e) {`, `} and {` ---
    // The leading `}` closes the previous section but the SAME fragment frame
    // stays open (it is the receiver of the new section).
    const contMatch = line.match(/^\}\s*(else\s+if|else|catch|finally|and)\b\s*(.*)$/i)
    if (contMatch && (pending?.fragment || current().kind === 'fragment')) {
      // If the fragment is still on the stack, pop it into `pending` first so
      // the reopen logic below is uniform.
      if (!pending && current().kind === 'fragment') pending = frames.pop()!
      const keyword = normalizeKeyword(contMatch[1]!)
      const rest = stripTrailingBrace(contMatch[2]!)
      reopenSection(keyword, rest.label)
      continue
    }

    // --- Closing brace(s): pop nested frames ---
    while (line.startsWith('}')) {
      closeFrame()
      line = line.slice(1).trim()
      if (line.length === 0) break
    }
    if (line.length === 0) continue

    // Detect a trailing block opener and strip it for content parsing.
    const opensBlock = line.endsWith('{')
    const content = (opensBlock ? line.slice(0, -1) : line).trim()
    if (content.length === 0) {
      finalizePending()
      // A bare `{` opener — inherit current frame.
      if (opensBlock) frames.push({ ...current(), kind: 'plain' })
      continue
    }

    // A standalone divider (`else {`, `catch (e) {`) reopening a just-closed
    // fragment that wasn't on the `} else {` line.
    const divOnly = content.match(DIVIDER_KEYWORD)
    if (divOnly && pending?.fragment) {
      reopenSection(normalizeKeyword(divOnly[1]!), stripParens(divOnly[2]!.trim()))
      continue
    }

    // Any other content finalizes a dangling closed fragment.
    finalizePending()

    // --- Return: `return value` / `@return value` ---
    const retMatch = content.match(/^@?return\b\s*(.*)$/i)
    if (retMatch) {
      const ctx = current()
      const value = retMatch[1]!.trim()
      ensureParticipant(diagram, ids, ctx.sender)
      ensureParticipant(diagram, ids, ctx.caller)
      diagram.messages.push({
        from: ctx.sender,
        to: ctx.caller,
        label: value,
        kind: 'return',
        lineStyle: 'dashed',
        arrowHead: 'open',
      })
      markCallReturned()
      continue
    }

    // --- Control-flow fragment header (opens a labelled box) ---
    const openMatch = content.match(OPEN_KEYWORD)
    if (openMatch && opensBlock) {
      const keyword = normalizeKeyword(openMatch[1]!)
      const fragment: ZenFragment = {
        type: fragmentTypeFor(keyword),
        label: stripParens(openMatch[2]!.trim()),
        startIndex: diagram.messages.length,
        endIndex: diagram.messages.length,
        sections: [],
        depth: fragmentDepth(),
      }
      const ctx = current()
      frames.push({ sender: ctx.sender, caller: ctx.caller, kind: 'fragment', fragment })
      continue
    }
    // Control keyword without an opening brace — ignore the header line.
    if (openMatch) continue

    // --- Participant declaration: `participant X as Label` / `participant X` ---
    const partMatch = content.match(/^participant\s+(\S+?)(?:\s+as\s+(.+))?$/i)
    if (partMatch) {
      const id = stripQuotes(partMatch[1]!)
      const label = partMatch[2] ? stripQuotes(partMatch[2].trim()) : id
      addParticipant(diagram, ids, id, label)
      if (opensBlock) frames.push({ ...current(), kind: 'plain' })
      continue
    }

    // --- Annotator declaration: `@Actor User` (but not @return, handled above) ---
    const annMatch = content.match(/^@(\w+)\s+(\S+?)(?:\s+as\s+(.+))?$/)
    if (annMatch) {
      const annotator = annMatch[1]!
      const id = stripQuotes(annMatch[2]!)
      const label = annMatch[3] ? stripQuotes(annMatch[3].trim()) : id
      addParticipant(diagram, ids, id, label, annotator)
      if (opensBlock) frames.push({ ...current(), kind: 'plain' })
      continue
    }

    // --- Explicit arrow message: `A->B: msg` / `A-->B: msg` ---
    const arrowMatch = content.match(/^([\w.]+)\s*(--?>>?)\s*([\w.]+)\s*:\s*(.+)$/)
    if (arrowMatch) {
      const from = idHead(arrowMatch[1]!)
      const arrow = arrowMatch[2]!
      const to = idHead(arrowMatch[3]!)
      const label = arrowMatch[4]!.trim()
      ensureParticipant(diagram, ids, from)
      ensureParticipant(diagram, ids, to)
      const lineStyle = arrow.startsWith('--') ? 'dashed' : 'solid'
      diagram.messages.push({
        from,
        to,
        label,
        kind: 'sync',
        lineStyle,
        arrowHead: 'filled',
      })
      if (opensBlock) frames.push({ ...current(), kind: 'plain' })
      continue
    }

    // --- Method-call message: `Receiver.method(args)` ---
    const methodMatch = content.match(/^([A-Za-z_]\w*)\.(.+)$/)
    if (methodMatch) {
      const to = methodMatch[1]!
      const label = methodMatch[2]!.trim()
      const from = current().sender || to
      ensureParticipant(diagram, ids, from)
      ensureParticipant(diagram, ids, to)
      diagram.messages.push({
        from,
        to,
        label,
        kind: 'sync',
        lineStyle: 'solid',
        arrowHead: 'filled',
      })
      if (opensBlock) {
        // Nested block: receiver becomes the sender; defer the return until close.
        frames.push({
          sender: to,
          caller: from,
          kind: 'call',
          callSource: to,
          callTarget: from,
          hasReturn: false,
        })
      } else {
        // Leaf call: emit an implicit dashed return straight back to the caller.
        diagram.messages.push({
          from: to,
          to: from,
          label: '',
          kind: 'return',
          lineStyle: 'dashed',
          arrowHead: 'open',
        })
      }
      continue
    }

    // --- Bare participant name: `Database` ---
    if (/^[A-Za-z_]\w*$/.test(content)) {
      addParticipant(diagram, ids, content, content)
      if (opensBlock) frames.push({ ...current(), kind: 'plain' })
      continue
    }

    // Unrecognized line — if it opened a block, still balance the stack.
    if (opensBlock) frames.push({ ...current(), kind: 'plain' })
  }

  // Close any frames left open by unbalanced input.
  while (frames.length > 0) closeFrame()
  finalizePending()

  return diagram

  /** Reopen the pending fragment as a new section divider. */
  function reopenSection(keyword: string, label: string): void {
    if (!pending || !pending.fragment) return
    const f = pending
    pending = null
    f.fragment!.sections.push({ index: diagram.messages.length, keyword, label })
    frames.push(f)
  }
}

/** Map an opening keyword to a fragment type. */
function fragmentTypeFor(keyword: string): ZenFragmentType {
  const kw = keyword.toLowerCase()
  if (kw === 'if' || kw === 'alt') return 'alt'
  if (kw === 'opt') return 'opt'
  if (kw === 'loop' || kw === 'while' || kw === 'for' || kw === 'foreach') return 'loop'
  if (kw === 'par') return 'par'
  if (kw === 'try') return 'try'
  if (kw === 'critical') return 'critical'
  return 'group'
}

function normalizeKeyword(kw: string): string {
  return kw.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Strip a trailing `{` (block opener) and return the cleaned condition label. */
function stripTrailingBrace(s: string): { label: string } {
  let t = s.trim()
  if (t.endsWith('{')) t = t.slice(0, -1).trim()
  return { label: stripParens(t) }
}

/** Strip a single pair of surrounding parentheses, e.g. `(ok)` → `ok`. */
function stripParens(s: string): string {
  const t = s.trim()
  if (t.startsWith('(') && t.endsWith(')')) return t.slice(1, -1).trim()
  return t
}

/** Take the head identifier of a dotted reference (`A.b` → `A`). */
function idHead(ref: string): string {
  const head = ref.split('.')[0]!
  return stripQuotes(head)
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}

/** Add a participant (or upgrade an inferred one with label/annotator). */
function addParticipant(
  diagram: ZenUML,
  ids: Set<string>,
  id: string,
  label: string,
  annotator?: string,
): void {
  if (!ids.has(id)) {
    ids.add(id)
    const p: ZenParticipant = { id, label }
    if (annotator) p.annotator = annotator
    diagram.participants.push(p)
    return
  }
  // Already present — enrich an inferred entry with an explicit label/annotator.
  const existing = diagram.participants.find(p => p.id === id)
  if (existing) {
    if (label && label !== id && existing.label === id) existing.label = label
    if (annotator && !existing.annotator) existing.annotator = annotator
  }
}

/** Ensure a participant exists, inferring a default one from a message. */
function ensureParticipant(diagram: ZenUML, ids: Set<string>, id: string): void {
  if (!id) return
  if (!ids.has(id)) {
    ids.add(id)
    diagram.participants.push({ id, label: id })
  }
}
