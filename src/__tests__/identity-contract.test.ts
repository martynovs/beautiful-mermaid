/**
 * Identity contract gate (§0.5).
 *
 * Every supported diagram type must render at least one addressable element:
 * structural types via `data-id`, coordinate data-point types via `data-label`.
 * This parametrized gate fails if a type emits neither, so a new type cannot
 * ship without identity coverage. Add a case here when wiring a new type.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'

// kind 'id'    → structural element, must emit data-id
// kind 'label' → coordinate data point, keyed by data-label
const CASES: Array<{ type: string; kind: 'id' | 'label'; src: string }> = [
  { type: 'flowchart', kind: 'id', src: `graph TD\n  A[Start] --> B[End]` },
  { type: 'state', kind: 'id', src: `stateDiagram-v2\n  Idle --> Running\n  Running --> Idle` },
  { type: 'sequence', kind: 'id', src: `sequenceDiagram\n  Alice->>Bob: Hi` },
  { type: 'class', kind: 'id', src: `classDiagram\n  class Animal\n  Animal <|-- Dog` },
  { type: 'er', kind: 'id', src: `erDiagram\n  CUSTOMER ||--o{ ORDER : places` },
  { type: 'quadrant', kind: 'id', src: `quadrantChart\n  A: [0.3, 0.6]` },
  { type: 'block', kind: 'id', src: `block-beta\n  columns 1\n  A["Alpha"]` },
  { type: 'xychart', kind: 'label', src: `xychart-beta\n  x-axis [Jan, Feb]\n  y-axis 0 --> 100\n  bar [30, 60]` },
  { type: 'pie', kind: 'id', src: `pie\n  "Dogs" : 30\n  "Cats" : 10` },
  { type: 'packet', kind: 'id', src: `packet\n  0-15: "Source Port"\n  16-31: "Dest Port"` },
  { type: 'radar', kind: 'id', src: `radar-beta\n  axis a["A"], b["B"], c["C"]\n  curve s["Series"]{1, 2, 3}` },
  { type: 'timeline', kind: 'id', src: `timeline\n  title History\n  2021 : First\n  2022 : Second` },
  { type: 'journey', kind: 'id', src: `journey\n  title My Day\n  section Work\n  Email: 3: Me\n  Code: 5: Me` },
  { type: 'venn', kind: 'id', src: `venn-beta\n  set A\n  set B\n  union A, B` },
  { type: 'wardley', kind: 'id', src: `wardley\n  title Tea Shop\n  component Cup [0.9, 0.2]\n  component Tea [0.7, 0.6]\n  Cup -> Tea` },
  { type: 'treemap', kind: 'id', src: `treemap\n"Root"\n    "Leaf 1": 10\n    "Leaf 2": 20` },
  { type: 'ishikawa', kind: 'id', src: `ishikawa\nLate delivery\n    Process\n        Slow review\n    People\n        Understaffed` },
  { type: 'kanban', kind: 'id', src: `kanban\n  todo[To Do]\n    t1[Task one]\n  doing[Doing]\n    t2[Task two]` },
  { type: 'treeview', kind: 'id', src: `treeView-beta\n  "src/"\n    "index.ts"\n    "util.ts"` },
  { type: 'requirement', kind: 'id', src: `requirementDiagram\nrequirement r1 {\n  id: 1\n  text: must work\n}\nelement e1 {\n  type: test\n}\ne1 - satisfies -> r1` },
  { type: 'mindmap', kind: 'id', src: `mindmap\n  root((Root))\n    Child A\n    Child B` },
  { type: 'sankey', kind: 'id', src: `sankey\nA,B,10\nB,C,5` },
  { type: 'gantt', kind: 'id', src: `gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section S\n  Task one : t1, 2024-01-01, 3d\n  Task two : after t1, 2d` },
  { type: 'gitgraph', kind: 'id', src: `gitGraph\n  commit id: "a"\n  branch dev\n  commit id: "b"\n  checkout main\n  merge dev` },
  { type: 'c4', kind: 'id', src: `C4Context\n  Person(user, "User")\n  System(sys, "System")\n  Rel(user, sys, "uses")` },
  { type: 'architecture', kind: 'id', src: `architecture-beta\n  group api(cloud)[API]\n  service db(database)[DB] in api\n  service web(server)[Web] in api\n  db:L -- R:web` },
  { type: 'eventmodeling', kind: 'id', src: `eventmodeling\n  tf 01 ui CartUI\n  tf 02 cmd AddItem\n  tf 03 evt ItemAdded` },
  { type: 'zenuml', kind: 'id', src: `zenuml\n  Alice->Bob: hello\n  Bob.process()` },
]

describe('identity contract gate', () => {
  for (const { type, kind, src } of CASES) {
    it(`${type} emits a stable ${kind} identifier`, () => {
      const svg = renderMermaidSVG(src)
      expect(svg).toContain('<svg')
      expect(svg).toContain(kind === 'id' ? 'data-id="' : 'data-label="')
    })
  }

  it('edge-bearing types carry data-from / data-to', () => {
    const svg = renderMermaidSVG(`graph TD\n  A --> B`)
    expect(svg).toContain('data-from="A"')
    expect(svg).toContain('data-to="B"')
  })
})
