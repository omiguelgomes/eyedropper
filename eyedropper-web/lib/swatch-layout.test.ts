import { describe, it, expect } from "vitest"
import { assignSwatchLayout, redistributeOnEdge, placeSwatchOnEdge } from "./swatch-layout"
import type { EyedropperPoint } from "./types"

function makePoint(id: string, x: number, y: number, swatchSide: EyedropperPoint["swatchSide"] = "auto", swatchOrder: number | null = null): EyedropperPoint {
  return {
    id,
    x,
    y,
    color: "#888888",
    swatchSide,
    swatchOrder,
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
