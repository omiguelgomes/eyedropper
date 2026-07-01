import { describe, it, expect } from "vitest"
import { assignSwatchLayout, redistributeOnEdge, placeSwatchOnEdge, resolveSwatchOverlap, computeSwatchSnap, computeEqualIntervalChain } from "./swatch-layout"
import type { EyedropperPoint } from "./types"

function makePoint(
  id: string,
  x: number,
  y: number,
  swatchSide: EyedropperPoint["swatchSide"] = "auto",
  swatchOrder: number | null = null,
  swatchX: number | null = null,
  swatchY: number | null = null
): EyedropperPoint {
  return {
    id,
    x,
    y,
    color: "#888888",
    swatchSide,
    swatchOrder,
    swatchX,
    swatchY,
    label: { text: "", visible: true, x, y, fontSize: 16, fontFamily: "serif", color: "#000" },
  }
}

const W = 400
const H = 800

describe("assignSwatchLayout", () => {
  it("empty array → returns empty array", () => {
    expect(assignSwatchLayout([], W, H)).toEqual([])
  })

  it("single point assigned to nearest edge — swatchOrder = round(L / 2)", () => {
    // Point near left edge: x=10, y=400 → dLeft=10 wins
    const point = makePoint("p1", 10, 400)
    const result = assignSwatchLayout([point], W, H)
    expect(result[0].swatchSide).toBe("left")
    // n=1, i=0: round(H * 1 / 2) = round(800/2) = 400
    expect(result[0].swatchOrder).toBe(400)
  })

  it("two points on same edge sorted by coordinate, orders = round(L/3) and round(2L/3)", () => {
    // Both near left edge (x=5)
    const p1 = makePoint("p1", 5, 200)
    const p2 = makePoint("p2", 5, 600)
    const result = assignSwatchLayout([p1, p2], W, H)
    expect(result[0].swatchSide).toBe("left")
    expect(result[1].swatchSide).toBe("left")
    // Sorted by y: p1(200) < p2(600)
    // n=2: i=0 → round(800*1/3)=267, i=1 → round(800*2/3)=533
    const orders = result.map(p => p.swatchOrder).sort((a, b) => a! - b!)
    expect(orders[0]).toBe(Math.round(H * 1 / 3))
    expect(orders[1]).toBe(Math.round(H * 2 / 3))
  })

  it("tie-breaking: left wins over right when distLeft === distRight", () => {
    // x = canvasWidth / 2 = 200, far from top/bottom
    const point = makePoint("p1", 200, 400) // equidistant left/right, equidistant top/bottom
    const result = assignSwatchLayout([point], W, H)
    // distLeft = 200, distRight = 200, distTop = 400, distBottom = 400
    // left wins (first if in chain)
    expect(result[0].swatchSide).toBe("left")
  })

  it("tie-breaking: top wins over bottom when distTop === distBottom", () => {
    // y = canvasHeight / 2 = 400, but x is close to center so left/right are not minimum
    // Use a point where top and bottom are equal and smallest: y=400, x=200 → all equal → left wins
    // To test top vs bottom specifically: make x near edge so left < top; but use y=400 (equal top/bottom)
    // Actually test: point at (200, 400) → distLeft=200=distRight=200, distTop=400=distBottom=400 → left wins (tested above)
    // For top vs bottom: point at (200, 400) on a 400×800 canvas isn't useful since left wins
    // Use a wider canvas so left/right distances are larger than top/bottom
    const W2 = 1000
    const H2 = 100
    // point at (500, 50): distLeft=500, distRight=500, distTop=50, distBottom=50 → tie between top and bottom
    const point = makePoint("p1", 500, 50)
    const result = assignSwatchLayout([point], W2, H2)
    // top wins (second elif in chain only if left didn't win; here left=500 is not min, right=500 not min, top=50=bottom → top wins)
    expect(result[0].swatchSide).toBe("top")
  })

  it("manual swatchSide !== 'auto' is respected — stays on specified side", () => {
    // Point near left edge (x=5), but forced to right
    const point = makePoint("p1", 5, 400, "right")
    const result = assignSwatchLayout([point], W, H)
    expect(result[0].swatchSide).toBe("right")
  })

  it("imageOffsetY shifts canvas-y correctly", () => {
    // Point at y=0 in image space; with imageOffsetY=200, canvas y = 200 → near top
    const point = makePoint("p1", 200, 0) // x=200 equidistant left/right
    // Without offset: distTop=0 wins → top
    // With offset 200: canvas cy = 200, distTop=200, distLeft=200 → tie → left wins
    const resultNoOffset = assignSwatchLayout([point], W, H, 0)
    expect(resultNoOffset[0].swatchSide).toBe("top")

    // With a small offset: canvas cy=50, x=200 → distLeft=200, distTop=50 → top wins
    const result = assignSwatchLayout([makePoint("p2", 200, 0)], W, H, 50)
    expect(result[0].swatchSide).toBe("top")

    // With large offset and close to left: point at x=5, y=100, imageOffsetY=200
    // canvas cx=5, canvas cy=300 → distLeft=5 wins
    const result2 = assignSwatchLayout([makePoint("p3", 5, 100)], W, H, 200)
    expect(result2[0].swatchSide).toBe("left")
  })

  it("output array length and point ids match input", () => {
    const points = [
      makePoint("a", 10, 100),
      makePoint("b", 200, 10),
      makePoint("c", 390, 400),
      makePoint("d", 200, 790),
    ]
    const result = assignSwatchLayout(points, W, H)
    expect(result).toHaveLength(points.length)
    expect(result.map(p => p.id)).toEqual(points.map(p => p.id))
  })

  it("all points get non-null swatchOrder after layout", () => {
    const points = [
      makePoint("a", 10, 100),
      makePoint("b", 200, 10),
      makePoint("c", 390, 400),
    ]
    const result = assignSwatchLayout(points, W, H)
    expect(result.every(p => p.swatchOrder !== null)).toBe(true)
  })
})

describe("redistributeOnEdge", () => {
  const canvasWidth = 400, canvasHeight = 800, swatchRadius = 20

  it("redistributes 2 swatches on left edge evenly", () => {
    const points = [
      makePoint("a", 0, 0, "left", 600),
      makePoint("b", 0, 0, "left", 100),
    ]
    const result = redistributeOnEdge(points, "left", canvasWidth, canvasHeight, swatchRadius)
    // sorted by swatchOrder: b(100), a(600) → indices 0, 1 of 2
    // L=800, n=2: positions = 800*1/3=267, 800*2/3=533
    const b = result.find(p => p.id === "b")!
    const a = result.find(p => p.id === "a")!
    expect(b.swatchOrder).toBe(Math.round(800 / 3))
    expect(a.swatchOrder).toBe(Math.round(800 * 2 / 3))
  })

  it("does not modify points on other edges", () => {
    const points = [
      makePoint("a", 0, 0, "left", 400),
      makePoint("b", 0, 0, "right", 400),
    ]
    const result = redistributeOnEdge(points, "left", canvasWidth, canvasHeight, swatchRadius)
    const b = result.find(p => p.id === "b")!
    expect(b.swatchOrder).toBe(400)
  })

  it("single swatch on top edge → centered", () => {
    const points = [makePoint("a", 0, 0, "top", 100)]
    const result = redistributeOnEdge(points, "top", canvasWidth, canvasHeight, swatchRadius)
    // L=400, n=1: 400*1/2 = 200
    expect(result[0].swatchOrder).toBe(Math.round(400 / 2))
  })

  it("preserves relative order when redistributing", () => {
    const points = [
      makePoint("a", 0, 0, "right", 700),
      makePoint("b", 0, 0, "right", 200),
      makePoint("c", 0, 0, "right", 450),
    ]
    const result = redistributeOnEdge(points, "right", canvasWidth, canvasHeight, swatchRadius)
    // sorted by swatchOrder: b(200), c(450), a(700) → indices 0,1,2 of 3
    // L=800, n=3: 800*1/4=200, 800*2/4=400, 800*3/4=600
    const b = result.find(p => p.id === "b")!
    const c = result.find(p => p.id === "c")!
    const a = result.find(p => p.id === "a")!
    expect(b.swatchOrder).toBe(Math.round(800 * 1 / 4))
    expect(c.swatchOrder).toBe(Math.round(800 * 2 / 4))
    expect(a.swatchOrder).toBe(Math.round(800 * 3 / 4))
  })
})

describe("placeSwatchOnEdge", () => {
  const canvasWidth = 400, canvasHeight = 800, swatchRadius = 20

  it("keeps the dropped position when no neighbour is within 2*swatchRadius", () => {
    // a dropped at 100, b sits at 400 — gap 300 >> 2r(40), no overlap
    const points = [
      makePoint("a", 0, 0, "left", 100),
      makePoint("b", 0, 0, "left", 400),
    ]
    const result = placeSwatchOnEdge(points, "a", "left", canvasWidth, canvasHeight, swatchRadius)
    expect(result.find(p => p.id === "a")!.swatchOrder).toBe(100) // unchanged
    expect(result.find(p => p.id === "b")!.swatchOrder).toBe(400) // unchanged
  })

  it("redistributes the edge when the drop overlaps a neighbour (< 2*swatchRadius)", () => {
    // a dropped at 410, b at 400 — gap 10 < 2r(40) → overlap → redistribute
    const points = [
      makePoint("a", 0, 0, "left", 410),
      makePoint("b", 0, 0, "left", 400),
    ]
    const result = placeSwatchOnEdge(points, "a", "left", canvasWidth, canvasHeight, swatchRadius)
    // sorted by swatchOrder: b(400), a(410) → b→800/3, a→800*2/3
    expect(result.find(p => p.id === "b")!.swatchOrder).toBe(Math.round(800 / 3))
    expect(result.find(p => p.id === "a")!.swatchOrder).toBe(Math.round(800 * 2 / 3))
  })

  it("ignores swatches on other edges when checking overlap", () => {
    // b is at the same order but on a different edge — must not trigger redistribute
    const points = [
      makePoint("a", 0, 0, "left", 400),
      makePoint("b", 0, 0, "right", 400),
    ]
    const result = placeSwatchOnEdge(points, "a", "left", canvasWidth, canvasHeight, swatchRadius)
    expect(result.find(p => p.id === "a")!.swatchOrder).toBe(400) // unchanged
  })

  it("single swatch on edge keeps its dropped position", () => {
    const points = [makePoint("a", 0, 0, "top", 137)]
    const result = placeSwatchOnEdge(points, "a", "top", canvasWidth, canvasHeight, swatchRadius)
    expect(result.find(p => p.id === "a")!.swatchOrder).toBe(137)
  })
})

describe("assignSwatchLayout — free-floating swatch skip (Story 5.1)", () => {
  it("a free-floating point keeps its swatchX/swatchY and is not assigned a swatchOrder", () => {
    // Free point near the left edge; without the skip it would get a left order.
    const free = makePoint("free", 10, 400, "auto", null, 123, 456)
    const result = assignSwatchLayout([free], W, H)
    const out = result.find(p => p.id === "free")!
    expect(out.swatchX).toBe(123)
    expect(out.swatchY).toBe(456)
    expect(out.swatchOrder).toBeNull()
    // swatchSide is left untouched too (not coerced to an edge).
    expect(out.swatchSide).toBe("auto")
  })

  it("remaining edge points distribute as if the free point were absent", () => {
    // Two left-edge points + one free point. The free point must NOT count toward
    // the per-edge even-distribution of the two edge points.
    const e1 = makePoint("e1", 5, 200, "left")
    const e2 = makePoint("e2", 5, 600, "left")
    const free = makePoint("free", 5, 400, "left", null, 200, 400)
    const result = assignSwatchLayout([e1, e2, free], W, H)
    // Two edge points → orders at H/3 and 2H/3 (free excluded → n=2, not 3).
    const o1 = result.find(p => p.id === "e1")!.swatchOrder
    const o2 = result.find(p => p.id === "e2")!.swatchOrder
    expect([o1, o2].sort((a, b) => a! - b!)).toEqual([
      Math.round(H * 1 / 3),
      Math.round(H * 2 / 3),
    ])
    // Free point passes through unchanged.
    const fp = result.find(p => p.id === "free")!
    expect(fp.swatchX).toBe(200)
    expect(fp.swatchY).toBe(400)
    expect(fp.swatchOrder).toBeNull()
  })
})

describe("resolveSwatchOverlap (Story 5.1)", () => {
  const r = 48
  const W2 = 1080
  const H2 = 1920

  it("no overlap → returns the input position unchanged", () => {
    const others = [{ x: 200, y: 200 }]
    const result = resolveSwatchOverlap(others, 600, 600, r, W2, H2)
    expect(result).toEqual({ x: 600, y: 600 })
  })

  it("single overlap pushes to exactly 2r separation along the connecting axis", () => {
    // Drop directly to the right of a neighbour, only 50px away (< 2r=96).
    const others = [{ x: 500, y: 500 }]
    const result = resolveSwatchOverlap(others, 550, 500, r, W2, H2)
    // Pushed straight along +x to exactly 2r from the neighbour.
    expect(result.y).toBeCloseTo(500, 5)
    expect(result.x).toBeCloseTo(500 + 2 * r, 5)
    expect(Math.hypot(result.x - 500, result.y - 500)).toBeCloseTo(2 * r, 5)
  })

  it("clamps the resolved position within the canvas bounds", () => {
    // Force a push toward the right wall; result must stay within [r, W-r].
    const others = [{ x: W2 - r - 10, y: 500 }]
    const result = resolveSwatchOverlap(others, W2 - r, 500, r, W2, H2)
    expect(result.x).toBeLessThanOrEqual(W2 - r)
    expect(result.x).toBeGreaterThanOrEqual(r)
    expect(result.y).toBeLessThanOrEqual(H2 - r)
    expect(result.y).toBeGreaterThanOrEqual(r)
  })

  it("multiple-neighbour relaxation converges to a non-overlapping spot", () => {
    // Two neighbours flanking the drop point; relaxation must separate from both.
    const others = [
      { x: 500, y: 500 },
      { x: 560, y: 500 },
    ]
    const result = resolveSwatchOverlap(others, 530, 500, r, W2, H2)
    for (const o of others) {
      expect(Math.hypot(result.x - o.x, result.y - o.y)).toBeGreaterThanOrEqual(2 * r - 1e-6)
    }
  })

  it("degenerate exact-overlap pushes deterministically along +x", () => {
    // Dropped exactly on a neighbour → push direction is +x by convention.
    const others = [{ x: 500, y: 500 }]
    const result = resolveSwatchOverlap(others, 500, 500, r, W2, H2)
    expect(result.y).toBeCloseTo(500, 5)
    expect(result.x).toBeCloseTo(500 + 2 * r, 5)
  })

  it("pushes a corner cluster off into open canvas and fully separates", () => {
    // With room to escape (wide canvas), the dragged swatch is pushed clear of
    // the packed top-left corner and reaches >= 2r from every neighbour.
    const others = [
      { x: r, y: r },
      { x: r, y: r + 1 },
      { x: r + 1, y: r },
    ]
    const result = resolveSwatchOverlap(others, r, r, r, W2, H2)
    expect(result.x).toBeGreaterThan(r) // moved off the exact corner
    for (const o of others) {
      // toBeCloseTo(_, 0) tolerates the exactly-2r touching case (delta < 0.5).
      expect(Math.hypot(result.x - o.x, result.y - o.y)).toBeGreaterThanOrEqual(2 * r - 0.5)
    }
  })

  it("boxed-in cluster falls back to a clamped, still-overlapping position (no neighbour moved)", () => {
    // Cramped canvas: the clamp box [r, side-r] is far narrower than 2r, so the
    // dragged swatch can NEVER reach 2r from all neighbours — exercises the
    // documented best-effort fallback (returns clamped input, leaves others put).
    const side = 2 * r + 24 // clamp range is only 24px, << minDist (2r = 96)
    const others = [
      { x: r, y: r },
      { x: side - r, y: side - r },
      { x: side - r, y: r },
      { x: r, y: side - r },
    ]
    const frozen = others.map((o) => ({ ...o }))
    const result = resolveSwatchOverlap(others, side / 2, side / 2, r, side, side)
    // Stays within the (tiny) bounds; never throws or loops forever.
    expect(result.x).toBeGreaterThanOrEqual(r)
    expect(result.x).toBeLessThanOrEqual(side - r)
    expect(result.y).toBeGreaterThanOrEqual(r)
    expect(result.y).toBeLessThanOrEqual(side - r)
    // Fallback genuinely overlaps at least one neighbour (separation impossible).
    const minSep = Math.min(...others.map((o) => Math.hypot(result.x - o.x, result.y - o.y)))
    expect(minSep).toBeLessThan(2 * r)
    // AC4: no neighbour was moved.
    expect(others).toEqual(frozen)
  })
})

describe("computeSwatchSnap", () => {
  const R = 48
  const CW = 400
  const CH = 800
  const THRESH = 10
  // A marker far from everything so it never accidentally snaps unless tested.
  const FAR_MARKER = { x: -9999, y: -9999 }

  const base = {
    swatchRadius: R,
    canvasWidth: CW,
    canvasHeight: CH,
    threshold: THRESH,
  }

  it("AC1: snaps X to another swatch's X within threshold + one x-guide", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 200, y: 600 }],
      marker: FAR_MARKER,
      x: 205, // within 10 of 200
      y: 100, // nothing nearby
    })
    expect(result.x).toBe(200)
    expect(result.y).toBe(100)
    expect(result.guides).toEqual([{ axis: "x", pos: 200 }])
  })

  it("AC1: snaps Y to another swatch's Y within threshold + one y-guide", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 30, y: 500 }],
      marker: FAR_MARKER,
      x: 100, // x=30 is >threshold away, no x-snap
      y: 495, // within 10 of 500
    })
    expect(result.x).toBe(100)
    expect(result.y).toBe(500)
    expect(result.guides).toEqual([{ axis: "y", pos: 500 }])
  })

  it("AC1: X and Y can snap to two DIFFERENT swatches in one call", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 999 }, // supplies the X target
        { x: 999, y: 300 }, // supplies the Y target
      ],
      marker: FAR_MARKER,
      x: 152,
      y: 305,
    })
    expect(result.x).toBe(150)
    expect(result.y).toBe(300)
    expect(result.guides).toEqual([
      { axis: "x", pos: 150 },
      { axis: "y", pos: 300 },
    ])
  })

  it("AC3: snaps to the vertical centerline (canvasWidth/2)", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: FAR_MARKER,
      x: 203, // within 10 of 200 (=CW/2)
      y: 50,
    })
    expect(result.x).toBe(200)
    expect(result.guides).toContainEqual({ axis: "x", pos: 200 })
  })

  it("AC3: snaps to the clamped left edge (r) and right edge (canvasWidth−r)", () => {
    const left = computeSwatchSnap({
      ...base,
      others: [],
      marker: FAR_MARKER,
      x: R + 3,
      y: 50,
    })
    expect(left.x).toBe(R)
    expect(left.guides).toContainEqual({ axis: "x", pos: R })

    const right = computeSwatchSnap({
      ...base,
      others: [],
      marker: FAR_MARKER,
      x: CW - R - 2,
      y: 50,
    })
    expect(right.x).toBe(CW - R)
    expect(right.guides).toContainEqual({ axis: "x", pos: CW - R })
  })

  it("AC3: snaps Y to the horizontal centerline (canvasHeight/2)", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: FAR_MARKER,
      x: 100,
      y: 404, // within 10 of 400 (=CH/2)
    })
    expect(result.y).toBe(400)
    expect(result.guides).toContainEqual({ axis: "y", pos: 400 })
  })

  it("AC4: snaps to the own-marker X within threshold + guide", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: { x: 250, y: 600 },
      x: 246, // within 10 of marker.x
      y: 50, // marker.y is >threshold away
    })
    expect(result.x).toBe(250)
    expect(result.guides).toContainEqual({ axis: "x", pos: 250 })
  })

  it("AC4: snaps to the own-marker Y within threshold + guide", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: { x: 999, y: 600 },
      x: 100,
      y: 593, // within 10 of marker.y
    })
    expect(result.y).toBe(600)
    expect(result.guides).toContainEqual({ axis: "y", pos: 600 })
  })

  it("clamps an own-marker snap that falls outside [r, canvasWidth−r] back into the band", () => {
    // A marker near the left image edge (x < r) within threshold must not pull
    // the swatch off-frame: the snap (and its guide) clamp to r.
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: { x: 20, y: 999 }, // 20 < R(48), out of the clamp band
      x: 24, // within 10 of marker.x=20
      y: 200, // far from every Y target
    })
    expect(result.x).toBe(R)
    expect(result.guides).toEqual([{ axis: "x", pos: R }])
  })

  it("clamps an own-marker Y snap past the bottom edge back to canvasHeight−r", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [],
      marker: { x: 999, y: CH - 10 }, // CH−10 > CH−R, out of band
      x: 150, // far from every X target (edges 48/352, centerline 200)
      y: CH - 12, // within 10 of marker.y
    })
    expect(result.y).toBe(CH - R)
    expect(result.guides).toEqual([{ axis: "y", pos: CH - R }])
  })

  it("AC2: with neighbours at X=100 and X=300, a raw X near 200 snaps to the midpoint", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 100, y: 999 },
        { x: 300, y: 999 },
      ],
      marker: FAR_MARKER,
      x: 197, // within 10 of midpoint 200
      y: 50,
    })
    expect(result.x).toBe(200)
    expect(result.guides).toContainEqual({ axis: "x", pos: 200 })
  })

  it("AC2: midpoint outside threshold → no snap", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 100, y: 999 },
        { x: 300, y: 999 },
      ],
      marker: FAR_MARKER,
      x: 180, // 20 away from midpoint 200, >threshold
      y: 200, // far from every Y target
    })
    expect(result.x).toBe(180)
    expect(result.guides).toEqual([])
  })

  it("AC5: raw position outside threshold of every target → returns raw coords, no guides (soft escape)", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 200, y: 600 }],
      marker: { x: 250, y: 650 },
      x: 150, // far from everything (edges 48/352, centerline 200)
      y: 200, // far from everything (edges 48/752, centerline 400)
    })
    expect(result).toEqual({ x: 150, y: 200, guides: [], distribution: [] })
  })

  it("priority: a swatch-center target beats a centerline within threshold on the same axis", () => {
    // Place a swatch center 1px off the raw, and have the centerline also within
    // threshold. The swatch-center (priority a) must win over the frame (priority c).
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 196, y: 999 }], // swatch X target
      marker: FAR_MARKER,
      x: 197, // within 10 of both 196 (swatch) and 200 (centerline=CW/2)
      y: 200, // far from every Y target
    })
    expect(result.x).toBe(196)
    expect(result.guides).toEqual([{ axis: "x", pos: 196 }])
  })

  it("de-dupes a guide when two targets share the same (axis, pos)", () => {
    // A swatch center sits exactly on the centerline; only one guide emitted.
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 200, y: 999 }], // == CW/2
      marker: FAR_MARKER,
      x: 201,
      y: 200, // far from every Y target (edges 48/752, centerline 400)
    })
    expect(result.guides).toEqual([{ axis: "x", pos: 200 }])
  })

  // ---- Story 5.3: equal-interval chain surfaces a DistributionGuide ----

  it("Story 5.3 / AC1: a vertical column (shared X) snaps Y to the midpoint and emits a distribution cue", () => {
    // Two swatches sharing X=150 at Y=100,300; drag finds its Y between them.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 },
        { x: 150, y: 300 },
      ],
      marker: FAR_MARKER,
      x: 150, // shares the column X → other-swatch center snaps X (priority a)
      y: 204, // within 10 of midpoint 200
    })
    expect(result.x).toBe(150)
    expect(result.y).toBe(200)
    // axis "y" = vertical column; alignPos = shared X; marks along Y.
    expect(result.distribution).toEqual([{ axis: "y", alignPos: 150, marks: [100, 200, 300] }])
  })

  it("Story 5.3 / AC1: a horizontal row (shared Y) snaps X to the midpoint and emits a distribution cue", () => {
    // Two swatches sharing Y=600 at X=120,320 (off the centerline 200); drag finds X.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 120, y: 600 },
        { x: 320, y: 600 },
      ],
      marker: FAR_MARKER,
      x: 222, // within 10 of midpoint 220
      y: 600, // shares the row Y → other-swatch center snaps Y (priority a)
    })
    expect(result.x).toBe(220)
    expect(result.y).toBe(600)
    // axis "x" = horizontal row; alignPos = shared Y; marks along X.
    expect(result.distribution).toEqual([{ axis: "x", alignPos: 600, marks: [120, 220, 320] }])
  })

  it("Story 5.3 / AC2: chain grows to fill a gap in an evenly-spaced column (N>3)", () => {
    // Column shared X=150 at Y=100,200,400,500 (missing 300); drag fills 300.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 },
        { x: 150, y: 200 },
        { x: 150, y: 400 },
        { x: 150, y: 500 },
      ],
      marker: FAR_MARKER,
      x: 150,
      y: 303, // within 10 of midpoint 300
    })
    expect(result.y).toBe(300)
    // The whole evenly-spaced run is marked, not just the immediate pair.
    expect(result.distribution).toEqual([{
      axis: "y",
      alignPos: 150,
      marks: [100, 200, 300, 400, 500],
    }])
  })

  it("Story 5.3 / AC3: chain stops at the first unequal gap (no false full-chain)", () => {
    // Column shared X=150 at Y=110,240,400,480,600; drag fills 320 (between 240,400).
    // gap = 80. Upward: 400→480 matches (add 480), 480→600 gap 120 breaks (stop).
    // Downward: 240→110 gap 130 breaks immediately. Run = [240,320,400,480].
    // (Midpoint 320 is kept clear of the centerline 400 so the frame snap, which
    // is higher priority, doesn't pre-empt the equal-spacing fallback on Y.)
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 110 },
        { x: 150, y: 240 },
        { x: 150, y: 400 },
        { x: 150, y: 480 },
        { x: 150, y: 600 },
      ],
      marker: FAR_MARKER,
      x: 150,
      y: 322, // within 10 of midpoint 320
    })
    expect(result.y).toBe(320)
    expect(result.distribution).toEqual([{
      axis: "y",
      alignPos: 150,
      marks: [240, 320, 400, 480],
    }])
  })

  it("Story 5.3 / AC6: a swatch with a matching gap but a perpendicular coord OUTSIDE threshold does NOT join the chain", () => {
    // Two swatches at X=150,Y=100/300 — but the dragged swatch's X (250) is >threshold
    // from their column X, so they are not 'aligned': no chain, no cue.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 },
        { x: 150, y: 300 },
      ],
      marker: FAR_MARKER,
      x: 250, // 100px from the column X=150 → not aligned
      y: 204, // would be the midpoint if it WERE aligned
    })
    expect(result.distribution).toEqual([])
  })

  it("Story 5.3 / AC6: a perpendicular coord WITHIN threshold does join the chain", () => {
    // Same column, but dragged X=156 is within 10 of 150 → aligned → cue appears.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 },
        { x: 150, y: 300 },
      ],
      marker: FAR_MARKER,
      x: 156, // within 10 of column X=150 (snaps X to 150, priority a)
      y: 204,
    })
    expect(result.distribution).toEqual([{ axis: "y", alignPos: 150, marks: [100, 200, 300] }])
  })

  it("Story 5.3: priority preserved — an other-swatch center beats the equal-interval target on the same axis (distribution null)", () => {
    // On the X axis a real swatch center at 198 is within threshold of raw 200 and
    // wins (priority a); the equal-spacing fallback never runs on X, so no cue.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 198, y: 600 }, // X target within threshold of raw 200
        { x: 100, y: 600 }, // would-be equal-spacing neighbours...
        { x: 300, y: 600 }, // ...but X already snapped to 198 first
      ],
      marker: FAR_MARKER,
      x: 200,
      y: 600, // shares Y → other-swatch center snaps Y (still a real-center snap)
    })
    expect(result.x).toBe(198)
    expect(result.distribution).toEqual([])
  })

  it("Story 5.3: distribution is null when no equal-spacing snap occurs", () => {
    const result = computeSwatchSnap({
      ...base,
      others: [{ x: 30, y: 500 }],
      marker: FAR_MARKER,
      x: 100,
      y: 495, // snaps Y to a single other-swatch center (no chain)
    })
    expect(result.distribution).toEqual([])
  })

  it("tie: an equal-distance cue is NOT suppressed when the same axis also aligns to another dot", () => {
    // Column shared X=150 at Y=100,300: dragging to Y≈200 is the equal-interval
    // midpoint. A THIRD dot at Y=200 (well off the column, X=999) means raw Y=200
    // ALSO aligns to a real other-swatch center — the higher-priority snap. The
    // equal-distance cue must still appear (the bug: it used to vanish on this tie).
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 },
        { x: 150, y: 300 },
        { x: 999, y: 200 }, // aligns Y to the midpoint via priority (a)
      ],
      marker: FAR_MARKER,
      x: 150, // shares the column X
      y: 203, // within 10 of both the chain midpoint 200 AND the dot at 200
    })
    expect(result.y).toBe(200)
    // Both the alignment guide AND the equal-distance cue are present.
    expect(result.guides).toContainEqual({ axis: "y", pos: 200 })
    expect(result.distribution).toEqual([{ axis: "y", alignPos: 150, marks: [100, 200, 300] }])
  })

  it("tie: BOTH axes' equal-distance cues fire when centred in a row and a column at once", () => {
    // A vertical column shared X=150 at Y=100,300 (midpoint Y=200) AND a horizontal
    // row shared Y=200 at X=50,250 (midpoint X=150). Dragging to (150,200) is the
    // equal-interval centre of both → both cues, not just one.
    const result = computeSwatchSnap({
      ...base,
      others: [
        { x: 150, y: 100 }, // column
        { x: 150, y: 300 }, // column
        { x: 50, y: 200 },  // row
        { x: 250, y: 200 }, // row
      ],
      marker: FAR_MARKER,
      x: 150,
      y: 200,
    })
    expect(result.x).toBe(150)
    expect(result.y).toBe(200)
    expect(result.distribution).toEqual([
      { axis: "x", alignPos: 200, marks: [50, 150, 250] },
      { axis: "y", alignPos: 150, marks: [100, 200, 300] },
    ])
  })
})

describe("computeEqualIntervalChain (Story 5.3)", () => {
  const THRESH = 10

  it("AC1: minimal triple — nearest neighbour below and above, marks = [lo, target, hi]", () => {
    const result = computeEqualIntervalChain({
      raw: 205,
      alignedCoords: [100, 300],
      threshold: THRESH,
    })
    expect(result).toEqual({ snap: 200, marks: [100, 200, 300] })
  })

  it("AC2: grows the run to neighbours that share the same interval (fills a gap)", () => {
    // Even run at 100,200,400,500 (missing 300); raw ~300 fills the gap.
    const result = computeEqualIntervalChain({
      raw: 298,
      alignedCoords: [100, 200, 400, 500],
      threshold: THRESH,
    })
    expect(result).toEqual({ snap: 300, marks: [100, 200, 300, 400, 500] })
  })

  it("AC3: stops at the first unequal gap on each side", () => {
    // 50,200,300,500: filling 400 grows down through 300→200 (gap 100) but stops
    // before 50 (200→50 gap 150 ≠ 100). Upward there is nothing past 500.
    const result = computeEqualIntervalChain({
      raw: 400,
      alignedCoords: [50, 200, 300, 500],
      threshold: THRESH,
    })
    expect(result).toEqual({ snap: 400, marks: [200, 300, 400, 500] })
  })

  it("AC5: raw just outside threshold of the equal-interval target → null (soft escape)", () => {
    // target = 200; raw 185 is 15 away, > threshold 10.
    const result = computeEqualIntervalChain({
      raw: 185,
      alignedCoords: [100, 300],
      threshold: THRESH,
    })
    expect(result).toBeNull()
  })

  it("returns null when there is no neighbour on one side (not 'in the middle')", () => {
    expect(
      computeEqualIntervalChain({ raw: 400, alignedCoords: [100, 200], threshold: THRESH })
    ).toBeNull()
    expect(
      computeEqualIntervalChain({ raw: 50, alignedCoords: [100, 200], threshold: THRESH })
    ).toBeNull()
  })

  it("returns null when there are no aligned neighbours at all", () => {
    expect(
      computeEqualIntervalChain({ raw: 200, alignedCoords: [], threshold: THRESH })
    ).toBeNull()
  })
})
