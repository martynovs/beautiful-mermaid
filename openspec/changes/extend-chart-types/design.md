# Design

## Context

This fork is the rendering engine for an interactive reasoning-artifact tool.
The tool composes a web page from agent-authored blocks and lets a human
annotate individual diagram elements; feedback is keyed to each element's id.
The renderer's job is therefore not just "pretty SVG" but **SVG whose elements
are individually addressable**.

## Goals / Non-Goals

**Goals**
- Ship `quadrant` and `block` now as the first new per-type modules.
- Make stable per-element identity a contract for every type.
- Add icon rendering as a shared, type-agnostic capability all types can use.
- Treat the `-beta` header suffix as optional on every type.
- Define a repeatable, low-cost per-type extension pattern and commit to full
  Mermaid coverage (27 types) delivered incrementally in three difficulty stages.

**Non-Goals**
- The reasoning-artifact tool itself (block format, validator, host, annotation
  transport) — separate repo.
- Porting to Rust (merman remains a fallback only if a single native binary
  becomes a hard requirement; it loses in-browser render + richest identity).
- Per-type advanced-feature parity with Mermaid: each new type scopes to the
  common syntax subset, not every edge-case directive.

## Decisions

### Engine choice (evidence-backed)
A bake-off of five renderers judged primarily on node identity:

| renderer | node identity | note |
| --- | --- | --- |
| **beautiful-mermaid** (TS) | richest (`data-id`+`data-shape`, edges `data-from`/`data-to`) | best themes, in-browser sync render |
| merman (Rust) | mermaid-compatible | 15/15 coverage, single binary; understated, no in-browser |
| mmdr / warp / rusty (Rust) | anonymous nodes | fast/lean but unaddressable |

Only beautiful-mermaid and merman passed the identity gate; beautiful-mermaid
won on themes, richest identity, and unique in-browser synchronous rendering
(it is pure TS — elkjs is JS, no JVM — so it powers the live playground).

### Extension pattern
Each type = `src/<type>/{types,parser,layout,renderer}.ts` + 3 lines of dispatch
wiring in `src/index.ts`. Measured cost: quadrant 442 LOC, block 385 LOC
(~400/type). Coordinate types use the xychart template (no ELK); graph types
reuse the bundled ELK instance.

### Identity contract
Nodes: `<g class="node" data-id="<source id>">`. Edges: `data-from`/`data-to`.
This is what makes annotation, dependency-highlight, and state-simulation
overlays generic in the consuming tool. Mandatory for every type.

### Icon rendering (shared, horizontal capability)
Icons are wanted in **every** type, so they are built once as a type-agnostic
capability rather than per type. The concern splits cleanly:

- **Render side (build once):** an icon-name → SVG registry + iconify-pack loader
  + an embedder that drops the glyph inside each node's `<g class="node" data-id>`.
  Type-agnostic and theme-aware. This is the expensive half — and the half
  `architecture-beta` would otherwise have paid alone.
- **Declaration side (per type):** each type opts in through its **own native
  Mermaid grammar** — architecture `service id(icon)[label]`, flowchart/block
  `@{ icon: "…" }` or `fa:` label tokens. The `(icon)` syntax is **not portable**:
  `( )` already means node shapes in flowchart and coordinates in quadrant, so
  reusing it would collide with Mermaid. No fork-specific syntax is introduced;
  output (the embedded glyph) is shared, syntax is not.

**Payoff:** removes `architecture-beta`'s icon cost (its expensive half), closes
the "brand icon" gap that made flowchart-with-subgraphs a lossy substitute for
architecture/C4, and lets any node-bearing type opt into icons. The identity
contract is unaffected — an icon is decoration *inside* the existing node group.

**Sequencing:** foundational. Shared icon rendering lands **before** the Stage 1–3
type work, so each type wires into the icon module instead of reinventing it. With
it in place, `architecture-beta` drops from Stage 3 toward Stage 2 (its remaining
cost is fixed-side ports + nested groups, not icons).

### Test strategy
Tests run under `bun test` over `src/__tests__/`, following the existing layered
pattern: a **parser test** asserting the parsed model, and an **integration test**
that calls `renderMermaid(src)` and string-matches the SVG (the
`xychart-integration.test.ts` shape). Every type's integration test asserts the
identity contract (`data-id`, `data-from`/`data-to`) and theme-variable
resolution. A single **parametrized identity gate** renders every registered type
and fails if any emits no node `data-id`, so coverage can't silently regress as
types are added. The built-in types and the already-shipped `quadrant`/`block`
(which currently have no tests and no `data-id` assertions anywhere) are
backfilled to this standard first.

## Coverage catalog (target: full Mermaid set)

Tier — C: coordinate / geometric, no ELK (most reuse the xychart-style template;
the geometric types — `venn` circle-overlap, `ishikawa` fishbone — use a bespoke
layout) · G: graph or tree (ELK) · S: sequence-family. Each type links to its
Mermaid syntax page.

| type | header | status | tier |
| --- | --- | --- | --- |
| [Flowchart](https://mermaid.ai/open-source/syntax/flowchart.html) | `graph`/`flowchart` | built-in | G |
| [Sequence](https://mermaid.ai/open-source/syntax/sequenceDiagram.html) | `sequenceDiagram` | built-in | S |
| [Class](https://mermaid.ai/open-source/syntax/classDiagram.html) | `classDiagram` | built-in | G |
| [State](https://mermaid.ai/open-source/syntax/stateDiagram.html) | `stateDiagram-v2` | built-in | G |
| [Entity-Relationship](https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html) | `erDiagram` | built-in | G |
| [XY Chart](https://mermaid.ai/open-source/syntax/xyChart.html) | `xychart` | built-in | C |
| [Quadrant](https://mermaid.ai/open-source/syntax/quadrantChart.html) | `quadrantChart` | this change | C |
| [Block](https://mermaid.ai/open-source/syntax/block.html) | `block` | this change | C |
| [Pie](https://mermaid.ai/open-source/syntax/pie.html) | `pie` | planned · S1 | C |
| [Timeline](https://mermaid.ai/open-source/syntax/timeline.html) | `timeline` | planned · S1 | C |
| [Radar](https://mermaid.ai/open-source/syntax/radar.html) | `radar` | planned · S1 | C |
| [Packet](https://mermaid.ai/open-source/syntax/packet.html) | `packet` | planned · S1 | C |
| [Mindmap](https://mermaid.ai/open-source/syntax/mindmap.html) | `mindmap` | planned · S1 | G |
| [Tree View](https://mermaid.ai/open-source/syntax/treeView.html) | `treeView-beta` | planned · S1 | G (tree) |
| [User Journey](https://mermaid.ai/open-source/syntax/userJourney.html) | `journey` | planned · S2 | C |
| [Treemap](https://mermaid.ai/open-source/syntax/treemap.html) | `treemap` | planned · S2 | C |
| [Venn](https://mermaid.ai/open-source/syntax/venn.html) | `venn-beta` | planned · S2 | C |
| [Wardley](https://mermaid.ai/open-source/syntax/wardley.html) | `wardley-beta` | planned · S2 | C |
| [Ishikawa](https://mermaid.ai/open-source/syntax/ishikawa.html) | `ishikawa` | planned · S2 | C (fishbone) |
| [Kanban](https://mermaid.ai/open-source/syntax/kanban.html) | `kanban` | planned · S2 | G |
| [Requirement](https://mermaid.ai/open-source/syntax/requirementDiagram.html) | `requirementDiagram` | planned · S2 | G |
| [Sankey](https://mermaid.ai/open-source/syntax/sankey.html) | `sankey` | planned · S3 | C |
| [Gantt](https://mermaid.ai/open-source/syntax/gantt.html) | `gantt` | planned · S3 | C |
| [Git graph](https://mermaid.ai/open-source/syntax/gitgraph.html) | `gitGraph` | planned · S3 | G |
| [C4](https://mermaid.ai/open-source/syntax/c4.html) | `C4Context` (+variants) | planned · S3 | G |
| [Architecture](https://mermaid.ai/open-source/syntax/architecture.html) | `architecture-beta` | planned · S3 | G |
| [Event Modeling](https://mermaid.ai/open-source/syntax/eventmodeling.html) | `eventmodeling` | planned · S3 | G (swimlane) |
| [ZenUML](https://mermaid.ai/open-source/syntax/zenuml.html) | `zenuml` | optional | S |

Headers: the renderer treats the `-beta` suffix as optional on **every** type (see
the *Header beta-suffix tolerance* requirement), so graduated types (`block`,
`xychart`, `sankey`, `packet`) and still-beta types (`architecture-beta`,
`venn-beta`, `wardley-beta`, `treeView-beta`) all resolve with or without it.

Coverage at this change: **8 / 27** (6 built-in + 2 added); 19 planned
(S1: 6 · S2: 7 · S3: 6), plus `zenuml` optional.

## Risks / Trade-offs
- Mermaid per-type grammars are quirky; parsers are the fiddly part. Mitigation:
  start from the closest existing template; scope to the common syntax subset.
- `block` advanced features (spans, nested groups, widths) are out of scope;
  this change supports the flat uniform grid only.
- Upstream drift: per-type modules are additive and should rebase cleanly on
  `git pull upstream main`.
