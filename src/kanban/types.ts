// ============================================================================
// Kanban board types
//
// Models the parsed and positioned representations of a Mermaid `kanban`
// diagram: a set of columns laid out side by side, each holding a vertical
// stack of cards. Structure comes from indentation — a top-level `id[Title]`
// is a column, indented `id[Text]` lines are its cards.
// ============================================================================

/** Parsed kanban board — logical structure from mermaid text */
export interface Kanban {
  title?: string
  columns: KanbanColumn[]
}

/** A workflow column (e.g. Todo / In Progress / Done) */
export interface KanbanColumn {
  /** Unique id (used for data-id) */
  id: string
  /** Header text */
  title: string
  cards: KanbanCard[]
}

/** A single card within a column */
export interface KanbanCard {
  /** Unique id (used for data-id) */
  id: string
  /** Card body text */
  text: string
  /** Optional `@{ ... }` metadata (assigned / ticket / priority, …) */
  metadata?: KanbanCardMetadata
}

/** Parsed `@{ key: value }` metadata. Known keys are typed; extras allowed. */
export interface KanbanCardMetadata {
  assigned?: string
  ticket?: string
  priority?: string
  [key: string]: string | undefined
}

// ============================================================================
// Positioned kanban board — ready for SVG rendering
// ============================================================================

export interface PositionedKanban {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  columns: PositionedKanbanColumn[]
}

export interface PositionedKanbanColumn {
  id: string
  title: string
  /** Column container top-left */
  x: number
  y: number
  width: number
  height: number
  /** Height of the header band at the top of the column */
  headerHeight: number
  cards: PositionedKanbanCard[]
}

export interface PositionedKanbanCard {
  id: string
  /** Card body, pre-wrapped into display lines */
  textLines: string[]
  /** Compact metadata line (e.g. "Alice · PROJ-1 · High"), or undefined */
  metaLine?: string
  x: number
  y: number
  width: number
  height: number
}
