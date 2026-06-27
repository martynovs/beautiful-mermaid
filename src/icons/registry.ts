// ============================================================================
// Shared, type-agnostic icon registry.
//
// One registry of built-in named glyphs, shared across every diagram type that
// declares an icon in its native Mermaid grammar (architecture `service
// id(icon)[label]`, flowchart/block `@{ icon: "<name>" }`, etc.). Renderers
// embed the returned `<g>` fragment inside the owning node's identity group, so
// an icon never changes element identity.
//
// Glyphs are authored on a canonical 24×24 grid and drawn with
// `fill="currentColor"` (outline glyphs use `stroke="currentColor"`), so the
// consuming element controls color through a CSS class / theme variable (e.g.
// `color: var(--_text)`). No hex colors are hardcoded here.
//
// Unknown names degrade gracefully to a plain rounded-square outline and NEVER
// throw, so a stray icon name can never fail an overall render.
// ============================================================================

import type { IconRenderOptions } from './types.ts'

// ----------------------------------------------------------------------------
// Built-in glyph bodies (inner markup of a 24×24 viewBox).
//
// Filled glyphs inherit `fill="currentColor"` from the wrapping <g>.
// Outline glyphs set `fill="none" stroke="currentColor"` explicitly.
// ----------------------------------------------------------------------------

const SW = '1.6' // shared stroke width for outline glyphs
const OUTLINE = `fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"`

const GLYPHS: Record<string, string> = {
  // Filled tab folder.
  folder:
    `<path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4.6l2 2h9.4a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-16A1.5 1.5 0 0 1 3 17.5z"/>`,

  // Outline document with a folded corner.
  file:
    `<path d="M7 2.5h6.5L18 7v13.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" ${OUTLINE}/>` +
    `<path d="M13 2.5V7a1 1 0 0 0 1 1h4.5" ${OUTLINE}/>`,

  // Filled cylinder (database / datastore).
  database:
    `<ellipse cx="12" cy="6" rx="8" ry="3"/>` +
    `<path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/>`,

  // Outline stacked rack units with status LEDs.
  server:
    `<rect x="3" y="4" width="18" height="7" rx="1.5" ${OUTLINE}/>` +
    `<rect x="3" y="13" width="18" height="7" rx="1.5" ${OUTLINE}/>` +
    `<circle cx="7" cy="7.5" r="1"/>` +
    `<circle cx="7" cy="16.5" r="1"/>`,

  // Filled cloud.
  cloud:
    `<path d="M6.5 19a4.5 4.5 0 0 1 0-9 6 6 0 0 1 11.4-1.5A4 4 0 0 1 17.5 19z"/>`,

  // Outline disk platter (storage device).
  disk:
    `<rect x="3" y="5" width="18" height="14" rx="2" ${OUTLINE}/>` +
    `<circle cx="12" cy="12" r="4" ${OUTLINE}/>` +
    `<circle cx="12" cy="12" r="1"/>`,

  // Outline globe (internet / network).
  internet:
    `<circle cx="12" cy="12" r="9" ${OUTLINE}/>` +
    `<path d="M3 12h18" ${OUTLINE}/>` +
    `<path d="M12 3c2.6 2.7 2.6 15.3 0 18" ${OUTLINE}/>` +
    `<path d="M12 3c-2.6 2.7-2.6 15.3 0 18" ${OUTLINE}/>`,

  // Outline stacked messages (queue).
  queue:
    `<rect x="4" y="4" width="16" height="4" rx="1" ${OUTLINE}/>` +
    `<rect x="4" y="10" width="16" height="4" rx="1" ${OUTLINE}/>` +
    `<rect x="4" y="16" width="16" height="4" rx="1" ${OUTLINE}/>`,

  // Outline chip with pins (cpu).
  cpu:
    `<rect x="6" y="6" width="12" height="12" rx="1.5" ${OUTLINE}/>` +
    `<rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/>` +
    `<path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" ${OUTLINE}/>`,

  // Outline rounded square with a question mark (explicit unknown glyph).
  unknown:
    `<rect x="3" y="3" width="18" height="18" rx="3" ${OUTLINE}/>` +
    `<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1-1.5 2v.6" ${OUTLINE}/>` +
    `<circle cx="12" cy="17.3" r="0.95"/>`,
}

// Plain rounded-square outline used when a requested name is not registered.
const FALLBACK_BODY = `<rect x="3" y="3" width="18" height="18" rx="3" ${OUTLINE}/>`

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/** Sorted list of every built-in icon name. */
export const ICON_NAMES: string[] = Object.keys(GLYPHS).sort()

/** True when `name` resolves to a built-in glyph. */
export function hasIcon(name: string): boolean {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(GLYPHS, name)
}

/**
 * Render a named glyph as an inline SVG `<g>` fragment positioned at `(x, y)`
 * and scaled to `size`. The glyph draws with `currentColor`, so the caller
 * controls color via a CSS class / theme variable.
 *
 * Unknown names return a graceful rounded-square fallback and NEVER throw.
 */
export function renderIcon(name: string, opts: IconRenderOptions): string {
  const body = (typeof name === 'string' && GLYPHS[name]) || FALLBACK_BODY

  const x = round(opts.x)
  const y = round(opts.y)
  const scale = round(opts.size / 24)
  const cls = opts.className ? `bm-icon ${opts.className}` : 'bm-icon'

  return (
    `<g class="${cls}" fill="currentColor" ` +
    `transform="translate(${x} ${y}) scale(${scale})">` +
    body +
    `</g>`
  )
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function round(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 1000) / 1000)
}
