import type { Gantt, GanttSection, GanttTask, GanttStatus } from './types.ts'

// ============================================================================
// Gantt chart parser
//
// Parses a practical subset of Mermaid `gantt` syntax into a typed Gantt.
//
// Supported directives:
//   gantt
//   title <text>
//   dateFormat YYYY-MM-DD
//   section <name>
//   <Task name> : [status,]* [id,] <start>, <duration|end>
//
// where <start> is an absolute date `YYYY-MM-DD` or `after <taskId>`, and the
// final field is a duration (`5d`, `2w`, or a bare number of days) or an end
// date. Each task's start/end is computed as a day index relative to the
// earliest date in the chart; `after X` starts when task X ends.
// ============================================================================

const DEFAULT_SECTION = 'Default'
const STATUS_KEYWORDS: GanttStatus[] = ['done', 'active', 'crit', 'milestone']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parse a Mermaid gantt chart from preprocessed lines.
 * Lines should already be trimmed and comment-stripped; the `gantt` header is
 * skipped here if present.
 */
export function parseGantt(lines: string[]): Gantt {
  const chart: Gantt = { sections: [], tasks: [] }

  // Intermediate task records carrying absolute day numbers before we shift
  // everything to be relative to the earliest date.
  interface Raw {
    task: GanttTask
    /** Absolute start day-number (epoch days), or null if it must follow prev. */
    absStart: number | null
    /** `after <id>` dependency target, if the start is relative. */
    after?: string
    durationDays: number
  }

  const raws: Raw[] = []
  const byId = new Map<string, Raw>()
  const usedIds = new Set<string>()
  let currentSection: string | null = null

  for (const line of lines) {
    if (/^gantt\b/i.test(line)) continue

    const dateFmt = line.match(/^dateformat\s+(.+)$/i)
    if (dateFmt) {
      chart.dateFormat = dateFmt[1]!.trim()
      continue
    }

    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      chart.title = titleMatch[1]!.trim()
      continue
    }

    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.trim()
      continue
    }

    // Skip directives we don't model (axisFormat, excludes, tickInterval, …).
    if (/^(axisformat|excludes|includes|todaymarker|tickinterval|weekday)\b/i.test(line)) {
      continue
    }

    const raw = parseTaskLine(line, currentSection ?? DEFAULT_SECTION, usedIds)
    if (raw) {
      raws.push(raw)
      if (raw.task.taskId) byId.set(raw.task.taskId, raw)
    }
  }

  // ---- Resolve absolute start/end day-numbers in source order ----
  let prevEnd: number | null = null
  for (const raw of raws) {
    let start: number
    if (raw.after) {
      const dep = byId.get(raw.after)
      start = dep ? (dep as ResolvedRaw)._end ?? 0 : prevEnd ?? 0
    } else if (raw.absStart !== null) {
      start = raw.absStart
    } else {
      start = prevEnd ?? 0
    }
    const end = start + raw.durationDays
    ;(raw as ResolvedRaw)._start = start
    ;(raw as ResolvedRaw)._end = end
    prevEnd = end
  }

  // ---- Shift to day indices relative to the earliest start ----
  const starts = raws.map(r => (r as ResolvedRaw)._start!)
  const minDay = starts.length ? Math.min(...starts) : 0
  if (Number.isFinite(minDay) && raws.some(r => r.absStart !== null)) {
    chart.startDate = dayNumberToISO(minDay)
  }

  // Build sections in first-seen order.
  const sectionMap = new Map<string, GanttSection>()
  const order: string[] = []
  for (const raw of raws) {
    const s = raw.task.section
    if (!sectionMap.has(s)) {
      sectionMap.set(s, { name: s, tasks: [] })
      order.push(s)
    }
    const t = raw.task
    t.startDay = (raw as ResolvedRaw)._start! - minDay
    t.endDay = (raw as ResolvedRaw)._end! - minDay
    sectionMap.get(s)!.tasks.push(t)
    chart.tasks.push(t)
  }
  chart.sections = order.map(s => sectionMap.get(s)!)

  return chart
}

interface ResolvedRaw {
  _start?: number
  _end?: number
}

/** Parse a single `<name> : <metadata>` task line. Returns null on no match. */
function parseTaskLine(
  line: string,
  section: string,
  usedIds: Set<string>,
): {
  task: GanttTask
  absStart: number | null
  after?: string
  durationDays: number
} | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const name = line.slice(0, colon).trim()
  const meta = line.slice(colon + 1).trim()
  if (!name || !meta) return null

  const fields = meta.split(',').map(f => f.trim()).filter(f => f.length > 0)
  if (fields.length === 0) return null

  // 1. Leading status keywords.
  const tags: GanttStatus[] = []
  let i = 0
  while (i < fields.length) {
    const kw = fields[i]!.toLowerCase() as GanttStatus
    if (STATUS_KEYWORDS.includes(kw)) {
      tags.push(kw)
      i++
    } else break
  }

  const rest = fields.slice(i)
  if (rest.length === 0) return null

  let taskId: string | undefined
  let startField: string | undefined
  let endField: string | undefined

  if (rest.length >= 3) {
    // [id, start, end]
    taskId = rest[0]
    startField = rest[1]
    endField = rest[2]
  } else if (rest.length === 2) {
    // [start, end] or [id, end] — first is a start iff it's a date or `after`.
    if (isStartField(rest[0]!)) {
      startField = rest[0]
      endField = rest[1]
    } else {
      taskId = rest[0]
      endField = rest[1]
    }
  } else {
    // [end] — duration only, implicit start (after previous task).
    endField = rest[0]
  }

  const milestone = tags.includes('milestone')

  // Resolve start.
  let absStart: number | null = null
  let after: string | undefined
  if (startField) {
    const afterMatch = startField.match(/^after\s+(\S+)$/i)
    if (afterMatch) {
      after = afterMatch[1]
    } else if (DATE_RE.test(startField)) {
      absStart = isoToDayNumber(startField)
    }
  }

  // Resolve duration (end field): a duration like `5d`, a bare number of days,
  // or an absolute end date.
  let durationDays = 0
  if (endField) {
    if (DATE_RE.test(endField)) {
      // End date — duration is the span from start to end.
      const endDay = isoToDayNumber(endField)
      if (absStart !== null) durationDays = Math.max(0, endDay - absStart)
      else durationDays = 1
    } else {
      durationDays = parseDuration(endField)
    }
  }
  if (milestone) durationDays = 0

  // Identity: explicit id, else a disambiguated slug of the name.
  const id = uniqueId(taskId ?? slug(name), usedIds)
  usedIds.add(id)

  const task: GanttTask = {
    id,
    taskId,
    name,
    section,
    tags,
    milestone,
    startDay: 0,
    endDay: 0,
    durationDays,
  }

  return { task, absStart, after, durationDays }
}

/** Whether a metadata field denotes a start (absolute date or `after X`). */
function isStartField(field: string): boolean {
  return DATE_RE.test(field) || /^after\s+\S+/i.test(field)
}

/** Parse a duration like `5d`, `2w`, `1.5d`, `3M`, `1y`, or a bare number (days). */
function parseDuration(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([dwmy])?$/i)
  if (!m) return 0
  const n = parseFloat(m[1]!)
  if (!Number.isFinite(n)) return 0
  const unit = m[2]
  switch (unit) {
    case 'w': case 'W': return n * 7
    case 'M': return n * 30
    case 'y': case 'Y': return n * 365
    case 'd': case 'D': default: return n
  }
}

// ----------------------------------------------------------------------------
// Date helpers — model dates as integer day-numbers (epoch days, UTC).
// ----------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000

function isoToDayNumber(iso: string): number {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number]
  return Math.round(Date.UTC(y, mo - 1, d) / MS_PER_DAY)
}

function dayNumberToISO(day: number): string {
  const dt = new Date(day * MS_PER_DAY)
  const y = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

/** Add `n` days to an ISO date, returning a new ISO date. */
export function addDaysISO(iso: string, n: number): string {
  return dayNumberToISO(isoToDayNumber(iso) + n)
}

// ----------------------------------------------------------------------------
// Identity helpers
// ----------------------------------------------------------------------------

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'task'
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
