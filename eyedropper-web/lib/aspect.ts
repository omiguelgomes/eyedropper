export interface Ratio {
  w: number
  h: number
}

// The preset chips offered in the Aspect picker, in display order. 9:16 is the
// app default (first). Values are the raw ratio terms; the canvas layout only
// ever uses w/h, so 16:9 and 8:4.5 would behave identically.
export const PRESETS: { label: string; w: number; h: number }[] = [
  { label: "9:16", w: 9, h: 16 },
  { label: "4:5", w: 4, h: 5 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3", w: 4, h: 3 },
  { label: "16:9", w: 16, h: 9 },
]

export const DEFAULT_RATIO: Ratio = { w: 9, h: 16 }

// Parse a free-text ratio ("W:H" or "W/H", integers or decimals) into a Ratio,
// or null if the input isn't a valid positive ratio. Whitespace around the terms
// and separator is tolerated. Used by the custom-ratio text field, which shows an
// inline invalid state (and does not apply) when this returns null.
export function parseRatio(input: string): Ratio | null {
  const m = input.trim().match(/^(\d*\.?\d+)\s*[:/]\s*(\d*\.?\d+)$/)
  if (!m) return null
  const w = parseFloat(m[1])
  const h = parseFloat(m[2])
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { w, h }
}

// Whether a ratio matches one of a preset's proportions (w/h), within a small
// tolerance. Used to highlight the active preset chip; a custom ratio that
// happens to equal a preset lights that chip.
export function ratiosEqual(a: Ratio, b: Ratio): boolean {
  return Math.abs(a.w / a.h - b.w / b.h) < 1e-6
}

// A short display label for a ratio: the matching preset's label if it is one,
// else "W:H" with terms trimmed to at most 2 decimals. Used for the export
// button ("Download <label> JPEG").
export function ratioLabel(ratio: Ratio): string {
  const preset = PRESETS.find((p) => ratiosEqual(ratio, p))
  if (preset) return preset.label
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""))
  return `${fmt(ratio.w)}:${fmt(ratio.h)}`
}
