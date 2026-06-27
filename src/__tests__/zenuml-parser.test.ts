/**
 * Tests for the ZenUML parser (§5.1 — optional sequence-family type).
 *
 * Covers: header skipping, participant declarations (alias / annotator / bare),
 * explicit arrow messages, method-call messages, nested call blocks (flattened),
 * returns, and participant inference + ordered messages.
 */
import { describe, it, expect } from 'bun:test'
import { parseZenUML } from '../zenuml/parser.ts'

/** Preprocess text the same way index.ts does, then parse. */
function parse(src: string) {
  const lines = src
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('%%'))
  return parseZenUML(lines)
}

// ============================================================================
// Participants
// ============================================================================

describe('parseZenUML – participants', () => {
  it('parses participant declarations with aliases', () => {
    const d = parse(`zenuml
      participant A as Alice
      participant B as Bob
      A->B: Hello`)
    expect(d.participants).toHaveLength(2)
    expect(d.participants[0]!.id).toBe('A')
    expect(d.participants[0]!.label).toBe('Alice')
  })

  it('parses annotator declarations (@Actor User)', () => {
    const d = parse(`zenuml
      @Actor User
      @Database DB
      User->DB: query`)
    expect(d.participants[0]!.id).toBe('User')
    expect(d.participants[0]!.annotator).toBe('Actor')
    expect(d.participants[1]!.annotator).toBe('Database')
  })

  it('parses bare participant names', () => {
    const d = parse(`zenuml
      Database
      Service
      Service->Database: read`)
    expect(d.participants.map(p => p.id)).toEqual(['Database', 'Service'])
  })

  it('infers participants from messages in order', () => {
    const d = parse(`zenuml
      A->B: first
      B->C: second`)
    expect(d.participants.map(p => p.id)).toEqual(['A', 'B', 'C'])
    expect(d.participants[0]!.label).toBe('A')
  })

  it('does not duplicate declared participants used in messages', () => {
    const d = parse(`zenuml
      participant A as Alice
      A->B: Hello
      B->A: Hi`)
    expect(d.participants).toHaveLength(2)
    expect(d.participants[0]!.label).toBe('Alice')
  })
})

// ============================================================================
// Messages
// ============================================================================

describe('parseZenUML – messages', () => {
  it('parses explicit arrow messages in order', () => {
    const d = parse(`zenuml
      A->B: First
      B->C: Second
      C->A: Third`)
    expect(d.messages).toHaveLength(3)
    expect(d.messages.map(m => m.label)).toEqual(['First', 'Second', 'Third'])
    expect(d.messages[0]!.from).toBe('A')
    expect(d.messages[0]!.to).toBe('B')
    expect(d.messages[0]!.kind).toBe('sync')
  })

  it('parses dashed arrow messages', () => {
    const d = parse(`zenuml
      A-->B: async`)
    expect(d.messages[0]!.lineStyle).toBe('dashed')
  })

  it('parses method-call form: receiver is the target', () => {
    // Root context sender is the first participant (Client).
    const d = parse(`zenuml
      Client
      Server
      Server.handle()`)
    const m = d.messages[0]!
    expect(m.to).toBe('Server')
    expect(m.from).toBe('Client')
    expect(m.label).toBe('handle()')
  })

  it('nests call blocks, capturing messages in order', () => {
    const d = parse(`zenuml
      Client
      Service.process() {
        Repo.load()
        return data
      }`)
    // 1: Client -> Service.process()
    expect(d.messages[0]!.from).toBe('Client')
    expect(d.messages[0]!.to).toBe('Service')
    // 2: Service -> Repo.load() (sender is the nested-block receiver)
    expect(d.messages[1]!.from).toBe('Service')
    expect(d.messages[1]!.to).toBe('Repo')
    // 3: implicit return from the leaf call Repo.load() back to Service
    expect(d.messages[2]!.kind).toBe('return')
    expect(d.messages[2]!.from).toBe('Repo')
    expect(d.messages[2]!.to).toBe('Service')
    // 4: explicit `return data` -> back to the caller (Client)
    expect(d.messages[3]!.kind).toBe('return')
    expect(d.messages[3]!.from).toBe('Service')
    expect(d.messages[3]!.to).toBe('Client')
    expect(d.messages[3]!.label).toBe('data')
  })

  it('parses @return form', () => {
    const d = parse(`zenuml
      A->B: go
      B.work() {
        @return done
      }`)
    const ret = d.messages.find(m => m.kind === 'return' && m.label === 'done')!
    expect(ret).toBeDefined()
    expect(ret.label).toBe('done')
  })
})

// ============================================================================
// Returns (explicit + implicit)
// ============================================================================

describe('parseZenUML – returns', () => {
  it('emits an implicit dashed/open return for a leaf method call', () => {
    const d = parse(`zenuml
      Client
      Server.handle()`)
    const ret = d.messages.find(m => m.kind === 'return')!
    expect(ret).toBeDefined()
    expect(ret.from).toBe('Server')
    expect(ret.to).toBe('Client')
    expect(ret.lineStyle).toBe('dashed')
    expect(ret.arrowHead).toBe('open')
  })

  it('draws a return back from each callee to its caller (login flow)', () => {
    const d = parse(`zenuml
      @Actor User
      @Boundary LoginPage
      @Control AuthService
      @Database UserDB
      User->LoginPage: enter credentials
      LoginPage.authenticate(user, pass) {
        AuthService.validate() {
          UserDB.findUser()
          return record
        }
        return token
      }
      LoginPage->User: show dashboard`)

    const returns = d.messages.filter(m => m.kind === 'return')
    // Implicit return for UserDB.findUser() back to AuthService.
    expect(returns.some(m => m.from === 'UserDB' && m.to === 'AuthService')).toBe(true)
    // Explicit `return record` back to LoginPage.
    expect(returns.some(m => m.from === 'AuthService' && m.to === 'LoginPage' && m.label === 'record')).toBe(true)
    // Explicit `return token` back to its caller.
    expect(returns.some(m => m.from === 'LoginPage' && m.label === 'token')).toBe(true)
    // Every return is dashed with an open arrow head.
    expect(returns.every(m => m.lineStyle === 'dashed' && m.arrowHead === 'open')).toBe(true)
    // An explicit return suppresses the implicit one (no duplicate AuthService->LoginPage).
    expect(returns.filter(m => m.from === 'AuthService' && m.to === 'LoginPage')).toHaveLength(1)
  })
})

// ============================================================================
// Control-flow fragments
// ============================================================================

describe('parseZenUML – fragments', () => {
  it('produces an alt fragment with an else divider', () => {
    const d = parse(`zenuml
      A->B: req
      if (ok) {
        B->A: yes
      } else {
        B->A: no
      }`)
    expect(d.messages.map(m => m.label)).toEqual(['req', 'yes', 'no'])
    expect(d.fragments).toHaveLength(1)
    const frag = d.fragments[0]!
    expect(frag.type).toBe('alt')
    expect(frag.label).toBe('ok')
    // Wraps the `yes`/`no` messages (indices 1..2).
    expect(frag.startIndex).toBe(1)
    expect(frag.endIndex).toBe(3)
    expect(frag.sections).toHaveLength(1)
    expect(frag.sections[0]!.keyword).toBe('else')
    expect(frag.sections[0]!.index).toBe(2)
  })

  it('maps loop/while/for keywords to a loop fragment', () => {
    const d = parse(`zenuml
      loop (3 times) {
        A->B: ping
      }`)
    expect(d.fragments[0]!.type).toBe('loop')
    expect(d.fragments[0]!.label).toBe('3 times')
  })

  it('supports nested fragments with increasing depth', () => {
    const d = parse(`zenuml
      loop (items) {
        opt (valid) {
          A->B: process
        }
      }`)
    expect(d.fragments).toHaveLength(2)
    const loop = d.fragments.find(f => f.type === 'loop')!
    const opt = d.fragments.find(f => f.type === 'opt')!
    expect(loop.depth).toBe(0)
    expect(opt.depth).toBe(1)
  })

  it('records try/catch/finally sections', () => {
    const d = parse(`zenuml
      try {
        A->B: risky
      } catch (e) {
        B->A: error
      } finally {
        B->A: cleanup
      }`)
    const frag = d.fragments[0]!
    expect(frag.type).toBe('try')
    expect(frag.sections.map(s => s.keyword)).toEqual(['catch', 'finally'])
  })
})
