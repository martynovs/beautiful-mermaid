// ============================================================================
// ZenUML diagram types
//
// ZenUML is a textual sequence DSL (Mermaid `zenuml` header). It models actor
// interactions as ordered messages between participants — conceptually the same
// shape as a classic sequence diagram (participants + vertical lifelines +
// horizontal message arrows), but with a code-like, method-call syntax.
//
// We model a practical subset: participants (declared or inferred) and an
// ordered list of messages (explicit arrows, method calls, and returns). Nested
// call blocks are flattened — their messages are captured in source order.
// ============================================================================

/** Parsed ZenUML diagram — logical structure from mermaid text */
export interface ZenUML {
  /** Ordered list of participants (declaration order, then first-seen order) */
  participants: ZenParticipant[]
  /** Messages between participants in source order */
  messages: ZenMessage[]
  /** Control-flow fragments (alt/opt/loop/par/try/…) wrapping message ranges */
  fragments: ZenFragment[]
}

/** Control-flow fragment kind — drives the label tab on the fragment box */
export type ZenFragmentType = 'alt' | 'opt' | 'loop' | 'par' | 'try' | 'critical' | 'group'

/** A continuation section of a fragment (else / else if / catch / finally / and) */
export interface ZenFragmentSection {
  /** Index (into ZenUML.messages) of the first message in this section */
  index: number
  /** Section keyword, e.g. 'else', 'catch', 'finally', 'and' */
  keyword: string
  /** Optional condition/label text for the section (may be empty) */
  label: string
}

/**
 * A control-flow fragment spanning a contiguous range of messages. Fragments
 * may nest; `depth` is 0 for the outermost.
 */
export interface ZenFragment {
  type: ZenFragmentType
  /** Condition/label text shown in the header (may be empty) */
  label: string
  /** Index of the first inner message (inclusive) */
  startIndex: number
  /** Index just past the last inner message (exclusive) */
  endIndex: number
  /** Continuation sections (else/catch/finally/and) within this fragment */
  sections: ZenFragmentSection[]
  /** Nesting depth (0 = outermost) */
  depth: number
}

export interface ZenParticipant {
  /** Stable identifier used for data-id / data-from / data-to attribution */
  id: string
  /** Display label (defaults to id) */
  label: string
  /** Optional stereotype/annotator, e.g. `@Actor User` → 'Actor' */
  annotator?: string
}

/** Message flavour — drives arrow styling */
export type ZenMessageKind = 'sync' | 'async' | 'return'

export interface ZenMessage {
  from: string
  to: string
  label: string
  kind: ZenMessageKind
  /** Arrow line style */
  lineStyle: 'solid' | 'dashed'
  /** Arrow head style */
  arrowHead: 'filled' | 'open'
}

// ============================================================================
// Positioned ZenUML diagram — ready for SVG rendering
// ============================================================================

export interface PositionedZenUML {
  width: number
  height: number
  participants: PositionedParticipant[]
  lifelines: ZenLifeline[]
  messages: PositionedZenMessage[]
  fragments: PositionedZenFragment[]
}

/** A positioned control-flow fragment box, ready for SVG rendering */
export interface PositionedZenFragment {
  type: ZenFragmentType
  label: string
  /** Left edge of the box */
  x: number
  /** Top edge of the box */
  y: number
  width: number
  height: number
  /** Nesting depth (0 = outermost) — controls draw order/inset */
  depth: number
  /** Positioned continuation dividers within the box */
  dividers: Array<{ y: number; keyword: string; label: string }>
}

export interface PositionedParticipant {
  id: string
  label: string
  annotator?: string
  /** Center x of the participant box */
  x: number
  /** Top y of the participant box */
  y: number
  width: number
  height: number
}

/** Vertical lifeline running down from a participant box */
export interface ZenLifeline {
  participantId: string
  x: number
  topY: number
  bottomY: number
}

export interface PositionedZenMessage {
  from: string
  to: string
  label: string
  kind: ZenMessageKind
  lineStyle: 'solid' | 'dashed'
  arrowHead: 'filled' | 'open'
  /** Start x (from participant's lifeline) */
  x1: number
  /** End x (to participant's lifeline) */
  x2: number
  /** Vertical position */
  y: number
  /** Whether this is a self-message (same participant) */
  isSelf: boolean
}
