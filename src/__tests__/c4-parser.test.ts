/**
 * Parser tests for C4 diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { parseC4Diagram } from '../c4/parser.ts'

const toLines = (src: string) =>
  src.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseC4Diagram', () => {
  it('parses persons and systems with labels and descriptions', () => {
    const d = parseC4Diagram(toLines(`C4Context
      title System Context diagram
      Person(customer, "Personal Banking Customer", "A customer of the bank")
      System(banking, "Internet Banking System", "Allows customers to view their accounts")
      System_Ext(email, "E-Mail System", "Microsoft Exchange")`))

    expect(d.elements).toHaveLength(3)

    const customer = d.elements.find(e => e.alias === 'customer')!
    expect(customer.kind).toBe('person')
    expect(customer.label).toBe('Personal Banking Customer')
    expect(customer.descr).toBe('A customer of the bank')
    expect(customer.external).toBe(false)

    const banking = d.elements.find(e => e.alias === 'banking')!
    expect(banking.kind).toBe('system')
    expect(banking.external).toBe(false)

    const email = d.elements.find(e => e.alias === 'email')!
    expect(email.kind).toBe('system')
    expect(email.external).toBe(true)
  })

  it('parses relationships including direction and bidirectional forms', () => {
    const d = parseC4Diagram(toLines(`C4Context
      Person(customer, "Customer")
      System(banking, "Banking System")
      System_Ext(email, "E-Mail System")
      Rel(customer, banking, "Uses")
      Rel_D(banking, email, "Sends e-mails", "SMTP")
      BiRel(customer, email, "Receives mail")`))

    expect(d.relationships).toHaveLength(3)

    const uses = d.relationships[0]!
    expect(uses.from).toBe('customer')
    expect(uses.to).toBe('banking')
    expect(uses.label).toBe('Uses')
    expect(uses.bidirectional).toBe(false)

    const sends = d.relationships[1]!
    expect(sends.techn).toBe('SMTP')
    expect(sends.direction).toBe('down')

    const bi = d.relationships[2]!
    expect(bi.bidirectional).toBe(true)
  })

  it('parses containers with technology and a boundary block spanning lines', () => {
    const d = parseC4Diagram(toLines(`C4Container
      System_Boundary(c1, "Internet Banking") {
        Container(web, "Web Application", "Java, Spring MVC", "Delivers static content")
        Container(api, "API Application", "Java, Docker", "Provides banking functionality")
      }
      Person(customer, "Customer")
      Rel(customer, web, "Uses", "HTTPS")`))

    expect(d.boundaries).toHaveLength(1)
    expect(d.boundaries[0]!.alias).toBe('c1')

    const web = d.elements.find(e => e.alias === 'web')!
    expect(web.kind).toBe('container')
    expect(web.techn).toBe('Java, Spring MVC')
    expect(web.descr).toBe('Delivers static content')
    expect(web.boundary).toBe('c1')

    // Element declared outside the boundary has no boundary.
    expect(d.elements.find(e => e.alias === 'customer')!.boundary).toBeUndefined()
  })
})
