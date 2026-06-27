# Tasks

## 1. Quadrant chart (`quadrantChart`)
- [x] 1.1 Implement `src/quadrant/{types,parser,layout,renderer}.ts`
- [x] 1.2 Wire `detectDiagramType` + `switch` case in `src/index.ts`
- [x] 1.3 Verify SVG emits `<g class="node" data-id=...>` per data point
- [x] 1.4 Verify colors resolve from theme CSS variables

## 2. Block diagram (`block-beta`)
- [x] 2.1 Implement `src/block/{types,parser,layout,renderer}.ts`
- [x] 2.2 Wire dispatch in `src/index.ts`
- [x] 2.3 Verify blocks carry `data-id` and edges carry `data-from`/`data-to`

## 3. Interactivity contract
- [ ] 3.1 Document the `data-id` / `data-from` / `data-to` convention for contributors
- [ ] 3.2 Add a test asserting every supported type emits node `data-id`

## 4. Priority tranche (highest reasoning value, cheapest)
- [ ] 4.1 `timeline` (coordinate)
- [ ] 4.2 `pie` (coordinate)
- [ ] 4.3 `mindmap` (graph — reuse ELK tree layout)
- [ ] 4.4 `radar` (coordinate)

## 5. Remaining coverage
- [ ] 5.1 Coordinate tier: `journey`, `sankey`, `gantt`, `treemap`, `packet`
- [ ] 5.2 Graph tier: `gitGraph`, `kanban`, `requirementDiagram`, `C4Context`, `architecture-beta`
