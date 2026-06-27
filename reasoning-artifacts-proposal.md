# Proposal: beautiful-mermaid as the engine for interactive reasoning artifacts

Status: draft · Branch: `spike/extend-types` · Fork of `lukilabs/beautiful-mermaid`

## Summary

This fork exists to make **beautiful-mermaid the rendering engine for an
interactive "reasoning artifact" tool** — a tool where an AI agent presents its
thinking as a web page (diagrams, questions, tradeoff blocks) that a human
annotates element-by-element, with feedback routed back to the agent keyed to
the exact element.

The engine choice was made empirically (a renderer bake-off, below). The work
this fork carries is **extending beautiful-mermaid with the diagram types the
reasoning vocabulary needs**, while preserving the property that makes the whole
approach possible: stable, semantic per-element identity in the SVG.

## Context: what consumes this engine

The tool around this engine (built separately) works like:

```
  agent emits constrained blocks (markdown fences, info-string grammar)
      ```mermaid #host-decision feedback=annotate
      graph TD ...
      ```
        │
        ▼
  TOOL: validate (Loop 1 — validation IS rendering; errors → agent, no human)
        │ clean
        ▼
  TOOL: compose web page  → beautiful-mermaid SVG + inline feedback controls
        │
        ▼
  HUMAN annotates a diagram node / answers a question (Loop 2)
        │  feedback keyed to data-id
        ▼
  agent revises → re-render → repeat → "Finish review" ends the loop
```

beautiful-mermaid is the **"compose web page → SVG"** step. Everything the tool
does interactively (click a node to annotate, highlight dependencies, live-edit
in a playground) hangs off the SVG carrying a stable id per element.

## Why beautiful-mermaid (decision + evidence)

We spiked five renderers against the same diagrams, judging on a single decisive
criterion — **node identity** (does each SVG node carry a stable, semantic id so
feedback can be addressed to it?) — plus polish, coverage, and footprint.

| renderer | lang | node identity | notes |
| --- | --- | --- | --- |
| **beautiful-mermaid** | TS | **✓ richest** (`data-id` + `data-shape`; edges `data-from`/`data-to`) | best aesthetics, 15 live themes, **in-browser synchronous render** |
| merman | Rust | ✓ mermaid-compatible | 15/15 type coverage, single binary; understated, no in-browser render |
| mmdr | Rust | ✗ anonymous nodes | fast, but nodes unaddressable |
| warp | Rust | ✗ anonymous | dagre-based, seq/state experimental |
| rusty-mermaid | Rust | ✗ anonymous | lean, attractive, but unaddressable |

Only beautiful-mermaid (TS) and merman (Rust) passed the node-identity gate.
beautiful-mermaid was chosen because it uniquely combines:

- **Richest semantic identity** — `<g class="node" data-id="Auth" data-shape="diamond">`, edges `data-from`/`data-to`. Annotation/simulation/highlight overlays are ~30 lines of JS on top.
- **In-browser synchronous render** — it's pure TS (elkjs is JS, no Java/JVM), so it runs client-side with no round-trip. This powers the live-edit *playground* that a native binary (merman) can't do without WASM.
- **Aesthetics + theming** — 15 themes, two-color `color-mix()` derivation, CSS-variable live theme switching.
- **One consistent engine** — one ID scheme, one look, across every type.

The only axis merman led was **coverage** (15 types vs beautiful-mermaid's 6).
That gap is the work in this fork — and it proved cheap to close (next section).

## What this fork adds

beautiful-mermaid ships 6 diagram types: flowchart, state, sequence, class, ER,
xychart. The reasoning vocabulary wants more (quadrant for tradeoff maps,
timeline for plans, mindmap for option trees, etc.).

The renderer is **modular** — each type is a self-contained
`src/<type>/{types,parser,layout,renderer}.ts` plus three lines of dispatch
wiring in `src/index.ts` (`detectDiagramType` regex + a `switch` case). Adding a
type does not touch existing types.

This branch adds **two** as a cost probe:

| type | LOC | template | notes |
| --- | --- | --- | --- |
| **quadrant** (`quadrantChart`) | 442 | xychart (coordinate-based, no ELK) | square plot, axis + region labels, points as `data-id` nodes |
| **block** (`block-beta`) | 385 | flowchart (grid + edges) | grid layout, blocks as `data-id` nodes, edges with `data-from`/`data-to` |

Both typecheck clean and render in-theme, **visually indistinguishable from the
built-in six**, with full `data-id` interactivity. Total: ~827 LOC of modules +
19 lines of dispatcher wiring, written in parallel in minutes.

**Measured cost of a diagram type: ~400 LOC.** Coordinate types (pie, timeline,
journey, gantt, sankey) follow the xychart template (no ELK); graph types
(mindmap) reuse the existing ELK instance. The 6→15 coverage gap is therefore
~a few thousand mechanical, parallelizable LOC — and you only build the types
you actually use.

## The interactivity contract (must-preserve invariant)

Every interactive element MUST be emitted with a stable, semantic identifier:

- nodes: `<g class="node" data-id="<source id>" ...>`
- edges: `<polyline class="edge" data-from="<src>" data-to="<dst>" ...>`

This is the linchpin of the entire reasoning-artifact approach — it is what lets
the consuming tool attach annotation, dependency-highlight, and state-simulation
behaviors generically. **Any new diagram type added to this fork must follow this
convention.** (The two types added here do.)

## Complete chart / diagram type coverage

The goal is **full Mermaid diagram-type coverage** so the agent can pick the
right visual for any reasoning shape. Every type below must follow the
`data-id` interactivity contract. Implementation tier:

- **C = coordinate** — value/position placement, the `xychart` template, no ELK (cheapest, ~250–450 LOC)
- **G = graph** — needs layered/tree layout, reuses the ELK instance (~400–700 LOC)
- **S = sequence-family** — lifeline/message layout (own layout)

| # | type | mermaid header | status | tier | typical reasoning use |
| --- | --- | --- | --- | --- | --- |
| 1 | Flowchart | `graph` / `flowchart` | ✅ built-in | G | decisions, control flow |
| 2 | Sequence | `sequenceDiagram` | ✅ built-in | S | interactions, protocols |
| 3 | Class | `classDiagram` | ✅ built-in | G | data models, type structure |
| 4 | State | `stateDiagram-v2` | ✅ built-in | G | state machines, lifecycles |
| 5 | Entity-Relationship | `erDiagram` | ✅ built-in | G | schemas, entity relations |
| 6 | XY Chart | `xychart-beta` | ✅ built-in | C | quantitative bar/line |
| 7 | Quadrant | `quadrantChart` | ✅ **this fork** | C | tradeoff / positioning maps |
| 8 | Block | `block-beta` | ✅ **this fork** | C | architecture grids, loops |
| 9 | Pie | `pie` | ⬜ planned | C | proportions, budget splits |
| 10 | Timeline | `timeline` | ⬜ planned | C | plans, roadmaps, history |
| 11 | User Journey | `journey` | ⬜ planned | C | UX flows, satisfaction |
| 12 | Gantt | `gantt` | ⬜ planned | C | schedules, dependencies |
| 13 | Sankey | `sankey-beta` | ⬜ planned | C | flow / volume distribution |
| 14 | Radar | `radar` | ⬜ planned | C | multi-criteria comparison |
| 15 | Packet | `packet-beta` | ⬜ planned | C | byte/bit layouts, formats |
| 16 | Treemap | `treemap` | ⬜ planned | C | nested proportions |
| 17 | Mindmap | `mindmap` | ⬜ planned | G | option trees, brainstorming |
| 18 | Git graph | `gitGraph` | ⬜ planned | G | branch/commit history |
| 19 | Requirement | `requirementDiagram` | ⬜ planned | G | requirements traceability |
| 20 | C4 | `C4Context` (+ variants) | ⬜ planned | G | system context / containers |
| 21 | Architecture | `architecture-beta` | ⬜ planned | G | service/infra topology |
| 22 | Kanban | `kanban` | ⬜ planned | G | task boards, agent plans |
| 23 | ZenUML | `zenuml` | ⬜ optional | S | alt sequence syntax |

Coverage today: **8 / 22** (6 built-in + 2 this fork). At the measured ~400
LOC/type, full coverage is a bounded, parallelizable effort — and types can be
added on demand, highest reasoning-value first.

## Roadmap

1. **Priority tranche** (highest reasoning value, cheapest): `timeline` (C),
   `pie` (C), `mindmap` (G), `radar` (C) — covers plans, proportions, option
   trees, and multi-criteria comparison.
2. **Coordinate tranche** (xychart template, fast): `journey`, `sankey`,
   `gantt`, `treemap`, `packet`.
3. **Graph tranche** (reuse ELK): `gitGraph`, `kanban`, `requirement`, `C4`,
   `architecture`.
4. **Keep parity with upstream** — `git pull upstream main`; per-type modules
   are additive and should rebase cleanly.
5. **Optional**: upstream new types as PRs to `lukilabs/beautiful-mermaid`.

Each type ships as `src/<type>/{types,parser,layout,renderer}.ts` + 3-line
dispatch wiring, emitting `data-id` nodes (and `data-from`/`data-to` edges).

## Non-goals

- The reasoning-artifact tool itself (block format, validator, host loop,
  annotation transport) lives in a separate repo — this fork is only the renderer.
- Porting the renderer to Rust. merman (Rust) remains the fallback **only** if a
  single native binary ever becomes a hard distribution requirement; it loses the
  in-browser playground and richest-identity advantages.

## Appendix: spike artifacts

The decision above was validated end-to-end (renderer bake-off screenshots,
client-side live-render proof, inline-annotation prototype, and this fork's
extension). Those throwaway artifacts lived under the tool repo's scratch dir and
are not part of this renderer fork.
