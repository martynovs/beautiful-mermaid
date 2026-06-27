/**
 * Parser tests for requirement diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseRequirementDiagram } from '../requirement/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseRequirementDiagram', () => {
  it('parses a requirement block with all fields', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      requirement test_req {
        id: 1
        text: the test text.
        risk: high
        verifymethod: test
      }`))
    expect(d.requirements).toHaveLength(1)
    expect(d.requirements[0]).toEqual({
      name: 'test_req',
      kind: 'requirement',
      id: '1',
      text: 'the test text.',
      risk: 'high',
      verifyMethod: 'test',
    })
  })

  it('parses an element block with type and docref', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      element test_entity {
        type: simulation
        docref: ./spec.md
      }`))
    expect(d.elements).toHaveLength(1)
    expect(d.elements[0]).toEqual({
      name: 'test_entity',
      type: 'simulation',
      docref: './spec.md',
    })
  })

  it('parses a forward relationship', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      element test_entity {
        type: simulation
      }
      requirement test_req {
        id: 1
      }
      test_entity - satisfies -> test_req`))
    expect(d.relationships).toEqual([
      { source: 'test_entity', type: 'satisfies', dest: 'test_req' },
    ])
  })

  it('parses a reverse relationship into source/dest', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      test_req <- traces - test_entity`))
    expect(d.relationships).toEqual([
      { source: 'test_entity', type: 'traces', dest: 'test_req' },
    ])
  })

  it('supports typed requirement keywords', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      functionalRequirement fr1 {
        id: 2
      }
      performanceRequirement pr1 {
        id: 3
      }`))
    expect(d.requirements.map(r => r.kind)).toEqual([
      'functionalRequirement',
      'performanceRequirement',
    ])
  })

  it('parses a full diagram with multiple blocks and relationships', () => {
    const d = parseRequirementDiagram(toLines(`requirementDiagram
      requirement test_req {
        id: 1
        text: the test text.
        risk: high
        verifymethod: test
      }
      element test_entity {
        type: simulation
      }
      test_entity - satisfies -> test_req
      test_entity - verifies -> test_req`))
    expect(d.requirements).toHaveLength(1)
    expect(d.elements).toHaveLength(1)
    expect(d.relationships).toHaveLength(2)
    expect(d.relationships.map(r => r.type)).toEqual(['satisfies', 'verifies'])
  })
})
