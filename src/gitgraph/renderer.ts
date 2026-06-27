import type { PositionedGitGraph, PositionedCommit } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'

// ============================================================================
// Git graph SVG renderer
//
// Renders a positioned git graph to an SVG string. Every color comes from the
// theme CSS custom properties; per-branch hue is derived from the accent via
// getSeriesColor (mirrors the xychart palette) — no hardcoded colors.
//
// Identity contract: each commit is wrapped in
//   <g class="node" data-id="<commit id>">…</g>
// and every branch / merge edge carries data-from (parent id) / data-to (child
// id).
//
// Render order (back to front):
//   1. Edges (branch lines + merge connectors)
//   2. Branch labels
//   3. Commit nodes (each an addressable <g class="node" data-id>)
//   4. Commit id labels + tags
// ============================================================================

const FONT = {
  labelSize: 11,
  labelWeight: 400,
  branchLabelSize: 12,
  branchLabelWeight: 600,
  tagSize: 11,
  tagWeight: 600,
} as const

const NODE_R = 7

/**
 * Render a positioned git graph as an SVG string.
 */
export function renderGitGraphSvg(
  positioned: PositionedGitGraph,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(positioned.width, positioned.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Per-branch color rules — index 0 uses the accent directly.
  const accent = colors.accent ?? CHART_ACCENT_FALLBACK
  const maxColor = Math.max(
    0,
    ...positioned.commits.map(c => c.colorIndex),
    ...positioned.branchLabels.map(b => b.colorIndex),
  )
  const colorRules: string[] = []
  for (let i = 0; i <= maxColor; i++) {
    const color = i === 0
      ? `var(--accent, ${CHART_ACCENT_FALLBACK})`
      : getSeriesColor(i, accent, colors.bg)
    colorRules.push(`  .git-stroke-${i} { stroke: ${color}; }`)
    colorRules.push(`  .git-fill-${i} { fill: ${color}; }`)
  }
  parts.push(styleBlock(colorRules.join('\n')))

  // 1. Edges
  for (const e of positioned.edges) {
    parts.push(
      `<path class="git-edge git-stroke-${e.colorIndex}" ` +
      `data-from="${escapeAttr(e.from)}" data-to="${escapeAttr(e.to)}" d="${e.path}"/>`,
    )
  }

  // 2. Branch labels
  for (const b of positioned.branchLabels) {
    parts.push(
      `<text x="${r(b.x)}" y="${r(b.y)}" text-anchor="start" ` +
      `font-size="${FONT.branchLabelSize}" font-weight="${FONT.branchLabelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="git-branch-label git-fill-${b.colorIndex}">${escapeXml(b.name)}</text>`,
    )
  }

  // 3. Commit nodes — each addressable via <g class="node" data-id="…">
  for (const c of positioned.commits) {
    parts.push(
      `<g class="node" data-id="${escapeAttr(c.id)}">` +
      commitShape(c) +
      `</g>`,
    )
  }

  // 4. Commit id labels + tags
  for (const c of positioned.commits) {
    parts.push(
      `<text x="${r(c.x)}" y="${r(c.y + NODE_R + 14)}" text-anchor="middle" ` +
      `font-size="${FONT.labelSize}" font-weight="${FONT.labelWeight}" ` +
      `dy="${TEXT_BASELINE_SHIFT}" class="git-commit-label">${escapeXml(c.label)}</text>`,
    )
    if (c.tag) {
      parts.push(
        `<text x="${r(c.x)}" y="${r(c.y - NODE_R - 8)}" text-anchor="middle" ` +
        `font-size="${FONT.tagSize}" font-weight="${FONT.tagWeight}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" class="git-tag git-fill-${c.colorIndex}">${escapeXml(c.tag)}</text>`,
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Commit node shapes
// ============================================================================

function commitShape(c: PositionedCommit): string {
  const fill = `git-fill-${c.colorIndex}`
  const stroke = `git-stroke-${c.colorIndex}`

  if (c.type === 'HIGHLIGHT') {
    const w = NODE_R * 2.6
    const h = NODE_R * 2.6
    return (
      `<rect x="${r(c.x - w / 2)}" y="${r(c.y - h / 2)}" width="${r(w)}" height="${r(h)}" ` +
      `rx="2" class="git-commit ${fill}"/>`
    )
  }

  if (c.type === 'REVERSE') {
    const d = NODE_R * 0.62
    return (
      `<circle cx="${r(c.x)}" cy="${r(c.y)}" r="${NODE_R}" class="git-commit ${fill}"/>` +
      `<path d="M${r(c.x - d)},${r(c.y - d)} L${r(c.x + d)},${r(c.y + d)} ` +
      `M${r(c.x + d)},${r(c.y - d)} L${r(c.x - d)},${r(c.y + d)}" class="git-reverse-cross"/>`
    )
  }

  // Merge commits get a hollow ring; normal commits a solid disc.
  if (c.isMerge) {
    return (
      `<circle cx="${r(c.x)}" cy="${r(c.y)}" r="${NODE_R}" class="git-commit ${fill}"/>` +
      `<circle cx="${r(c.x)}" cy="${r(c.y)}" r="${r(NODE_R * 0.45)}" class="git-merge-inner"/>`
    )
  }

  return `<circle cx="${r(c.x)}" cy="${r(c.y)}" r="${NODE_R}" class="git-commit ${fill} ${stroke}"/>`
}

// ============================================================================
// Chart-specific CSS
// ============================================================================

function styleBlock(colorRules: string): string {
  return `<style>
  .git-edge { fill: none; stroke-width: 2.5; }
  .git-commit { stroke: var(--bg); stroke-width: 1.5; }
  .git-merge-inner { fill: var(--bg); }
  .git-reverse-cross { stroke: var(--bg); stroke-width: 1.5; fill: none; }
  .git-commit-label { fill: var(--_text-sec); }
  .git-branch-label { font-weight: 600; }
  .git-tag { fill: var(--_text); }
${colorRules}
</style>`
}

// ============================================================================
// Helpers
// ============================================================================

function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeXml(text).replace(/'/g, '&#39;')
}
