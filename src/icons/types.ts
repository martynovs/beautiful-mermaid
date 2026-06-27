// ============================================================================
// Shared types for the icon-rendering module.
// ============================================================================

/** Placement + sizing options for {@link renderIcon}. */
export interface IconRenderOptions {
  /** Left edge of the icon box, in the caller's SVG coordinate space. */
  x: number
  /** Top edge of the icon box, in the caller's SVG coordinate space. */
  y: number
  /** Edge length of the (square) icon box. Glyphs are drawn on a 24×24 grid and scaled to fit. */
  size: number
  /** Optional extra class(es) added to the wrapping `<g>` (in addition to `bm-icon`). */
  className?: string
}

/**
 * A glyph definition: the inner markup of a 24×24 viewBox, drawn with
 * `fill="currentColor"` so callers control color via CSS/theme variables.
 *
 * The body is a sequence of `<path>`/`<rect>`/`<circle>`/`<line>` elements
 * positioned on the canonical 24-unit grid. It is transformed into the
 * caller's coordinate space by {@link renderIcon}.
 */
export type IconBody = string
