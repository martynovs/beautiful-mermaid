# Tasks

Per-type cost is ~400 LOC (measured: quadrant 442, block 385). Coordinate types
use the xychart-style template (no ELK); graph/tree types reuse the bundled ELK
instance. See design.md for the full catalog and per-type syntax links.

**Acceptance:** a type's task is complete only when it ships with a parser test
and an identity integration test (asserting node `data-id` + edge
`data-from`/`data-to`) under `src/__tests__/`, following the
`xychart-integration.test.ts` pattern.

## 0. Foundations (cross-cutting — land before the type tranches)
- [x] 0.1 Per-type module pattern (`src/<type>/{types,parser,layout,renderer}.ts`) + dispatch wiring in `src/index.ts`
- [x] 0.2 Shared icon rendering: `src/icons/registry.ts` (`renderIcon`/`hasIcon`/`ICON_NAMES`, 10 built-in glyphs, `currentColor` theming, graceful fallback); + tests. Consumed by renderers (e.g. architecture) via import.
- [x] 0.3 Header beta-suffix tolerance: per-type `(-beta)?` in the dispatcher for types with a beta form (`xychart`, `block` wired; future types add their own); + detection test
- [x] 0.4 Document the identity contract for contributors (`docs/identity-contract.md`: `data-id` / `data-from` / `data-to`, data-label for coordinate points, derivation/uniqueness)
- [x] 0.5 Identity test harness: a parametrized gate (`identity-contract.test.ts`) renders every registered type and asserts its addressable attribute (`data-id` or `data-label`) + edge `data-from`/`data-to`, so new types cannot ship without coverage
- [x] 0.6 Backfill built-in identity coverage via the §0.5 gate (`flowchart`, `state`, `sequence`, `class`, `er`, `xychart`); parser tests pre-exist (`parser`, `class-parser`, `er-parser`, `sequence-parser`)
- [x] 0.7 Backfill parser + identity integration tests for `quadrant` and `block` (shipped without tests)

## 1. Shipped in this change
- [x] 1.1 Quadrant (`quadrantChart`) — module, dispatch, per-point `data-id`, theme colors
- [x] 1.2 Block (`block`) — module, dispatch, grid layout, `data-id` blocks, `data-from`/`data-to` edges

## 2. Stage 1 — low difficulty (template / tree reuse)
- [x] 2.1 `pie` (coordinate) — module, dispatch, `data-id`+`data-value` slices, legend, theme colors; parser + integration tests
- [x] 2.2 `timeline` (coordinate) — sections/periods/events, `data-id` events; parser + render tests
- [x] 2.3 `radar` (coordinate) — polar axes + series, `data-id` vertices; parser + render tests
- [x] 2.4 `packet` (coordinate) — 32-bit grid, `data-id` fields; parser + render tests
- [x] 2.5 `mindmap` (self-contained recursive tree, no ELK) — `data-id` nodes, `data-from`/`data-to` connectors; raw-line dispatch; parser + render tests
- [x] 2.6 `treeView` (self-contained indented tree, inline folder/file glyphs) — path `data-id` nodes; raw-line dispatch; parser + render tests
- [x] 2.7 Parser + identity integration tests for all Stage 1 types (each type has parser + render tests; all in the identity gate)

## 3. Stage 2 — medium difficulty (custom layout / typed relations)
- [x] 3.1 `journey` (coordinate) — sections/tasks/scores, `data-id`+`data-value`; parser + render tests
- [x] 3.2 `treemap` (coordinate — squarified layout) — path `data-id`+`data-value` cells; raw-line dispatch; parser + render tests
- [x] 3.3 `venn` (geometric — set-overlap circles) — `data-id` sets + union regions; parser + render tests
- [x] 3.4 `wardley` (coordinate — `[visibility, evolution]` placement + dependencies) — `data-id` components, `data-from`/`data-to` links; parser + render tests
- [x] 3.5 `ishikawa` (geometric — fishbone spine-and-branch) — `data-id` effect/categories/causes, `data-from`/`data-to` bones; raw-line dispatch; parser + render tests
- [x] 3.6 `kanban` (self-contained column layout, no ELK) — `data-id` cards + columns; raw-line dispatch; parser + render tests
- [x] 3.7 `requirementDiagram` (self-contained grid, no ELK) — `data-id` requirements/elements, `data-from`/`data-to` relationships; parser + render tests
- [x] 3.8 Parser + identity integration tests for all Stage 2 types (each type has parser + render tests; all in the identity gate)

## 4. Stage 3 — high difficulty (scheduling / flow / swimlane / nesting)
- [x] 4.1 `sankey` (coordinate — flow widths) — `data-id` nodes, `data-from`/`data-to` flow bands; parser + render tests
- [x] 4.2 `gantt` (coordinate — date scheduling) — `data-id` task bars, date axis, `after` deps; parser + render tests
- [x] 4.3 `gitGraph` (commit/branch timeline) — `data-id` commits, `data-from`/`data-to` edges, branch lanes; parser + render tests
- [x] 4.4 `C4Context` (+variants) — `data-id` elements, `data-from`/`data-to` Rels, boundaries; parser + render tests
- [x] 4.5 `architecture-beta` (nested groups + side-anchored edges; icons from 0.2) — `data-id` groups/services, `data-from`/`data-to` edges, icon glyphs; parser + render tests
- [x] 4.6 `eventmodeling` (time-ordered swimlanes + inferred relations) — `data-id` frames, `data-from`/`data-to` relations; parser + render tests
- [x] 4.7 Parser + identity integration tests for all Stage 3 types (each type has parser + render tests; all in the identity gate)

## 5. Optional
- [x] 5.1 `zenuml` (sequence-family) — lifelines + message arrows, `data-id` participants, `data-from`/`data-to` messages; parser + render tests
