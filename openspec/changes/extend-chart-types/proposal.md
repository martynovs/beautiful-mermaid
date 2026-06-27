# Extend diagram-type coverage with a stable interactivity contract

## Why

This fork makes beautiful-mermaid the rendering engine for an interactive
reasoning-artifact tool, where a human annotates individual diagram elements and
feedback is routed back to the agent keyed to each element. That requires every
rendered element to carry a **stable, semantic identifier** — the property a
renderer bake-off showed only beautiful-mermaid (and merman) provide, and which
beautiful-mermaid pairs with the best theming and in-browser synchronous render.

beautiful-mermaid ships 6 of Mermaid's ~22 diagram types. The reasoning
vocabulary needs more (tradeoff maps, plans, option trees, proportions). This
change adds the first two new types, codifies the identity contract all types
must honor, and sets the roadmap to full coverage.

## What Changes

- Add **quadrant** (`quadrantChart`) and **block** (`block-beta`) diagram types,
  each as a self-contained `src/<type>/` module wired into the dispatcher.
- Codify the **stable element identity** contract: every node carries a
  source-derived `data-id`; every edge carries `data-from`/`data-to`.
- Require **theme-consistent** rendering for all types (no hardcoded palette).
- Establish the per-type module pattern and a tiered roadmap toward full
  Mermaid diagram-type coverage (catalog in design.md).

## Impact

- Affected specs: `diagram-rendering` (new capability)
- Affected code: `src/quadrant/*`, `src/block/*`, `src/index.ts` (dispatch)
- No breaking changes; additive per-type modules, existing types untouched.
