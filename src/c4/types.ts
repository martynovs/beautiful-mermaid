// ============================================================================
// C4 diagram types
//
// Models the parsed and positioned representations of a Mermaid `C4Context`
// (and the related `C4Container` / `C4Component` / `C4Dynamic` /
// `C4Deployment`) diagram. A C4 diagram is a set of element boxes (people,
// systems, containers, components) connected by labeled relationship arrows,
// optionally grouped inside boundaries.
// ============================================================================

/** The kind of a C4 element box — drives its visual style. */
export type C4ElementKind = 'person' | 'system' | 'container' | 'component'

/**
 * Storage-shape variant carried by the `*Db` / `*Queue` element forms
 * (e.g. `SystemDb`, `ContainerQueue`). Drives the icon glyph; the coarse
 * {@link C4ElementKind} stays `system` / `container`.
 */
export type C4ElementVariant = 'db' | 'queue'

/** Parsed C4 diagram — logical structure from mermaid text */
export interface C4Diagram {
  /** Element boxes (persons, systems, containers, components) */
  elements: C4Element[]
  /** Relationship arrows between elements */
  relationships: C4Relationship[]
  /** Boundary groups (Enterprise_Boundary / System_Boundary / Container_Boundary) */
  boundaries: C4Boundary[]
}

export interface C4Element {
  /** Stable identifier from the source (first argument of the call) */
  alias: string
  kind: C4ElementKind
  /** Storage-shape variant (`db` / `queue`) from `*Db` / `*Queue` forms */
  variant?: C4ElementVariant
  /** Display label */
  label: string
  /** Technology string (containers / components only) */
  techn?: string
  /** Optional description line */
  descr?: string
  /** Whether the element is external (`*_Ext` variants) */
  external: boolean
  /** Alias of the enclosing boundary, if any */
  boundary?: string
}

/** Direction hint carried by `Rel_U` / `Rel_D` / `Rel_L` / `Rel_R`. */
export type C4RelDirection = 'up' | 'down' | 'left' | 'right'

export interface C4Relationship {
  /** Alias of the source element */
  from: string
  /** Alias of the target element */
  to: string
  /** Relationship label */
  label: string
  /** Optional technology / protocol annotation */
  techn?: string
  /** Direction hint (informational — the grid layout ignores it) */
  direction?: C4RelDirection
  /** Whether the relationship is bidirectional (`BiRel`) */
  bidirectional: boolean
}

export interface C4Boundary {
  alias: string
  label: string
  /** 'enterprise' | 'system' | 'container' | 'deployment' */
  kind: string
}

// ============================================================================
// Positioned C4 diagram — ready for SVG rendering
// ============================================================================

export interface PositionedC4Diagram {
  width: number
  height: number
  elements: PositionedC4Element[]
  relationships: PositionedC4Relationship[]
  boundaries: PositionedC4Boundary[]
}

export interface PositionedC4Element {
  alias: string
  kind: C4ElementKind
  /** Storage-shape variant (`db` / `queue`) from `*Db` / `*Queue` forms */
  variant?: C4ElementVariant
  /** Small kind tag rendered above the label (e.g. «Person») */
  tag: string
  label: string
  techn?: string
  /** Description wrapped into display lines */
  descr: string[]
  external: boolean
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedC4Relationship {
  from: string
  to: string
  label: string
  techn?: string
  bidirectional: boolean
  /** Arrow start point (on the border of the source box) */
  x1: number
  y1: number
  /** Arrow end point (on the border of the target box) */
  x2: number
  y2: number
  /** Midpoint anchor for the label */
  labelX: number
  labelY: number
}

export interface PositionedC4Boundary {
  alias: string
  label: string
  kind: string
  x: number
  y: number
  width: number
  height: number
}
