# Extend diagram-type coverage with a stable interactivity contract

## Why

This fork makes beautiful-mermaid the rendering engine for an interactive
reasoning-artifact tool, where a human annotates individual diagram elements and
feedback is routed back to the agent keyed to each element. That requires every
rendered element to carry a **stable, semantic identifier** — the property a
renderer bake-off showed only beautiful-mermaid (and merman) provide, and which
beautiful-mermaid pairs with the best theming and in-browser synchronous render.

beautiful-mermaid ships 6 of Mermaid's diagram types; the reasoning vocabulary
needs the rest (tradeoff maps, plans, option trees, proportions, flows). This
change ships the first two new types, codifies the identity contract all types
must honor, adds icons as a shared capability, and commits to **full coverage —
27 types total** — implemented in three difficulty-staged tranches.

## What Changes

- Ship **quadrant** (`quadrantChart`) and **block** (`block`) as the first
  self-contained `src/<type>/` modules wired into the dispatcher.
- Codify the **stable element identity** contract: every node carries a
  source-derived `data-id`; every edge carries `data-from`/`data-to`. Mandatory
  for every type.
- Add **shared icon rendering** as a horizontal capability (one icon registry +
  a glyph embedder inside each node group); declaration stays per type's native
  Mermaid grammar.
- Treat the **`-beta` header suffix as optional** on every type, so source
  survives Mermaid version churn.
- Require **theme-consistent** rendering for all types (no hardcoded palette).
- Require **test coverage** for every type: a parser test plus an identity
  integration test, gated by a parametrized "every type emits `data-id`" check.
- Commit to **full Mermaid diagram-type coverage** — 8 shipped + 19 planned in
  three difficulty-staged tranches (S1/S2/S3), plus optional `zenuml`; catalog
  with per-type syntax links in design.md.

## Impact

- Affected specs: `diagram-rendering` (new capability)
- Affected code: one `src/<type>/*` module per type, `src/index.ts` (dispatch +
  beta-suffix detection), a shared `src/icons/*` rendering module, and
  per-type suites under `src/__tests__/`.
- No breaking changes; additive per-type modules, existing types untouched.
