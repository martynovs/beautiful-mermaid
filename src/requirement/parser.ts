import type {
  RequirementDiagram,
  Requirement,
  RequirementElement,
  RequirementKind,
} from './types.ts'

// ============================================================================
// Requirement diagram parser
//
// Parses Mermaid `requirementDiagram` syntax into a RequirementDiagram.
//
// Supported syntax:
//   requirement test_req {
//     id: 1
//     text: the test text.
//     risk: high
//     verifymethod: test
//   }
//   element test_entity {
//     type: simulation
//     docref: ./spec.md
//   }
//   test_entity - satisfies -> test_req
//   test_req <- traces - other_entity
//
// Requirement keywords: requirement, functionalRequirement,
// interfaceRequirement, performanceRequirement, physicalRequirement,
// designConstraint.
//
// Relationship types: satisfies, traces, derives, refines, contains, copies,
// verifies.
//
// Lines are expected to be already trimmed (indentation does not matter — only
// the brace structure does). Blocks span multiple lines.
// ============================================================================

const REQUIREMENT_KINDS = new Set<string>([
  'requirement',
  'functionalRequirement',
  'interfaceRequirement',
  'performanceRequirement',
  'physicalRequirement',
  'designConstraint',
])

/**
 * Parse a Mermaid requirement diagram from preprocessed (trimmed) lines.
 */
export function parseRequirementDiagram(lines: string[]): RequirementDiagram {
  const diagram: RequirementDiagram = {
    requirements: [],
    elements: [],
    relationships: [],
  }

  let currentReq: Requirement | null = null
  let currentEl: RequirementElement | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // --- Inside a block body ---
    if (currentReq || currentEl) {
      if (line.startsWith('}')) {
        currentReq = null
        currentEl = null
        continue
      }
      const field = parseField(line)
      if (field) {
        if (currentReq) applyRequirementField(currentReq, field.key, field.value)
        else if (currentEl) applyElementField(currentEl, field.key, field.value)
      }
      continue
    }

    // --- Block start: `<keyword> <name> {` ---
    const blockMatch = line.match(/^(\w+)\s+(.+?)\s*\{$/)
    if (blockMatch) {
      const keyword = blockMatch[1]!
      const name = blockMatch[2]!.trim()
      if (keyword === 'element') {
        const el: RequirementElement = { name }
        diagram.elements.push(el)
        currentEl = el
        continue
      }
      if (REQUIREMENT_KINDS.has(keyword)) {
        const req: Requirement = { name, kind: keyword as RequirementKind }
        diagram.requirements.push(req)
        currentReq = req
        continue
      }
      // Unknown keyword — ignore the block start (don't enter a body).
      continue
    }

    // --- Relationship line ---
    const rel = parseRelationship(line)
    if (rel) diagram.relationships.push(rel)
  }

  return diagram
}

/** Parse a `key: value` field line. */
function parseField(line: string): { key: string; value: string } | null {
  const m = line.match(/^(\w+)\s*:\s*(.+)$/)
  if (!m) return null
  return { key: m[1]!.toLowerCase(), value: stripQuotes(m[2]!.trim()) }
}

function applyRequirementField(req: Requirement, key: string, value: string): void {
  switch (key) {
    case 'id':
      req.id = value
      break
    case 'text':
      req.text = value
      break
    case 'risk':
      req.risk = value
      break
    case 'verifymethod':
      req.verifyMethod = value
      break
    default:
      break
  }
}

function applyElementField(el: RequirementElement, key: string, value: string): void {
  switch (key) {
    case 'type':
      el.type = value
      break
    case 'docref':
      el.docref = value
      break
    default:
      break
  }
}

/**
 * Parse a relationship line in either direction:
 *   src - type -> dest
 *   dest <- type - src
 */
function parseRelationship(line: string): RequirementDiagram['relationships'][number] | null {
  // Forward: src - type -> dest
  const fwd = line.match(/^(\S+)\s*-\s*(\w+)\s*->\s*(\S+)$/)
  if (fwd) {
    return { source: fwd[1]!, type: fwd[2]!, dest: fwd[3]! }
  }
  // Reverse: dest <- type - src
  const rev = line.match(/^(\S+)\s*<-\s*(\w+)\s*-\s*(\S+)$/)
  if (rev) {
    return { source: rev[3]!, type: rev[2]!, dest: rev[1]! }
  }
  return null
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '')
}
