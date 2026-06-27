# diagram-rendering

## ADDED Requirements

> **Delivery status.** This change delivers the foundational contract and the
> first two new types now; the remaining types are committed but delivered
> incrementally per `tasks.md`. Each requirement below is tagged _Implemented_
> (shipped in this change) or _Planned · §N_ (gated on the named `tasks.md`
> section). The change is archived only after its tasks complete, so the
> spec-of-record never asserts an unbuilt type is supported.

### Requirement: Stable element identity
The renderer SHALL make every interactive diagram element addressable via a stable,
source-derived attribute so the consuming tool can key annotations to it.
Structural/graph elements SHALL be wrapped in a `<g>` carrying `data-id="<source
id>"` (the wrapper's class names the element kind — e.g. `node`, `actor`,
`class-node`, `entity`), and each edge SHALL carry `data-from`/`data-to` referencing
its endpoint ids. Coordinate **data-point** elements whose primary key is a value
rather than a semantic id (e.g. `xychart` bars/points) SHALL instead be addressable
via `data-label` plus `data-value`; data-point types whose label is itself a
meaningful id (e.g. `pie` slices) MAY carry `data-id` as well. Where an identifier
is derived rather than explicit, the renderer SHALL derive it deterministically from
stable source properties (label, hierarchical path, or sequence index) and SHALL
disambiguate duplicates so every identifier within a single diagram is unique.

> _Status: Implemented — built-in types, quadrant, block; derivation rule applies to planned types as they land._

#### Scenario: Structural node carries its source id
- **WHEN** a flowchart containing the node `Auth{Authenticated?}` is rendered to SVG
- **THEN** the SVG contains a `<g class="node" data-id="Auth">` wrapping that node's shape and label

#### Scenario: Edge references its endpoints
- **WHEN** an edge `A --> B` is rendered to SVG
- **THEN** the SVG contains an edge element with `data-from="A"` and `data-to="B"`

#### Scenario: Coordinate data points are addressable by label
- **WHEN** an `xychart` bar chart with label `Jan` and value `30` is rendered to SVG
- **THEN** the bar carries `data-label="Jan"` and `data-value="30"`

#### Scenario: Derived identifiers stay unique
- **WHEN** a diagram contains two elements sharing a source label (e.g. two `pie` slices labelled `Other`)
- **THEN** each renders with a distinct identifier so an annotation routes to exactly one element

### Requirement: Quadrant chart rendering
The renderer SHALL render Mermaid `quadrantChart` source to SVG. It SHALL place
each data point by its `(x, y)` coordinate in the range 0..1 with the y-axis
inverted for screen space, label both axis ends and the four quadrant regions,
and emit each point as a `data-id` node.

> _Status: Implemented — identity/parser tests pending · §0.7._

#### Scenario: Point placement and identity
- **WHEN** `quadrantChart` source defines `beautiful-mermaid: [0.3, 0.9]`
- **THEN** the SVG places a labelled point in the upper-left (high-y, low-x) region
- **AND** that point is wrapped in `<g class="node" data-id="beautiful-mermaid">`

#### Scenario: Axis and quadrant labels
- **WHEN** source defines `x-axis Low effort --> High effort` and `quadrant-1 Ideal`
- **THEN** the SVG renders both x-axis end labels and the four quadrant region labels

### Requirement: Block diagram rendering
The renderer SHALL render Mermaid `block` source to SVG. It SHALL lay out
blocks in a uniform grid whose width is set by `columns N`, treat the `space`
keyword as an empty cell, render each block as a `data-id` node, and draw edges
between blocks.

> _Status: Implemented — identity/parser tests pending · §0.7._

#### Scenario: Grid layout with blocks and edges
- **WHEN** `block` source with `columns 3` defines blocks `Agent`, `Tool` and an edge `Agent --> Tool`
- **THEN** each block renders as `<g class="node" data-id="...">` positioned in the grid
- **AND** the edge renders with `data-from="Agent"` and `data-to="Tool"`

#### Scenario: Space consumes a grid cell
- **WHEN** a row contains `Agent space Tool`
- **THEN** `Agent` and `Tool` occupy the first and third columns with the second column empty

### Requirement: Theme-consistent rendering
Every diagram type SHALL render using the active theme's colors via CSS custom
properties, with no hardcoded palette, so changing the theme restyles all types
without re-rendering.

> _Status: Implemented — applies to every type as it lands._

#### Scenario: New types honor the active theme
- **WHEN** a quadrant or block diagram is rendered with the `tokyo-night` theme
- **THEN** its strokes, fills, and text resolve from theme CSS variables (e.g. `--_text`, `--_line`, `--_node-fill`) rather than literal colors

### Requirement: Universal icon rendering
The renderer SHALL provide a single shared, type-agnostic icon-rendering capability
so that any diagram type whose Mermaid grammar declares an icon renders that icon.
Icons SHALL be resolved through one shared icon registry (a built-in named set plus
optional iconify packs) and SHALL be embedded inside the owning node's
`<g class="node" data-id="<source id>">` group, so the presence of an icon does not
change element identity. Icon declaration syntax SHALL follow each diagram type's
native Mermaid grammar (e.g. architecture `service id(icon)[label]`, flowchart/block
`@{ icon: "<name>" }` or `fa:` label tokens); no fork-specific icon syntax SHALL be
introduced. When an icon name cannot be resolved, the renderer SHALL fall back to the
node's label and SHALL NOT fail the overall render.

> _Status: Planned · §0.2 (foundational — lands before the staged types)._

#### Scenario: Icon renders inside the node identity group
- **WHEN** a flowchart node declares an icon via `@{ icon: "server" }`
- **THEN** the glyph renders inside that node's `<g class="node" data-id="...">` group and the node's `data-id` is unchanged

#### Scenario: One registry shared across types
- **WHEN** an architecture `service db(database)[DB]` and a flowchart node referencing `@{ icon: "database" }` both name `database`
- **THEN** both resolve the same glyph from the shared icon registry

#### Scenario: Unknown icon degrades gracefully
- **WHEN** a node declares an icon name not present in any loaded pack
- **THEN** the node still renders with its label and the overall diagram render does not fail

#### Scenario: Monochrome icons honor the theme
- **WHEN** a single-color icon is rendered under the `tokyo-night` theme
- **THEN** its fill and stroke resolve from theme CSS variables rather than a hardcoded color

### Requirement: Header beta-suffix tolerance
The renderer SHALL accept both the suffixed and unsuffixed header for each diagram
type that Mermaid ships (or shipped) with a `-beta` form, detecting the same
diagram type either way, so source remains valid across Mermaid version churn.
This tolerance is wired per type in the dispatcher (e.g. `xychart(-beta)?`,
`block(-beta)?`) — added when a type is implemented — rather than by globally
stripping `-beta` from every header.

> _Status: Implemented for shipped types (`xychart`, `block`); each future type with a beta form adds its own `(-beta)?` when wired in · §0.3._

#### Scenario: Beta suffix is optional
- **WHEN** one source begins with `xychart` and another begins with `xychart-beta`
- **THEN** both are detected as the same diagram type and render identically

#### Scenario: Still-beta types resolve without the suffix
- **WHEN** a source begins with `venn` (no `-beta`)
- **THEN** it is detected as the venn diagram type

### Requirement: Test coverage
Every supported diagram type SHALL ship automated tests under `src/__tests__/`,
executed by `bun test`. For each type the suite SHALL cover (a) the parser
producing the expected model from representative source, and (b) an integration
test that renders to SVG and asserts the identity contract — each node's `data-id`
and each edge's `data-from`/`data-to` — and that theme colors resolve from CSS
variables. Types that declare icons SHALL additionally assert the glyph renders
inside the node's identity group. A single parametrized test SHALL assert that
**every** registered diagram type emits at least one node `data-id`, so no new
type can ship without identity coverage. The already-shipped built-in types and
`quadrant` and `block` SHALL be backfilled to this standard.

> _Status: Planned · §0.5–§0.7 + per-stage test tasks._

#### Scenario: Every registered type passes the identity gate
- **WHEN** the parametrized identity test renders a representative sample of every registered diagram type
- **THEN** each rendered SVG contains at least one node `data-id`, and the test fails for any type that emits none

#### Scenario: Shipped types are backfilled
- **WHEN** the test suite runs
- **THEN** `quadrant` and `block` each have a parser test and an identity integration test asserting `data-id` (and `data-from`/`data-to` for block edges)

#### Scenario: Derived-id uniqueness is covered
- **WHEN** a type with id-less elements is rendered from source containing duplicate labels
- **THEN** the test asserts the emitted `data-id` values are unique

### Requirement: Stage 1 diagram coverage (low difficulty)
The renderer SHALL render each Stage 1 diagram type to SVG, wrapping each primary
element in `<g class="node" data-id="<source id>">`, carrying `data-from`/`data-to`
on edges where present, and resolving all colors from the active theme. Stage 1
types use direct template reuse with thin parsers and simple proportional, axial,
or tree layout: `pie`, `timeline`, `radar`, `packet` (xychart-style template, no
ELK) and `mindmap`, `treeView` (bundled ELK tree layout).

> _Status: Planned · §2._

#### Scenario: Pie slices carry identity
- **WHEN** `pie` source defines a slice `"Dogs" : 30`
- **THEN** the slice renders as `<g class="node" data-id="Dogs">` sized proportionally to its value

#### Scenario: Timeline events carry identity
- **WHEN** `timeline` source defines an event under a time period
- **THEN** the event renders as a `<g class="node" data-id="...">` node positioned along the time axis

#### Scenario: Radar axes and series carry identity
- **WHEN** `radar` source defines named axes and a data series
- **THEN** each plotted series point renders as a `<g class="node" data-id="...">` node on its axis

#### Scenario: Packet fields carry identity
- **WHEN** `packet` source defines a byte/bit range with a field name
- **THEN** the field renders as a `<g class="node" data-id="...">` node sized to its range

#### Scenario: Mindmap nodes carry identity
- **WHEN** `mindmap` source defines a root with indented child nodes
- **THEN** each node renders as `<g class="node" data-id="...">` laid out as a tree, with parent→child edges carrying `data-from`/`data-to`

#### Scenario: Tree view nodes carry identity
- **WHEN** `treeView` source defines a nested file/folder hierarchy
- **THEN** each node renders as `<g class="node" data-id="...">` keyed to its path, laid out as a tree with parent→child connectors

### Requirement: Stage 2 diagram coverage (medium difficulty)
The renderer SHALL render each Stage 2 diagram type to SVG, wrapping each primary
element in `<g class="node" data-id="<source id>">`, carrying `data-from`/`data-to`
on every relationship edge, and resolving all colors from the active theme.
Stage 2 types require a custom layout pass or richer parsing but remain bounded:
`journey`, `treemap`, `wardley` (coordinate/proportional placement plus a layout
pass), `venn` (set-overlap circle geometry), `ishikawa` (fishbone spine-and-branch
layout), and `kanban`, `requirementDiagram` (bundled ELK layout with typed
relationships).

> _Status: Planned · §3._

#### Scenario: Journey tasks carry identity
- **WHEN** `journey` source defines a task with a satisfaction score and actors
- **THEN** the task renders as a `<g class="node" data-id="...">` node placed by its score

#### Scenario: Treemap leaves carry identity
- **WHEN** `treemap` source defines a nested hierarchy with leaf values
- **THEN** each leaf renders as a `<g class="node" data-id="...">` node sized proportionally to its value

#### Scenario: Kanban cards carry identity
- **WHEN** `kanban` source defines cards within columns
- **THEN** each card renders as `<g class="node" data-id="...">` positioned in its column

#### Scenario: Requirement relationships reference endpoints
- **WHEN** `requirementDiagram` source defines a requirement, an element, and a `satisfies` relationship
- **THEN** each requirement and element renders as `<g class="node" data-id="...">` and the relationship edge carries `data-from`/`data-to`

#### Scenario: Venn sets carry identity
- **WHEN** `venn` source defines sets `A`, `B` and a `union` over them
- **THEN** each set renders as `<g class="node" data-id="A">` and the overlap region is addressable by its referenced set ids

#### Scenario: Wardley components carry identity
- **WHEN** `wardley` source places a component by `[visibility, evolution]` with a dependency to another component
- **THEN** each component renders as `<g class="node" data-id="...">` at its mapped position and the dependency link carries `data-from`/`data-to`

#### Scenario: Ishikawa causes carry identity
- **WHEN** `ishikawa` source defines an effect with categorized causes
- **THEN** the effect and each cause render as `<g class="node" data-id="...">` arranged along the fishbone spine, with cause→effect connectors

### Requirement: Stage 3 diagram coverage (high difficulty)
The renderer SHALL render each Stage 3 diagram type to SVG, wrapping each primary
element in `<g class="node" data-id="<source id>">`, carrying `data-from`/`data-to`
on every edge or flow link, and resolving all colors from the active theme.
Stage 3 types require scheduling, flow, swimlane, or nested-grammar layout:
`sankey`, `gantt` (xychart-style template with date/flow scheduling);
`gitGraph`, `C4Context` (and variants), `architecture-beta` (bundled ELK layout
with complex topology or nesting); and `eventmodeling` (time-ordered swimlane
layout with automatically inferred relations).

> _Status: Planned · §4._

#### Scenario: Sankey flows reference endpoints
- **WHEN** `sankey` source defines a `source,target,value` row
- **THEN** each node renders as `<g class="node" data-id="...">` and the flow link carries `data-from` and `data-to`

#### Scenario: Gantt tasks carry identity
- **WHEN** `gantt` source defines a task with a start and duration within a section
- **THEN** the task bar renders as a `<g class="node" data-id="...">` node spanning its date range

#### Scenario: Git graph commits carry identity
- **WHEN** `gitGraph` source defines commits across branches
- **THEN** each commit renders as `<g class="node" data-id="...">` and branch/merge edges carry `data-from`/`data-to`

#### Scenario: C4 elements and relationships carry identity
- **WHEN** `C4Context` source defines a `Person`/`System` and a relationship between them
- **THEN** each element renders as `<g class="node" data-id="...">` and the relationship edge carries `data-from`/`data-to`

#### Scenario: Architecture services and edges carry identity
- **WHEN** `architecture-beta` source defines services within groups and edges between them
- **THEN** each service renders as `<g class="node" data-id="...">` and each edge carries `data-from`/`data-to`

#### Scenario: Event-modeling time frames carry identity
- **WHEN** `eventmodeling` source defines a time frame such as `tf 01 ui CartUI`
- **THEN** the entity renders as `<g class="node" data-id="...">` keyed to its unique time-frame id and placed in the correct swimlane, with each inferred relation carrying `data-from`/`data-to`
