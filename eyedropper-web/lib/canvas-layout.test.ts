import { describe, it, expect } from "vitest"
import { computeLayout, clampPan, imageToCanvas, canvasToImage, isPointInFrame } from "./canvas-layout"

describe("computeLayout", () => {
  it("square image into a square frame: identity transform", () => {
    const l = computeLayout(100, 100, { w: 1, h: 1 })
    expect(l).toEqual({
      canvasWidth: 100,
      canvasHeight: 100,
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    })
  })

  it("canvasWidth stays equal to imageWidth; canvasHeight follows the ratio", () => {
    const l = computeLayout(900, 900, { w: 9, h: 16 })
    expect(l.canvasWidth).toBe(900)
    expect(l.canvasHeight).toBe(Math.round(900 * 16 / 9))
  })

  it("cover-scales a square image into a tall frame and center-crops horizontally", () => {
    // 100×100 into 1:2 (tall). canvasHeight=200, scale=2, drawn 200×200.
    const l = computeLayout(100, 100, { w: 1, h: 2 })
    expect(l.canvasHeight).toBe(200)
    expect(l.imageScale).toBe(2)
    // Drawn width 200 overflows the 100 frame → offsetX = (100-200)/2 = -50.
    expect(l.imageOffsetX).toBe(-50)
    expect(l.imageOffsetY).toBe(0)
  })

  it("cover-scales a square image into a wide frame and center-crops vertically", () => {
    // 100×100 into 2:1 (wide). canvasWidth=100, canvasHeight=50, scale=max(1, 0.5)=1.
    // Drawn 100×100, frame 100×50 → offsetY = (50-100)/2 = -25.
    const l = computeLayout(100, 100, { w: 2, h: 1 })
    expect(l.canvasHeight).toBe(50)
    expect(l.imageScale).toBe(1)
    expect(l.imageOffsetX).toBe(0)
    expect(l.imageOffsetY).toBe(-25)
  })

  it("the frame is always fully covered (no gap): drawn image spans the frame on both axes", () => {
    const l = computeLayout(800, 600, { w: 16, h: 9 })
    const drawnW = 800 * l.imageScale
    const drawnH = 600 * l.imageScale
    expect(l.imageOffsetX).toBeLessThanOrEqual(0)
    expect(l.imageOffsetY).toBeLessThanOrEqual(0)
    expect(l.imageOffsetX + drawnW).toBeGreaterThanOrEqual(l.canvasWidth)
    expect(l.imageOffsetY + drawnH).toBeGreaterThanOrEqual(l.canvasHeight)
  })

  it("pan slides the crop and is clamped to the covered area", () => {
    // 100×100 into 1:2: slackX = 50. A pan beyond slack clamps.
    const maxPan = computeLayout(100, 100, { w: 1, h: 2 }, { x: 1000, y: 0 })
    expect(maxPan.imageOffsetX).toBe(0) // -50 + 50 (clamped)
    const midPan = computeLayout(100, 100, { w: 1, h: 2 }, { x: 25, y: 0 })
    expect(midPan.imageOffsetX).toBe(-25) // -50 + 25
  })

  it("ignores pan on an axis with no slack", () => {
    // 1:2 frame has zero vertical slack (drawnH === canvasHeight).
    const l = computeLayout(100, 100, { w: 1, h: 2 }, { x: 0, y: 40 })
    expect(l.imageOffsetY).toBe(0)
  })

  it("zoom multiplies the cover scale and grows the crop overflow", () => {
    // 100×100 into 1:1 at zoom 2: cover scale 1 → 2, drawn 200×200, centered so
    // offset = (100-200)/2 = -50 on both axes.
    const l = computeLayout(100, 100, { w: 1, h: 1 }, { x: 0, y: 0 }, 2)
    expect(l.imageScale).toBe(2)
    expect(l.imageOffsetX).toBe(-50)
    expect(l.imageOffsetY).toBe(-50)
  })

  it("zoom below 1 is ignored (floored to the cover scale)", () => {
    const l = computeLayout(100, 100, { w: 1, h: 1 }, { x: 0, y: 0 }, 0.5)
    expect(l.imageScale).toBe(1)
  })

  it("zoom creates pan slack on an axis that had none", () => {
    // 1:1 frame has zero slack at zoom 1; at zoom 2 slackX = (200-100)/2 = 50.
    const l = computeLayout(100, 100, { w: 1, h: 1 }, { x: 40, y: 0 }, 2)
    expect(l.imageOffsetX).toBe(-10) // -50 + 40
  })

  it("returns zeros for degenerate input", () => {
    expect(computeLayout(0, 0, { w: 1, h: 1 })).toEqual({
      canvasWidth: 0,
      canvasHeight: 0,
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    })
  })
})

describe("clampPan", () => {
  it("clamps to the per-axis slack", () => {
    // 100×100 into 1:2: slackX=50, slackY=0.
    expect(clampPan(100, 100, { w: 1, h: 2 }, { x: 999, y: 999 })).toEqual({ x: 50, y: 0 })
    const lo = clampPan(100, 100, { w: 1, h: 2 }, { x: -999, y: -999 })
    expect(lo.x).toBe(-50)
    expect(lo.y === 0).toBe(true) // accepts both +0 and -0
    expect(clampPan(100, 100, { w: 1, h: 2 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 })
  })

  it("zoom widens the clamp slack", () => {
    // 1:1 has zero slack at zoom 1; at zoom 3 slack = (300-100)/2 = 100 per axis.
    expect(clampPan(100, 100, { w: 1, h: 1 }, { x: 999, y: 999 }, 3)).toEqual({ x: 100, y: 100 })
  })
})

describe("isPointInFrame", () => {
  it("a centered point is inside; a cover-cropped corner is outside", () => {
    // 100×100 into 1:2: scale 2, drawn 200×200, offsetX -50 → left/right thirds
    // of the image are cropped out of the 100-wide frame.
    const l = computeLayout(100, 100, { w: 1, h: 2 })
    expect(isPointInFrame(50, 50, l)).toBe(true)
    // Image x=10 → canvas -50 + 20 = -30, off the left edge of the frame.
    expect(isPointInFrame(10, 50, l)).toBe(false)
  })

  it("respects the pan offset when deciding visibility", () => {
    const l = computeLayout(100, 100, { w: 1, h: 2 })
    // x=90 → canvas -50 + 180 = 130, off the right edge at pan 0.
    expect(isPointInFrame(90, 50, l)).toBe(false)
    // Panning left by 40 brings it to 90, back inside the [0,100] frame.
    expect(isPointInFrame(90, 50, l, { x: -40, y: 0 })).toBe(true)
  })
})

describe("imageToCanvas / canvasToImage round-trip", () => {
  it("inverts under a non-identity scale and offset", () => {
    const l = computeLayout(100, 100, { w: 1, h: 2 }) // scale 2, offsetX -50
    const c = imageToCanvas(30, 40, l)
    expect(c).toEqual({ x: -50 + 30 * 2, y: 40 * 2 })
    const back = canvasToImage(c.x, c.y, l)
    expect(back.x).toBeCloseTo(30)
    expect(back.y).toBeCloseTo(40)
  })
})
