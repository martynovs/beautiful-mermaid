import type { Journey, JourneySection, JourneyTask } from './types.ts'

// ============================================================================
// User journey parser
//
// Parses Mermaid `journey` syntax into a typed Journey structure.
//
// Supported directives (lines arrive trimmed + comment-stripped):
//   journey
//   title <text>
//   section <name>
//   <Task name> : <score 1-5> : <Actor1>, <Actor2>, ...
//
// Tasks group under the most recent `section`. Tasks that appear before any
// section are collected into an implicit unnamed section so nothing is lost.
// ============================================================================

/**
 * Parse a Mermaid journey from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parseJourney(lines: string[]): Journey {
  const journey: Journey = { sections: [] }
  let current: JourneySection | null = null

  for (const line of lines) {
    // Skip the `journey` header line (with or without trailing text).
    if (/^journey\b/i.test(line)) continue

    // Title directive
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      journey.title = titleMatch[1]!.trim()
      continue
    }

    // Section directive — opens a new group
    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      current = { name: sectionMatch[1]!.trim(), tasks: [] }
      journey.sections.push(current)
      continue
    }

    // Task row
    const task = parseTask(line)
    if (task) {
      if (!current) {
        // Tasks before any section land in an implicit unnamed section.
        current = { name: '', tasks: [] }
        journey.sections.push(current)
      }
      current.tasks.push(task)
    }
  }

  return journey
}

/**
 * Parse a task row `Task name : score : Actor1, Actor2`.
 * The actor list is optional. Returns null if it doesn't match.
 */
function parseTask(line: string): JourneyTask | null {
  // Split on colons: first field = name, second = score, rest = actors.
  const parts = line.split(':')
  if (parts.length < 2) return null

  const name = parts[0]!.trim()
  const score = parseInt(parts[1]!.trim(), 10)
  if (!name || !Number.isFinite(score)) return null

  const actorsRaw = parts.slice(2).join(':').trim()
  const actors = actorsRaw
    ? actorsRaw.split(',').map(a => a.trim()).filter(a => a.length > 0)
    : []

  return { name, score: clampScore(score), actors }
}

function clampScore(score: number): number {
  return Math.max(1, Math.min(5, score))
}
