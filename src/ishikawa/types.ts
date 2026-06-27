// ============================================================================
// Ishikawa (fishbone / cause-and-effect) diagram types
//
// Models the parsed and positioned representations of a Mermaid `ishikawa`
// diagram. An effect (the fish head) sits at the right end of a horizontal
// spine; categories branch off as angled bones alternating above/below the
// spine; causes hang off each category as sub-bones (recursively nestable).
// ============================================================================

/** Parsed ishikawa diagram — logical hierarchy from mermaid text */
export interface Ishikawa {
  /** The effect / problem statement — the fish head. First line of the source. */
  effect: string
  /** Top-level categories — the major bones branching off the spine. */
  categories: IshikawaCategory[]
}

export interface IshikawaCategory {
  text: string
  causes: IshikawaCause[]
}

/** A cause hanging off a category (or another cause — arbitrarily nestable). */
export interface IshikawaCause {
  text: string
  causes: IshikawaCause[]
}

// ============================================================================
// Positioned ishikawa diagram — ready for SVG rendering
// ============================================================================

export interface IshikawaLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PositionedIshikawa {
  width: number
  height: number
  /** Horizontal spine running tail (left) → head (right). */
  spine: IshikawaLine
  /** The effect, rendered as a boxed head on the right. */
  head: PositionedEffect
  categories: PositionedCategory[]
}

export interface PositionedEffect {
  id: string
  text: string
  /** Text anchor (box center). */
  x: number
  y: number
  boxX: number
  boxY: number
  boxW: number
  boxH: number
}

export interface PositionedCategory {
  id: string
  text: string
  /** Angled bone from its spine attachment point to the label end. */
  bone: IshikawaLine
  labelX: number
  labelY: number
  /** True when the bone sits above the spine, false when below. */
  above: boolean
  causes: PositionedCause[]
}

export interface PositionedCause {
  id: string
  text: string
  /** Id of the node this cause branches from (category or parent cause). */
  parentId: string
  /** Horizontal sub-bone from its attachment point to the label end. */
  bone: IshikawaLine
  labelX: number
  labelY: number
}
