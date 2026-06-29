import { describe, it, expect } from "vitest"
import { clampToImage } from "./drag-utils"

describe("clampToImage", () => {
  it("returns same coords when within bounds", () => {
    expect(clampToImage(100, 200, 400, 600)).toEqual({ x: 100, y: 200 })
  })
  it("clamps x to 0 when negative", () => {
    expect(clampToImage(-10, 200, 400, 600)).toEqual({ x: 0, y: 200 })
  })
  it("clamps x to canvasWidth at right edge", () => {
    expect(clampToImage(500, 200, 400, 600)).toEqual({ x: 400, y: 200 })
  })
  it("clamps y to 0 when negative", () => {
    expect(clampToImage(100, -5, 400, 600)).toEqual({ x: 100, y: 0 })
  })
  it("clamps y to imageHeight at bottom", () => {
    expect(clampToImage(100, 700, 400, 600)).toEqual({ x: 100, y: 600 })
  })
  it("clamps corner (negative x and y)", () => {
    expect(clampToImage(-10, -10, 400, 600)).toEqual({ x: 0, y: 0 })
  })
  it("returns the exact bounds when given the max coords", () => {
    expect(clampToImage(400, 600, 400, 600)).toEqual({ x: 400, y: 600 })
  })
})
