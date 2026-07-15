import { describe, it, expect } from "vitest"
import { sampleColor } from "./color-sample"

function makeCtx(pixelData: Uint8ClampedArray, width = 100, height = 100) {
  const calls: { x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    canvas: { width, height },
    getImageData: (x: number, y: number, w: number, h: number) => {
      calls.push({ x, y, w, h })
      return { data: pixelData }
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

function solidPixels(r: number, g: number, b: number, count = 64): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
  return data
}

describe("sampleColor", () => {
  it("returns correct hex average for a solid-color 8×8 pixel block", () => {
    const { ctx } = makeCtx(solidPixels(255, 128, 0))
    const result = sampleColor(ctx, 50, 50)
    expect(result).toBe("#ff8000")
  })

  it("returns a valid 7-character hex string", () => {
    const { ctx } = makeCtx(solidPixels(0, 0, 0))
    const result = sampleColor(ctx, 50, 50)
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("clamps x/y at canvas edges — coord 2 on 10×10 canvas reads from (0,0)", () => {
    const { ctx, calls } = makeCtx(solidPixels(100, 150, 200), 10, 10)
    // x=2, y=2: clamped to (4,4) → cx-4=0, cy-4=0 → reads from (0,0,8,8)
    const result = sampleColor(ctx, 2, 2)
    expect(result).toBe("#6496c8")
    // Verify the actual read region, not just the averaged color
    expect(calls).toEqual([{ x: 0, y: 0, w: 8, h: 8 }])
  })

  it("clamps x at right edge — x = canvasWidth - 2 clamps to width - 4", () => {
    const { ctx, calls } = makeCtx(solidPixels(10, 20, 30), 100, 100)
    // x = 98 → clamped to 96 (width-4); read starts at cx-4 = 92
    const result = sampleColor(ctx, 98, 50)
    expect(result).toBe("#0a141e")
    expect(calls).toEqual([{ x: 92, y: 46, w: 8, h: 8 }])
  })

  it("handles solid black — returns #000000", () => {
    const { ctx } = makeCtx(solidPixels(0, 0, 0))
    expect(sampleColor(ctx, 50, 50)).toBe("#000000")
  })

  it("handles solid white — returns #ffffff", () => {
    const { ctx } = makeCtx(solidPixels(255, 255, 255))
    expect(sampleColor(ctx, 50, 50)).toBe("#ffffff")
  })

  it("defaults to the original 8×8 box when no size is given", () => {
    const { ctx, calls } = makeCtx(solidPixels(1, 2, 3))
    sampleColor(ctx, 50, 50)
    expect(calls).toEqual([{ x: 46, y: 46, w: 8, h: 8 }])
  })

  it("size controls the sampled box edge: size=16 → 16×16 region", () => {
    const { ctx, calls } = makeCtx(solidPixels(1, 2, 3, 256), 100, 100)
    const result = sampleColor(ctx, 50, 50, 16)
    // 16×16 = 256 pixels averaged; still the solid color.
    expect(result).toBe("#010203")
    expect(calls).toEqual([{ x: 42, y: 42, w: 16, h: 16 }])
  })

  it("size=1 reads a true single pixel", () => {
    const { ctx, calls } = makeCtx(solidPixels(9, 8, 7, 1), 100, 100)
    const result = sampleColor(ctx, 50, 50, 1)
    expect(result).toBe("#090807")
    expect(calls).toEqual([{ x: 50, y: 50, w: 1, h: 1 }])
  })

  it("averages a larger patch: size=16 over a half-red/half-black region", () => {
    // 16×16 = 256 pixels; first half red (255,0,0), second half black.
    const data = new Uint8ClampedArray(256 * 4)
    for (let i = 0; i < 128; i++) {
      data[i * 4] = 255
      data[i * 4 + 3] = 255
    }
    const { ctx } = makeCtx(data, 100, 100)
    // Mean red = 255 * 128/256 = 127.5 → round 128 = 0x80.
    expect(sampleColor(ctx, 50, 50, 16)).toBe("#800000")
  })

  it("clamps the box to the canvas so a large size never reads off-canvas", () => {
    // size 20 on a 10×10 canvas clamps the edge to 10 → 10×10 read at (0,0).
    const { ctx, calls } = makeCtx(solidPixels(5, 6, 7, 100), 10, 10)
    const result = sampleColor(ctx, 5, 5, 20)
    expect(result).toBe("#050607")
    expect(calls).toEqual([{ x: 0, y: 0, w: 10, h: 10 }])
  })
})
