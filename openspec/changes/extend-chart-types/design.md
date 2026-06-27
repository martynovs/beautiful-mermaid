# Design

## Context

This fork is the rendering engine for an interactive reasoning-artifact tool.
The tool composes a web page from agent-authored blocks and lets a human
annotate individual diagram elements; feedback is keyed to each element's id.
The renderer's job is therefore not just "pretty SVG" but **SVG whose elements
are individually addressable**.

## Goals / Non-Goals

**Goals**
- Add `quadrant` and `block` diagram types.
- Make stable per-element identity a contract for every type.
- Define a repeatable, low-cost per-type extension pattern and a coverage roadmap.

**Non-Goals**
- The reasoning-artifact tool itself (block format, validator, host, annotation
  transport) — separate repo.
- Porting to Rust (merman remains a fallback only if a single native binary
  becomes a hard requirement; it loses in-browser render + richest identity).

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

## Coverage catalog (target: full Mermaid set)

Tier — C: coordinate (xychart template, no ELK) · G: graph (ELK) · S: sequence-family.

| type | header | status | tier |
| --- | --- | --- | --- |
| Flowchart | `graph`/`flowchart` | built-in | G |
| Sequence | `sequenceDiagram` | built-in | S |
| Class | `classDiagram` | built-in | G |
| State | `stateDiagram-v2` | built-in | G |
| Entity-Relationship | `erDiagram` | built-in | G |
| XY Chart | `xychart-beta` | built-in | C |
| Quadrant | `quadrantChart` | this change | C |
| Block | `block-beta` | this change | C |
| Pie | `pie` | planned | C |
| Timeline | `timeline` | planned | C |
| User Journey | `journey` | planned | C |
| Gantt | `gantt` | planned | C |
| Sankey | `sankey-beta` | planned | C |
| Radar | `radar` | planned | C |
| Packet | `packet-beta` | planned | C |
| Treemap | `treemap` | planned | C |
| Mindmap | `mindmap` | planned | G |
| Git graph | `gitGraph` | planned | G |
| Requirement | `requirementDiagram` | planned | G |
| C4 | `C4Context` (+variants) | planned | G |
| Architecture | `architecture-beta` | planned | G |
| Kanban | `kanban` | planned | G |
| ZenUML | `zenuml` | optional | S |

Coverage at this change: **8 / 22** (6 built-in + 2 added).

## Risks / Trade-offs
- Mermaid per-type grammars are quirky; parsers are the fiddly part. Mitigation:
  start from the closest existing template; scope to the common syntax subset.
- `block-beta` advanced features (spans, nested groups, widths) are out of scope;
  this change supports the flat uniform grid only.
- Upstream drift: per-type modules are additive and should rebase cleanly on
  `git pull upstream main`.
