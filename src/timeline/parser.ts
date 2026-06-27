import type { Timeline, TimelineSection, TimelinePeriod } from './types.ts'

// ============================================================================
// Timeline parser
//
// Parses Mermaid `timeline` syntax into a typed Timeline structure.
//
// Supported directives:
//   timeline [title <text>]
//   title <text>
//   section <name>
//   <time period> : <event> [: <event2> ...]    (period → one or more events)
//   : <event> [: <event2> ...]                   (continuation of last period)
//
// Multiple events on a single line are split on `:`. A line that begins with
// `:` appends events to the most recent period (Mermaid's continuation form).
// ============================================================================

/**
 * Parse a Mermaid timeline from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseTimeline(lines: string[]): Timeline {
  const timeline: Timeline = { sections: [] }
  let currentSection: TimelineSection | null = null
  let lastPeriod: TimelinePeriod | null = null

  /** Lazily create the implicit default section for ungrouped periods. */
  const ensureSection = (): TimelineSection => {
    if (!currentSection) {
      currentSection = { periods: [] }
      timeline.sections.push(currentSection)
    }
    return currentSection
  }

  for (const line of lines) {
    // Header: `timeline`, optionally with `title <text>`
    const header = line.match(/^timeline\b(.*)$/i)
    if (header) {
      const t = header[1]!.trim().match(/^title\s+(.+)$/i)
      if (t) timeline.title = t[1]!.trim()
      continue
    }

    // Standalone title line
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      timeline.title = titleMatch[1]!.trim()
      continue
    }

    // Section grouping
    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      currentSection = { name: sectionMatch[1]!.trim(), periods: [] }
      timeline.sections.push(currentSection)
      lastPeriod = null
      continue
    }

    // Continuation: `: event [: event2]` appends to the last period
    if (line.startsWith(':')) {
      const events = splitEvents(line.slice(1))
      if (lastPeriod && events.length) lastPeriod.events.push(...events)
      continue
    }

    // Period row: `<period> : <event> [: ...]`
    const colon = line.indexOf(':')
    if (colon !== -1) {
      const label = line.slice(0, colon).trim()
      if (!label) continue
      const period: TimelinePeriod = { label, events: splitEvents(line.slice(colon + 1)) }
      ensureSection().periods.push(period)
      lastPeriod = period
      continue
    }

    // Bare period with no events yet
    const bare = line.trim()
    if (bare) {
      const period: TimelinePeriod = { label: bare, events: [] }
      ensureSection().periods.push(period)
      lastPeriod = period
    }
  }

  return timeline
}

/** Split the event portion of a line on `:`, trimming and dropping blanks. */
function splitEvents(s: string): string[] {
  return s.split(':').map(e => e.trim()).filter(e => e.length > 0)
}
