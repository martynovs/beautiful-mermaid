// ============================================================================
// Requirement diagram types
//
// Models the parsed and positioned representations of a Mermaid
// `requirementDiagram`. A requirement diagram shows requirement boxes and
// element boxes connected by typed relationship edges (satisfies, traces, …).
// ============================================================================

/** The keyword that introduces a requirement block. */
export type RequirementKind =
  | 'requirement'
  | 'functionalRequirement'
  | 'interfaceRequirement'
  | 'performanceRequirement'
  | 'physicalRequirement'
  | 'designConstraint'

/** Relationship verbs supported between requirements/elements. */
export type RequirementRelationType =
  | 'satisfies'
  | 'traces'
  | 'derives'
  | 'refines'
  | 'contains'
  | 'copies'
  | 'verifies'

/** Parsed requirement diagram — logical structure from mermaid text. */
export interface RequirementDiagram {
  requirements: Requirement[]
  elements: RequirementElement[]
  relationships: RequirementRelationship[]
}

/** A `requirement` (or typed variant) block. */
export interface Requirement {
  /** User-defined name — unique node id. */
  name: string
  /** The introducing keyword (requirement, functionalRequirement, …). */
  kind: RequirementKind
  /** User-defined id field. */
  id?: string
  /** Description text. */
  text?: string
  /** Risk level (Low, Medium, High) — stored as given. */
  risk?: string
  /** Verification method (Analysis, Inspection, Test, Demonstration). */
  verifyMethod?: string
}

/** An `element` block. */
export interface RequirementElement {
  /** User-defined name — unique node id. */
  name: string
  /** User-defined type. */
  type?: string
  /** Document reference. */
  docref?: string
}

/** A typed relationship edge: `<source> - <type> -> <dest>`. */
export interface RequirementRelationship {
  source: string
  dest: string
  type: RequirementRelationType | string
}

// ============================================================================
// Positioned requirement diagram — ready for SVG rendering
// ============================================================================

export interface PositionedRequirementDiagram {
  width: number
  height: number
  nodes: PositionedReqNode[]
  edges: PositionedReqEdge[]
}

export interface PositionedReqNode {
  /** Unique id (the block name). */
  id: string
  /** Whether this is a requirement box or an element box. */
  kind: 'requirement' | 'element'
  /** Stereotype label shown under the name, e.g. `«Requirement»`. */
  stereotype: string
  /** Display name (bold header). */
  name: string
  /** Field rows shown in the body: `key: value` text. */
  rows: string[]
  x: number
  y: number
  width: number
  height: number
  headerHeight: number
  rowHeight: number
}

export interface PositionedReqEdge {
  from: string
  to: string
  type: string
  /** Straight-line points from source center to dest border. */
  points: Array<{ x: number; y: number }>
  /** Anchor for the relationship label. */
  labelX: number
  labelY: number
}
