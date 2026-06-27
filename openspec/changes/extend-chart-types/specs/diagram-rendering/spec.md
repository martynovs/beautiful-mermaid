# diagram-rendering

## ADDED Requirements

### Requirement: Stable element identity
The renderer SHALL emit every interactive diagram element with a stable,
source-derived identifier. Each node SHALL be wrapped in a
`<g class="node" data-id="<source id>">`, and each edge SHALL carry
`data-from` and `data-to` attributes referencing its source and target node ids.

#### Scenario: Node carries its source id
- **WHEN** a flowchart containing the node `Auth{Authenticated?}` is rendered to SVG
- **THEN** the SVG contains a `<g class="node" data-id="Auth">` wrapping that node's shape and label

#### Scenario: Edge references its endpoints
- **WHEN** an edge `A --> B` is rendered to SVG
- **THEN** the SVG contains an edge element with `data-from="A"` and `data-to="B"`

### Requirement: Quadrant chart rendering
The renderer SHALL render Mermaid `quadrantChart` source to SVG. It SHALL place
each data point by its `(x, y)` coordinate in the range 0..1 with the y-axis
inverted for screen space, label both axis ends and the four quadrant regions,
and emit each point as a `data-id` node.

#### Scenario: Point placement and identity
- **WHEN** `quadrantChart` source defines `beautiful-mermaid: [0.3, 0.9]`
- **THEN** the SVG places a labelled point in the upper-left (high-y, low-x) region
- **AND** that point is wrapped in `<g class="node" data-id="beautiful-mermaid">`

#### Scenario: Axis and quadrant labels
- **WHEN** source defines `x-axis Low effort --> High effort` and `quadrant-1 Ideal`
- **THEN** the SVG renders both x-axis end labels and the four quadrant region labels

### Requirement: Block diagram rendering
The renderer SHALL render Mermaid `block-beta` source to SVG. It SHALL lay out
blocks in a uniform grid whose width is set by `columns N`, treat the `space`
keyword as an empty cell, render each block as a `data-id` node, and draw edges
between blocks.

#### Scenario: Grid layout with blocks and edges
- **WHEN** `block-beta` source with `columns 3` defines blocks `Agent`, `Tool` and an edge `Agent --> Tool`
- **THEN** each block renders as `<g class="node" data-id="...">` positioned in the grid
- **AND** the edge renders with `data-from="Agent"` and `data-to="Tool"`

#### Scenario: Space consumes a grid cell
- **WHEN** a row contains `Agent space Tool`
- **THEN** `Agent` and `Tool` occupy the first and third columns with the second column empty

### Requirement: Theme-consistent rendering
Every diagram type SHALL render using the active theme's colors via CSS custom
properties, with no hardcoded palette, so changing the theme restyles all types
without re-rendering.

#### Scenario: New types honor the active theme
- **WHEN** a quadrant or block diagram is rendered with the `tokyo-night` theme
- **THEN** its strokes, fills, and text resolve from theme CSS variables (e.g. `--_text`, `--_line`, `--_node-fill`) rather than literal colors
