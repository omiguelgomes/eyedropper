import { describe, it, expect } from "vitest"
import { getLabelPosition, LABEL_GAP } from "./label-layout"

const R = 48
const W = 800
const H = 1422
const LW = 60   // label width
const LH = 16   // label height
const swatchPos = { x: 200, y: 300 }

describe("getLabelPosition", () => {
  describe("labelPosition 'below'", () => {
    it("centers the label origin under a top-edge swatch (origin = centerX - width/2)", () => {
      const pos = getLabelPosition(swatchPos, "top", "below", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x - LW / 2)
      expect(pos.y).toBe(swatchPos.y + R + LABEL_GAP)
    })

    it("places the label ABOVE a bottom-edge swatch so it stays on-canvas", () => {
      const bottomSwatch = { x: 200, y: H - R }
      const pos = getLabelPosition(bottomSwatch, "bottom", "below", R, W, H, LW, LH)
      expect(pos.x).toBe(bottomSwatch.x - LW / 2)
      expect(pos.y).toBe(bottomSwatch.y - R - LABEL_GAP)
      expect(pos.y).toBeLessThan(bottomSwatch.y)
    })
  })

  describe("labelPosition 'beside'", () => {
    it("places the label to the right of a left-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "left", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("places the label to the left of a right-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "right", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x - R - LABEL_GAP)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("defaults to the right side for top/bottom/auto swatches", () => {
      for (const side of ["top", "bottom", "auto"] as const) {
        const pos = getLabelPosition(swatchPos, side, "beside", R, W, H, LW, LH)
        expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
        expect(pos.y).toBe(swatchPos.y)
      }
    })
  })

  describe("clamps the whole box into canvas bounds", () => {
    it("never lets a right-side label overflow the right edge", () => {
      // A right-side label off a left-edge swatch near the right wall would push
      // its right edge past W; clamp pins origin to W - labelWidth.
      const pos = getLabelPosition({ x: W - 2, y: 300 }, "left", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(W - LW)
    })

    it("never returns a negative x", () => {
      const pos = getLabelPosition({ x: 4, y: 300 }, "right", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(0)
    })

    it("never lets the box overflow the bottom edge", () => {
      const pos = getLabelPosition({ x: 200, y: H - 2 }, "top", "below", R, W, H, LW, LH)
      expect(pos.y).toBe(H - LH)
    })
  })
})
