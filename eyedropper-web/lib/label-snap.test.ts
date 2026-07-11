// lib/label-snap.test.ts
import { describe, it, expect } from "vitest"
import { computeLabelSnap, type LabelBox } from "./label-snap"

const THR = 8
// Far-away marker so it never interferes unless a test places it deliberately.
const FAR = { x: 9999, y: 9999 }

function box(x: number, y: number, width = 40, height = 16): LabelBox {
  return { x, y, width, height }
}

describe("computeLabelSnap", () => {
  it("snaps left edge to another label's left edge and emits an x guide", () => {
    const other = box(100, 500)
    // dragged left edge at 104 → within 8px of other.left=100.
    const r = computeLabelSnap({ box: box(104, 500), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)
    expect(r.guides).toContainEqual({ axis: "x", pos: 100 })
  })

  it("snaps right edge to another label's right edge (origin back-computed)", () => {
    // other right edge = 100 + 40 = 140. Dragged box is WIDE (100) so only its
    // right edge falls near the 100/120/140 cluster: left=40, center=90, right=140.
    // right lands exactly on 140 (closest) → origin back-computed to x = 140-100 = 40.
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(40, 560, 100), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(40)
    expect(r.guides).toContainEqual({ axis: "x", pos: 140 })
  })

  it("snaps centers on both axes and emits both guides", () => {
    // other center x = 100+20 = 120, middle y = 500+8 = 508. Dragged box is large
    // (100×40) so only its center/middle land near those lines; left/right/top/bottom
    // stay >threshold away. center x → 120 (x = 120-50 = 70), middle y → 508 (y = 508-20 = 488).
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(70, 488, 100, 40), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(70)
    expect(r.y).toBe(488)
    expect(r.guides).toContainEqual({ axis: "x", pos: 120 })
    expect(r.guides).toContainEqual({ axis: "y", pos: 508 })
  })

  it("snaps to the label's own marker on each axis", () => {
    // marker at (300, 400). dragged left edge near 300 (x=304) → x snaps so left=300.
    // dragged top near 400 (y=403) → y snaps so top=400.
    const r = computeLabelSnap({
      box: box(304, 403), others: [], marker: { x: 300, y: 400 }, threshold: THR,
    })
    expect(r.x).toBe(300)
    expect(r.y).toBe(400)
    expect(r.guides).toContainEqual({ axis: "x", pos: 300 })
    expect(r.guides).toContainEqual({ axis: "y", pos: 400 })
  })

  it("does not snap when outside the threshold band; no guides", () => {
    // Dragged left/center/right = 200/220/240 (all >8 from other's 100/120/140)
    // and top/middle/bottom = 560/568/576 (all >8 from other's 500/508/516).
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(200, 560), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(200)
    expect(r.y).toBe(560)
    expect(r.guides).toEqual([])
  })

  it("resolves axes independently (x snaps, y free)", () => {
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(103, 800), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)      // left→left
    expect(r.y).toBe(800)      // untouched
    expect(r.guides).toEqual([{ axis: "x", pos: 100 }])
  })
})
