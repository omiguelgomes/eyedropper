import type { EyedropperPoint } from "./types"

export type Side = "left" | "right" | "top" | "bottom"

// A full-canvas alignment guide line: vertical at `x = pos` for axis "x",
// horizontal at `y = pos` for axis "y". Emitted by computeSwatchSnap while a
// free swatch is dragged into alignment; rendered by SnapGuideLayer.
export type SnapGuide = { axis: "x" | "y"; pos: number }

// An equal-interval distribution cue (Story 5.3): drawn while a free swatch is
// dragged into an evenly-spaced column/row, marking every consecutive equal gap
// in the maximal aligned chain that includes the dragged swatch.
//
// Axis convention (the single trickiest naming choice — locked here, mirrored in
// computeEqualIntervalChain, the renderer, and the tests): `axis` is the axis the
// measure runs ALONG (the axis we measure gaps along).
//   - A vertical column shares one X; its gaps run vertically → axis: "y",
//     alignPos = the shared X.
//   - A horizontal row shares one Y; its gaps run horizontally → axis: "x",
//     alignPos = the shared Y.
// `marks` is the sorted list of swatch-center coords ALONG `axis`, so each
// consecutive pair in `marks` is one equal gap. Ephemeral React state, never
// persisted (same lifecycle as SnapGuide).
export type DistributionGuide = { axis: "x" | "y"; alignPos: number; marks: number[] }

// Given the dragged swatch's raw coord on one axis and the coords on that SAME
// axis of the swatches it is aligned with (already filtered to those sharing the
// perpendicular coordinate within threshold — AC6), decide whether the swatch is
// within `threshold` of the equal-interval position between its nearest
// neighbours. If so, return that snap target plus the maximal run of consecutive
// equal gaps that includes the dragged swatch's two new gaps (growing outward
// past the immediate neighbours while the shared interval holds — the N>3
// generalisation Story 5.2 deferred). Pure; called once per axis per frame.
export function computeEqualIntervalChain(input: {
  raw: number
  alignedCoords: number[]
  threshold: number
}): { snap: number; marks: number[] } | null {
  const { raw, alignedCoords, threshold } = input

  // Nearest aligned neighbour below `raw` (lo) and above (hi). Need one on each
  // side to be "in the middle" of an interval.
  let lo = -Infinity
  let hi = Infinity
  for (const c of alignedCoords) {
    if (c < raw && c > lo) lo = c
    if (c > raw && c < hi) hi = c
  }
  if (lo === -Infinity || hi === Infinity) return null

  // Equal-interval target: dragged swatch centred between its immediate
  // neighbours (same midpoint Story 5.2 used). Soft-snap band check.
  const target = (lo + hi) / 2
  if (Math.abs(raw - target) > threshold) return null

  // The gap the dragged swatch creates on each side; the chain grows outward
  // only while neighbours beyond lo/hi share this same interval.
  const gap = (hi - lo) / 2
  // Tolerance for "same interval": a small fraction of threshold. Real chains are
  // near-exact because the neighbours were themselves snapped; this only absorbs
  // sub-pixel float error, never a deliberately-unequal gap (AC3).
  const tol = threshold / 4

  const sorted = [...alignedCoords].sort((a, b) => a - b)
  const marks = [lo, target, hi]

  // Grow upward: include each next neighbour above the current top mark while its
  // gap to that mark equals the chain interval; stop at the first unequal gap.
  let top = hi
  for (const c of sorted) {
    if (c <= top) continue
    if (Math.abs(c - top - gap) <= tol) {
      marks.push(c)
      top = c
    } else {
      break
    }
  }

  // Grow downward: symmetric, walking neighbours below lo from the inside out.
  let bottom = lo
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i]
    if (c >= bottom) continue
    if (Math.abs(bottom - c - gap) <= tol) {
      marks.unshift(c)
      bottom = c
    } else {
      break
    }
  }

  return { snap: target, marks }
}

// CAD-style soft alignment snapping for a freely-dragged swatch (Story 5.2).
// Pure function of the RAW (already-clamped) cursor position each frame: when a
// coord is within `threshold` of a target it returns the target; once the raw
// coord leaves the band it returns the raw coord (soft snap — no sticky state,
// no modifier key, AC5). The two axes are resolved INDEPENDENTLY, so a swatch
// can X-snap to one target and Y-snap to a different one in the same call.
//
// Per-axis priority (first match within threshold wins, stop scanning):
//   (a) another swatch's center coord       → AC1
//   (b) the dragged swatch's own marker      → AC4
//   (c) frame: centerline + clamped edges    → AC3
//   (d) equal-spacing chain of neighbours    → AC2 / Story 5.3
// Equal-spacing stays the LOWEST priority for deciding the SNAP POSITION: an
// (a)–(c) match on an axis still wins where the swatch lands. But the
// equal-interval chain is ALWAYS computed on both axes, so the distribution cue
// still appears when the swatch is simultaneously equidistant AND aligned to
// another dot (the "tie" case). Each axis whose final position lands on its
// equal-interval target surfaces a DistributionGuide; both axes can fire at once
// (a swatch centred in both a row and a column shows both cues).
export function computeSwatchSnap(input: {
  others: { x: number; y: number }[] // rendered centers of all OTHER swatches
  marker: { x: number; y: number }   // dragged swatch's own marker, canvas space
  x: number                          // raw (clamped) cursor X, canvas space
  y: number                          // raw (clamped) cursor Y, canvas space
  swatchRadius: number
  canvasWidth: number
  canvasHeight: number
  threshold: number                  // canvas-space snap distance
}): { x: number; y: number; guides: SnapGuide[]; distribution: DistributionGuide[] } {
  const { others, marker, x, y, swatchRadius: r, canvasWidth, canvasHeight, threshold } = input

  // Higher-priority candidates only (other-swatch center, own marker, frame).
  // Equal-spacing is handled separately below as the lowest-priority fallback so
  // it can also surface a DistributionGuide.
  const snapHigh = (
    raw: number,
    coords: number[],
    markerCoord: number,
    frame: number[]
  ): number | null => {
    const candidates = [...coords, markerCoord, ...frame]
    for (const c of candidates) {
      if (Math.abs(raw - c) <= threshold) return c
    }
    return null
  }

  let snapX = snapHigh(x, others.map((o) => o.x), marker.x, [
    canvasWidth / 2,
    r,
    canvasWidth - r,
  ])
  let snapY = snapHigh(y, others.map((o) => o.y), marker.y, [
    canvasHeight / 2,
    r,
    canvasHeight - r,
  ])

  // Equal-spacing chains. Computed on BOTH axes ALWAYS — independent of whether a
  // higher-priority snap already claimed the axis — so the equal-distance cue is
  // not suppressed when the swatch is simultaneously equidistant between two
  // neighbours AND aligned to a third dot on the same axis (the "tie" bug). AC6: a
  // chain member must share the dragged swatch's PERPENDICULAR coordinate within
  // threshold — a real horizontal row shares one Y, a real vertical column shares
  // one X. Use the raw perpendicular coord ("where the cursor is this frame"). An
  // X-axis chain is a horizontal row (gaps along X → DistributionGuide.axis "x");
  // a Y-axis chain is a vertical column (axis "y").
  const alignedX = others.filter((o) => Math.abs(o.y - y) <= threshold).map((o) => o.x)
  const chainX = computeEqualIntervalChain({ raw: x, alignedCoords: alignedX, threshold }) // horizontal row
  const alignedY = others.filter((o) => Math.abs(o.x - x) <= threshold).map((o) => o.y)
  const chainY = computeEqualIntervalChain({ raw: y, alignedCoords: alignedY, threshold }) // vertical column

  // Equal-spacing is still the LOWEST-priority SNAP target: it only moves the
  // swatch to the chain midpoint on an axis that found no higher-priority match.
  // (When alignment already claimed the axis, the chain only contributes its cue.)
  if (snapX === null && chainX) snapX = chainX.snap
  if (snapY === null && chainY) snapY = chainY.snap

  // Clamp snapped coords to the swatch-clamped band so a snap target outside
  // [r, dim−r] (e.g. an own-marker near the image edge) can't pull the swatch
  // off-frame mid-drag. Other-swatch and frame candidates are already in-band.
  const clamp = (v: number, dim: number) => Math.max(r, Math.min(dim - r, v))
  const outX = snapX !== null ? clamp(snapX, canvasWidth) : x
  const outY = snapY !== null ? clamp(snapY, canvasHeight) : y

  const guides: SnapGuide[] = []
  if (snapX !== null) guides.push({ axis: "x", pos: outX })
  if (snapY !== null) guides.push({ axis: "y", pos: outY })

  // One equal-distance cue PER AXIS whose chain exists — both can fire at once (a
  // swatch centred in both a row and a column shows both, never just one). The cue
  // is emitted whenever the equal-interval chain exists, INDEPENDENT of whether a
  // higher-priority aligner won the final snap position on that axis: a chain only
  // exists when the raw cursor was within threshold of the midpoint, and any
  // competing snap is itself within threshold of that raw cursor, so the swatch is
  // still equidistant "enough" at the snap tolerance the whole feature runs at.
  // (Gating on the final position exactly equalling the midpoint used to drop the
  // cue on every tie where the competing target wasn't pixel-identical to the
  // midpoint — i.e. nearly always in real dragging.) alignPos is the shared
  // perpendicular coord: the row's Y (outY) / the column's X (outX).
  const distribution: DistributionGuide[] = []
  if (chainX) {
    distribution.push({ axis: "x", alignPos: outY, marks: chainX.marks })
  }
  if (chainY) {
    distribution.push({ axis: "y", alignPos: outX, marks: chainY.marks })
  }

  return { x: outX, y: outY, guides, distribution }
}

// The auto-curve midpoint for a connector: a fixed 40px perpendicular offset
// keyed on the swatch's edge side. Moved here from EyedropperLayer (Story 5.4) so
// computeConnectorGeometry can reuse it and it becomes unit-testable. The math is
// byte-for-byte identical to the previous in-component version (offset 40, same
// per-side sign) so un-bent curved connectors render unchanged.
export function getCurvedMidpoint(
  sx: number, sy: number,
  mx: number, my: number,
  side: string
): [number, number] {
  const cx = (sx + mx) / 2
  const cy = (sy + my) / 2
  const offset = 40
  if (side === "left")   return [cx - offset, cy]
  if (side === "right")  return [cx + offset, cy]
  if (side === "top")    return [cx, cy - offset]
  if (side === "bottom") return [cx, cy + offset]
  return [cx, cy]
}

// Story 5.4: the connector's rendered geometry. Returns the bend-handle position
// and the Konva Line `points` array. When `connectorMid` is null the connector
// looks exactly as it did before this story (straight segment, or the
// getCurvedMidpoint auto-curve for "curved" styles) and the handle sits at that
// default midpoint. Once `connectorMid` is set, the artist has explicitly shaped
// the line: it is ALWAYS drawn as a smooth 3-point curve through that point
// (regardless of the style's connectorType) and the handle sits at connectorMid.
// Pure; called once per point per render.
export function computeConnectorGeometry(input: {
  swatch: { x: number; y: number }   // canvas-space swatch centre
  marker: { x: number; y: number }   // canvas-space marker centre (already +imageOffsetY)
  connectorMid: { x: number; y: number } | null
  connectorType: "curved" | "straight" | "none"
  swatchSide: EyedropperPoint["swatchSide"]  // only used for the curved default
}): { handle: { x: number; y: number }; linePoints: number[]; curved: boolean } {
  const { swatch, marker, connectorMid, connectorType, swatchSide } = input

  // Defensive: callers gate on connectorType !== "none" and never render this
  // branch. Return the straight midpoint as a sensible handle, no line.
  if (connectorType === "none") {
    return {
      handle: { x: (swatch.x + marker.x) / 2, y: (swatch.y + marker.y) / 2 },
      linePoints: [],
      curved: false,
    }
  }

  // Explicitly bent → smooth 3-point curve through the stored bend point.
  if (connectorMid !== null) {
    return {
      handle: connectorMid,
      linePoints: [swatch.x, swatch.y, connectorMid.x, connectorMid.y, marker.x, marker.y],
      curved: true,
    }
  }

  // Un-bent curved default → reproduce today's perpendicular-offset auto-curve.
  if (connectorType === "curved") {
    const [mx, my] = getCurvedMidpoint(swatch.x, swatch.y, marker.x, marker.y, swatchSide)
    return {
      handle: { x: mx, y: my },
      linePoints: [swatch.x, swatch.y, mx, my, marker.x, marker.y],
      curved: true,
    }
  }

  // Un-bent straight default → straight segment (no mid point in the line array);
  // the handle sits at the geometric midpoint but the line is not yet curved.
  return {
    handle: { x: (swatch.x + marker.x) / 2, y: (swatch.y + marker.y) / 2 },
    linePoints: [swatch.x, swatch.y, marker.x, marker.y],
    curved: false,
  }
}

export function assignSwatchLayout(
  points: EyedropperPoint[],
  canvasWidth: number,
  canvasHeight: number,
  imageOffsetY: number = 0
): EyedropperPoint[] {
  if (points.length === 0) return []

  // Free-floating swatches (manually placed) are excluded from edge layout:
  // they keep their absolute (swatchX, swatchY) and do not participate in the
  // per-edge even distribution of the remaining edge swatches.
  const isFree = (p: EyedropperPoint) => p.swatchX !== null && p.swatchY !== null

  // Step 1: Assign sides for "auto" points — only for non-free points.
  const withSides = points.map((p): EyedropperPoint => {
    if (isFree(p) || p.swatchSide !== "auto") return p
    const cx = p.x
    const cy = p.y + imageOffsetY
    const dLeft = cx
    const dRight = canvasWidth - cx
    const dTop = cy
    const dBottom = canvasHeight - cy
    const min = Math.min(dLeft, dRight, dTop, dBottom)
    let side: Side
    if (min === dLeft) side = "left"
    else if (min === dRight) side = "right"
    else if (min === dTop) side = "top"
    else side = "bottom"
    return { ...p, swatchSide: side }
  })

  // Step 2: Group by side — skip free points so they don't skew distribution.
  const groups: Record<Side, EyedropperPoint[]> = { left: [], right: [], top: [], bottom: [] }
  for (const p of withSides) {
    if (isFree(p)) continue
    groups[p.swatchSide as Side].push(p)
  }

  // Step 3: Sort each group by coordinate along the edge (no-crossing guarantee)
  const byCanvasY = (a: EyedropperPoint, b: EyedropperPoint) =>
    (a.y + imageOffsetY) - (b.y + imageOffsetY)
  const byX = (a: EyedropperPoint, b: EyedropperPoint) => a.x - b.x
  groups.left.sort(byCanvasY)
  groups.right.sort(byCanvasY)
  groups.top.sort(byX)
  groups.bottom.sort(byX)

  // Step 4: Evenly distribute along full edge
  const result = new Map<string, EyedropperPoint>()
  for (const [side, group] of Object.entries(groups) as [Side, EyedropperPoint[]][]) {
    const n = group.length
    const L = (side === "left" || side === "right") ? canvasHeight : canvasWidth
    group.forEach((p, i) => {
      result.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
    })
  }

  return points.map(p => result.get(p.id) ?? p)
}

export function redistributeOnEdge(
  points: EyedropperPoint[],
  side: Side,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): EyedropperPoint[] {
  const L = side === "left" || side === "right" ? canvasHeight : canvasWidth
  const onEdge = points.filter(p => p.swatchSide === side && p.swatchOrder !== null)
  const sorted = [...onEdge].sort((a, b) => a.swatchOrder! - b.swatchOrder!)
  const n = sorted.length
  const updated = new Map<string, EyedropperPoint>()
  sorted.forEach((p, i) => {
    updated.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
  })
  return points.map(p => updated.get(p.id) ?? p)
}

// Place a just-dragged swatch: keep its dropped swatchOrder unless it would
// overlap another swatch on the same edge (centers closer than 2*swatchRadius),
// in which case redistribute the whole edge evenly while preserving order.
// `points` must already contain the moved point at its dropped swatchOrder.
export function placeSwatchOnEdge(
  points: EyedropperPoint[],
  id: string,
  side: Side,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): EyedropperPoint[] {
  const moved = points.find(p => p.id === id)
  if (!moved || moved.swatchOrder === null) return points
  const overlaps = points.some(
    p =>
      p.id !== id &&
      p.swatchSide === side &&
      p.swatchOrder !== null &&
      Math.abs(p.swatchOrder - moved.swatchOrder!) < 2 * swatchRadius
  )
  if (!overlaps) return points
  return redistributeOnEdge(points, side, canvasWidth, canvasHeight, swatchRadius)
}

// Resolve overlap for a freely-dragged swatch (Story 5.1, AC4): move ONLY the
// dragged swatch to the nearest position where no two centers are closer than
// 2*swatchRadius. Never moves a neighbour. Relaxation pushes the dragged swatch
// directly away from each overlapping neighbour by the penetration depth, clamps
// to the canvas, and caps iterations. In the common open-canvas case this
// converges in 1–2 iterations to exactly 2r separation; against a dense corner
// cluster it returns the clamped best-effort position (documented edge — we do
// NOT push neighbours, which would violate AC4).
export function resolveSwatchOverlap(
  others: { x: number; y: number }[],
  x: number,
  y: number,
  swatchRadius: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const minDist = 2 * swatchRadius
  const clampX = (v: number) => Math.max(swatchRadius, Math.min(canvasWidth - swatchRadius, v))
  const clampY = (v: number) => Math.max(swatchRadius, Math.min(canvasHeight - swatchRadius, v))

  let px = clampX(x)
  let py = clampY(y)

  for (let iter = 0; iter < 20; iter++) {
    let moved = false
    for (const o of others) {
      const dx = px - o.x
      const dy = py - o.y
      const dist = Math.hypot(dx, dy)
      if (dist < minDist) {
        // Degenerate exact-overlap: pick a deterministic push direction.
        const ux = dist === 0 ? 1 : dx / dist
        const uy = dist === 0 ? 0 : dy / dist
        const push = minDist - dist
        px = clampX(px + ux * push)
        py = clampY(py + uy * push)
        moved = true
      }
    }
    if (!moved) return { x: px, y: py }
  }
  // Could not fully separate within the iteration cap (dense cluster against a
  // corner). Return the clamped best-effort position — never moves a neighbour.
  return { x: px, y: py }
}
