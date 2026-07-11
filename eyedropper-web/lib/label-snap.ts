import type { SnapGuide } from "./swatch-layout"

export type LabelBox = { x: number; y: number; width: number; height: number }

// CAD-style soft snapping for a freely-dragged LABEL (mirrors computeSwatchSnap,
// but a label is a box so its LEFT/CENTER/RIGHT (x) and TOP/MIDDLE/BOTTOM (y)
// edges each snap). Pure function of the raw dragged box each frame: per axis,
// scan every (edge, candidate target) pair and take the CLOSEST one within
// `threshold`; the origin is back-computed so that edge lands on the target.
// Axes resolve independently. Soft snap — no sticky state, no modifier.
//
// Candidates come only from OTHER labels' edges/centers and the label's OWN
// marker (never other markers/swatches) — see the design doc.
export function computeLabelSnap(input: {
  box: LabelBox
  others: LabelBox[]
  marker: { x: number; y: number }
  threshold: number
}): { x: number; y: number; guides: SnapGuide[] } {
  const { box, others, marker, threshold } = input

  // For one axis: `edges` are the dragged box's three lines as offsets from the
  // origin (0 = origin edge, half = center, full = far edge); `targets` are the
  // candidate absolute lines. Returns the new origin + the matched target line
  // for the CLOSEST (edge, target) pair within the band, or null when nothing
  // is close enough. On an exact distance tie the earliest-scanned pair wins
  // (edges near→far, targets in array order) for deterministic snapping.
  const snapAxis = (
    origin: number,
    edges: number[],
    targets: number[]
  ): { origin: number; guide: number } | null => {
    let best: { origin: number; guide: number; dist: number } | null = null
    for (const off of edges) {
      const linePos = origin + off
      for (const t of targets) {
        const dist = Math.abs(linePos - t)
        if (dist <= threshold && (best === null || dist < best.dist)) {
          best = { origin: t - off, guide: t, dist }
        }
      }
    }
    return best ? { origin: best.origin, guide: best.guide } : null
  }

  const xTargets = [
    ...others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width]),
    marker.x,
  ]
  const yTargets = [
    ...others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height]),
    marker.y,
  ]

  const sx = snapAxis(box.x, [0, box.width / 2, box.width], xTargets)
  const sy = snapAxis(box.y, [0, box.height / 2, box.height], yTargets)

  const guides: SnapGuide[] = []
  if (sx) guides.push({ axis: "x", pos: sx.guide })
  if (sy) guides.push({ axis: "y", pos: sy.guide })

  return {
    x: sx ? sx.origin : box.x,
    y: sy ? sy.origin : box.y,
    guides,
  }
}
