import { describe, it, expect } from "vitest"
import { getLabelPosition, LABEL_GAP } from "./label-layout"

const R = 48
// Canvas large enough that the central swatchPos never hits a clamp boundary.
const W = 800
const H = 1422
const swatchPos = { x: 200, y: 300 }

describe("getLabelPosition", () => {
  describe("labelPosition 'below' (grid)", () => {
    it("centers the label under a top-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "top", "below", R, W, H)
      expect(pos.x).toBe(swatchPos.x)
      expect(pos.y).toBe(swatchPos.y + R + LABEL_GAP)
      expect(pos.y).toBeGreaterThan(swatchPos.y)
    })

    it("places the label ABOVE a bottom-edge swatch so it stays on-canvas", () => {
      // A bottom-edge swatch sits at the canvas floor; "below" would fall off.
      const bottomSwatch = { x: 200, y: H - R }
      const pos = getLabelPosition(bottomSwatch, "bottom", "below", R, W, H)
      expect(pos.x).toBe(bottomSwatch.x)
      expect(pos.y).toBe(bottomSwatch.y - R - LABEL_GAP)
      expect(pos.y).toBeLessThan(bottomSwatch.y)
      expect(pos.y).toBeLessThanOrEqual(H)
    })
  })

  describe("labelPosition 'beside' (float)", () => {
    it("places the label to the right of a left-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "left", "beside", R, W, H)
      expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
      expect(pos.x).toBeGreaterThan(swatchPos.x)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("places the label to the left of a right-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "right", "beside", R, W, H)
      expect(pos.x).toBe(swatchPos.x - R - LABEL_GAP)
      expect(pos.x).toBeLessThan(swatchPos.x)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("defaults to the right side for top/bottom/auto swatches", () => {
      for (const side of ["top", "bottom", "auto"] as const) {
        const pos = getLabelPosition(swatchPos, side, "beside", R, W, H)
        expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
        expect(pos.y).toBe(swatchPos.y)
      }
    })
  })

  describe("labelPosition 'none' (minimal)", () => {
    it("uses the same rule as 'beside' so a field still appears next to the swatch", () => {
      const left = getLabelPosition(swatchPos, "left", "none", R, W, H)
      expect(left.x).toBe(swatchPos.x + R + LABEL_GAP)
      expect(left.y).toBe(swatchPos.y)

      const right = getLabelPosition(swatchPos, "right", "none", R, W, H)
      expect(right.x).toBe(swatchPos.x - R - LABEL_GAP)
      expect(right.y).toBe(swatchPos.y)
    })
  })

  describe("clamps the anchor into canvas bounds", () => {
    it("never returns a negative x for a left-edge swatch near the corner", () => {
      // A right-side label off a right-edge swatch can underflow past 0 on a
      // narrow canvas; clamp pins it to 0.
      const narrow = getLabelPosition({ x: 4, y: 300 }, "right", "beside", R, W, H)
      expect(narrow.x).toBe(0)
    })

    it("never returns x beyond canvasWidth for a right-side label", () => {
      const pos = getLabelPosition({ x: W - 2, y: 300 }, "left", "beside", R, W, H)
      expect(pos.x).toBe(W)
    })

    it("never returns y beyond canvasHeight for a 'below' top-edge swatch near the floor", () => {
      const pos = getLabelPosition({ x: 200, y: H - 2 }, "top", "below", R, W, H)
      expect(pos.y).toBe(H)
    })
  })
})
