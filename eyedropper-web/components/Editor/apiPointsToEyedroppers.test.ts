import { describe, it, expect, vi } from "vitest"

// index.tsx pulls in LabelPanel → @/lib/fonts → next/font/google (a build-time
// transform that fails under Vitest); stub it so the module imports cleanly.
vi.mock("@/lib/fonts", () => ({
  FONT_OPTIONS: [],
  resolveFontFamily: (s: string) => s,
}))

// index.tsx pulls in Canvas → react-konva; mock it so the module imports cleanly in jsdom.
vi.mock("react-konva", () => ({
  Stage: () => null,
  Layer: () => null,
  Rect: () => null,
  Image: () => null,
  Circle: () => null,
}))

import {
  apiPointsToEyedroppers,
  claudePointsToEyedroppers,
  canvasClickToImagePoint,
  seedNewLabels,
  rescalePointsForSize,
} from "./index"
import type { CanvasLayout } from "@/lib/canvas-to-916"
import type { EyedropperPoint } from "@/lib/types"
import { loadStyles } from "@/lib/styles"
import { assignSwatchLayout } from "@/lib/swatch-layout"
import { getSwatchPos } from "./EyedropperLayer"

describe("apiPointsToEyedroppers", () => {
  it("returns an empty array for empty input", () => {
    expect(apiPointsToEyedroppers([])).toEqual([])
  })

  it("maps x, y, and color through to each point", () => {
    const result = apiPointsToEyedroppers([{ x: 10, y: 20, color: "#aabbcc" }])
    expect(result).toHaveLength(1)
    expect(result[0].x).toBe(10)
    expect(result[0].y).toBe(20)
    expect(result[0].color).toBe("#aabbcc")
  })

  it("applies the expected defaults and copies coords into the label", () => {
    const [p] = apiPointsToEyedroppers([{ x: 5, y: 7, color: "#ff0000" }])
    expect(p.swatchSide).toBe("auto")
    expect(p.swatchOrder).toBeNull()
    // Story 5.1: new points start edge-laid-out (not detached) → free coords null.
    expect(p.swatchX).toBeNull()
    expect(p.swatchY).toBeNull()
    // Story 5.4 (AC9): fresh points have no connector bend.
    expect(p.connectorMid).toBeNull()
    expect(p.label.x).toBe(5)
    expect(p.label.y).toBe(7)
    expect(p.label.text).toBe("")
    expect(p.label.visible).toBe(true)
  })

  it("assigns a unique id to every point", () => {
    const result = apiPointsToEyedroppers([
      { x: 1, y: 1, color: "#000" },
      { x: 2, y: 2, color: "#111" },
      { x: 3, y: 3, color: "#222" },
    ])
    const ids = result.map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
  })
})

describe("canvasClickToImagePoint (AC2 band-guard)", () => {
  // Portrait image padded into a 9:16 canvas: image band is canvasY ∈ [100, 700].
  const layout: CanvasLayout = { canvasWidth: 400, canvasHeight: 800, imageOffsetY: 100 }
  const imageHeight = 600

  it("converts an in-band click to image space (subtracting imageOffsetY)", () => {
    expect(canvasClickToImagePoint(200, 400, layout, imageHeight)).toEqual({ x: 200, y: 300 })
  })

  it("rejects a click in the top letterbox padding (above the image)", () => {
    expect(canvasClickToImagePoint(200, 50, layout, imageHeight)).toBeNull()
  })

  it("rejects a click in the bottom letterbox padding (below the image)", () => {
    // canvasY 750 → imageY 650, beyond imageHeight 600
    expect(canvasClickToImagePoint(200, 750, layout, imageHeight)).toBeNull()
  })

  it("rejects a click past the right edge", () => {
    expect(canvasClickToImagePoint(401, 400, layout, imageHeight)).toBeNull()
  })

  it("accepts clicks exactly on the band boundaries (inclusive)", () => {
    expect(canvasClickToImagePoint(0, 100, layout, imageHeight)).toEqual({ x: 0, y: 0 })
    expect(canvasClickToImagePoint(400, 700, layout, imageHeight)).toEqual({ x: 400, y: 600 })
  })
})

describe("claudePointsToEyedroppers", () => {
  it("returns an empty array for empty input", () => {
    expect(claudePointsToEyedroppers([])).toEqual([])
  })

  it("maps x, y, and uses #888888 placeholder color", () => {
    const result = claudePointsToEyedroppers([{ x: 10, y: 20, description: "warm highlight" }])
    expect(result).toHaveLength(1)
    expect(result[0].x).toBe(10)
    expect(result[0].y).toBe(20)
    expect(result[0].color).toBe("#888888")
  })

  it("pre-fills label.text from description", () => {
    const [p] = claudePointsToEyedroppers([{ x: 5, y: 7, description: "deep shadow" }])
    expect(p.label.text).toBe("deep shadow")
  })

  it("applies expected defaults and copies coords into label", () => {
    const [p] = claudePointsToEyedroppers([{ x: 5, y: 7, description: "test" }])
    expect(p.swatchSide).toBe("auto")
    expect(p.swatchOrder).toBeNull()
    expect(p.swatchX).toBeNull()
    expect(p.swatchY).toBeNull()
    expect(p.connectorMid).toBeNull()
    expect(p.label.x).toBe(5)
    expect(p.label.y).toBe(7)
    expect(p.label.visible).toBe(true)
    expect(p.label.fontSize).toBe(35)
    expect(p.label.fontFamily).toBe("Cormorant Garamond Italic")
    expect(p.label.color).toBe("#1a1a1a")
  })

  it("assigns a unique id to every point", () => {
    const result = claudePointsToEyedroppers([
      { x: 1, y: 1, description: "a" },
      { x: 2, y: 2, description: "b" },
      { x: 3, y: 3, description: "c" },
    ])
    const ids = result.map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
  })
})

describe("seedNewLabels", () => {
  const style = loadStyles().find((s) => s.name === "float")! // beside, r=48
  const W = 800
  const H = 1422
  const offsetY = 100
  const layout = (pts: EyedropperPoint[]) => assignSwatchLayout(pts, W, H, offsetY)

  it("seeds a newly-laid-out label to the beside-swatch anchor, not the raw image coords", () => {
    // Fresh suggest: every point starts swatchOrder null with label.x/y = image x/y.
    const before = apiPointsToEyedroppers([{ x: 20, y: 300, color: "#fff" }])
    const after = layout(before) // assigns side + swatchOrder
    const seeded = seedNewLabels(before, after, style, W, H)

    const p = seeded[0]
    // Label moved off its raw image-space seed (20, 300).
    expect(p.label.x === 20 && p.label.y === 300).toBe(false)
    // It now sits inside the canvas bounds (the getLabelPosition anchor is clamped).
    expect(p.label.x).toBeGreaterThanOrEqual(0)
    expect(p.label.x).toBeLessThanOrEqual(W)
    expect(p.label.y).toBeGreaterThanOrEqual(0)
    expect(p.label.y).toBeLessThanOrEqual(H)
    // A left-edge swatch (x=20 is nearest the left) puts the beside label to its
    // right, i.e. label.x > swatch x (= swatchRadius).
    expect(p.swatchSide).toBe("left")
    expect(p.label.x).toBeGreaterThan(style.swatchRadius)
  })

  it("leaves an already-laid-out label untouched (a dragged label survives re-layout)", () => {
    const seededOnce = seedNewLabels(
      apiPointsToEyedroppers([{ x: 20, y: 300, color: "#fff" }]).map((p) => p),
      layout(apiPointsToEyedroppers([{ x: 20, y: 300, color: "#fff" }])),
      style, W, H
    )
    // Simulate the artist dragging this label somewhere specific.
    const before = seededOnce.map((p) => ({ ...p, label: { ...p.label, x: 555, y: 777 } }))
    // A later re-layout (e.g. marker drag) re-runs assignSwatchLayout.
    const after = layout(before)
    const result = seedNewLabels(before, after, style, W, H)
    expect(result[0].label.x).toBe(555)
    expect(result[0].label.y).toBe(777)
  })

  it("does not touch a point that is still not laid out (swatchOrder null)", () => {
    const before = apiPointsToEyedroppers([{ x: 20, y: 300, color: "#fff" }])
    // after with no layout run: swatchOrder still null
    const result = seedNewLabels(before, before, style, W, H)
    expect(result[0].label.x).toBe(20)
    expect(result[0].label.y).toBe(300)
  })
})

describe("rescalePointsForSize", () => {
  const baseStyle = loadStyles().find((s) => s.name === "float")! // beside, r=48
  const W = 800
  const H = 1422
  const offsetY = 100
  const layout = (pts: EyedropperPoint[]) => assignSwatchLayout(pts, W, H, offsetY)
  const laidOut = (x: number, y: number) => {
    const before = apiPointsToEyedroppers([{ x, y, color: "#fff" }])
    return seedNewLabels(before, layout(before), baseStyle, W, H)
  }

  it("scales every label's fontSize by the ratio", () => {
    const pts = laidOut(20, 300)
    const result = rescalePointsForSize(pts, baseStyle, 1, 2, W, H)
    expect(result[0].label.fontSize).toBeCloseTo(pts[0].label.fontSize * 2)
  })

  it("moves a laid-out label proportionally with its swatch (offset scales by ratio)", () => {
    // Left-edge swatch: center x = swatchRadius, which grows with scale. The
    // label keeps its offset from the swatch center, scaled by the ratio — so it
    // tracks the growing swatch instead of snapping to a canonical anchor.
    const pts = laidOut(20, 300)
    expect(pts[0].swatchSide).toBe("left")
    const oldSwatchX = getSwatchPos(pts[0], W, H, baseStyle.swatchRadius * 1).x
    const oldOffset = pts[0].label.x - oldSwatchX
    const result = rescalePointsForSize(pts, baseStyle, 1, 2, W, H)
    const newSwatchX = getSwatchPos(result[0], W, H, baseStyle.swatchRadius * 2).x
    const newOffset = result[0].label.x - newSwatchX
    // Offset from the swatch center scaled by exactly 2× (no clamp in play here).
    expect(newOffset).toBeCloseTo(oldOffset * 2)
    // Still clears the enlarged swatch (offset was positive → stays positive).
    expect(result[0].label.x).toBeGreaterThan(baseStyle.swatchRadius * 2)
  })

  it("barely moves a label on the first tick (no jump at ratio ≈ 1)", () => {
    const pts = laidOut(20, 300)
    const before = pts[0].label
    const result = rescalePointsForSize(pts, baseStyle, 1, 1.1, W, H)
    const after = result[0].label
    // A 10% scale bump moves the label by ~10% of its (small) swatch offset, not a
    // teleport to a new anchor. The old canonical-anchor logic could jump it far.
    expect(Math.abs(after.x - before.x)).toBeLessThan(baseStyle.swatchRadius)
    expect(Math.abs(after.y - before.y)).toBeLessThan(baseStyle.swatchRadius)
  })

  it("leaves a not-laid-out point's label position alone (only fontSize scales)", () => {
    const before = apiPointsToEyedroppers([{ x: 20, y: 300, color: "#fff" }]) // swatchOrder null
    const result = rescalePointsForSize(before, baseStyle, 1, 2, W, H)
    expect(result[0].label.x).toBe(20)
    expect(result[0].label.y).toBe(300)
    expect(result[0].label.fontSize).toBeCloseTo(before[0].label.fontSize * 2)
  })
})
