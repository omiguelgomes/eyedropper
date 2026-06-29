import { describe, it, expect } from "vitest"
import { canvasTo916 } from "./canvas-to-916"

describe("canvasTo916", () => {
  it("canvasWidth equals imageWidth", () => {
    const result = canvasTo916(800, 600)
    expect(result.canvasWidth).toBe(800)
  })

  it("canvasHeight equals round(imageWidth * 16/9)", () => {
    const result = canvasTo916(800, 600)
    expect(result.canvasHeight).toBe(Math.round(800 * 16 / 9))
  })

  it("imageOffsetY centers image vertically when image is shorter than 9:16 height", () => {
    // 800×600: canvasHeight = round(800*16/9) = 1422, image is 600 tall
    // imageOffsetY should be round((1422 - 600) / 2) = 411
    const result = canvasTo916(800, 600)
    const canvasHeight = Math.round(800 * 16 / 9)
    expect(result.imageOffsetY).toBe(Math.round((canvasHeight - 600) / 2))
  })

  it("imageOffsetY is 0 when imageHeight equals canvasHeight", () => {
    // Width 900, height = round(900*16/9) = 1600 — exactly fills
    const w = 900
    const h = Math.round(w * 16 / 9)
    const result = canvasTo916(w, h)
    expect(result.imageOffsetY).toBe(0)
  })

  it("imageOffsetY is 0 when imageHeight exceeds canvasHeight", () => {
    // A very tall image: 800×2000 → canvasHeight = 1422 < 2000
    const result = canvasTo916(800, 2000)
    expect(result.imageOffsetY).toBe(0)
  })

  it("returns correct shape for a standard portrait image", () => {
    const result = canvasTo916(1080, 1350)
    expect(result).toHaveProperty("canvasWidth", 1080)
    expect(result).toHaveProperty("canvasHeight", Math.round(1080 * 16 / 9))
    expect(result).toHaveProperty("imageOffsetY")
  })

  it("returns all zeros for zero width", () => {
    expect(canvasTo916(0, 0)).toEqual({ canvasWidth: 0, canvasHeight: 0, imageOffsetY: 0 })
  })

  it("rounds imageOffsetY for an odd vertical gap", () => {
    // 800×601: canvasHeight = round(800*16/9) = 1422, gap = 1422 - 601 = 821 (odd)
    // imageOffsetY = round(821 / 2) = round(410.5) = 411
    const result = canvasTo916(800, 601)
    expect(result.imageOffsetY).toBe(411)
  })
})
