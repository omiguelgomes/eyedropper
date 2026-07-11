import { describe, it, expect } from "vitest"
import { suggestPoints, slicSegments, type RgbImage } from "./slic-suggest"

// Builds an RgbImage from a function mapping (x,y) → [r,g,b].
function makeImage(
  w: number,
  h: number,
  fn: (x: number, y: number) => [number, number, number]
): RgbImage {
  const data = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 3
      const [r, g, b] = fn(x, y)
      data[p] = r
      data[p + 1] = g
      data[p + 2] = b
    }
  }
  return { width: w, height: h, data }
}

describe("slicSegments", () => {
  it("labels every pixel with a valid cluster id", () => {
    const img = makeImage(60, 60, (x) => (x < 30 ? [200, 30, 30] : [30, 30, 200]))
    const labels = slicSegments(img)
    expect(labels.length).toBe(60 * 60)
    for (let i = 0; i < labels.length; i++) {
      expect(labels[i]).toBeGreaterThanOrEqual(0)
    }
  })

  it("keeps a sharp color boundary in separate segments", () => {
    const img = makeImage(60, 60, (x) => (x < 30 ? [200, 30, 30] : [30, 30, 200]))
    const labels = slicSegments(img)
    // A pixel deep in the red region and one deep in the blue region should
    // never share a label.
    const leftLabel = labels[30 * 60 + 5]
    const rightLabel = labels[30 * 60 + 55]
    expect(leftLabel).not.toBe(rightLabel)
  })
})

describe("suggestPoints", () => {
  it("returns points inside a colored subject on a uniform background", () => {
    // White background with a red square in the middle. Image is sized so the
    // default segment size comfortably exceeds the default minSize threshold.
    const img = makeImage(200, 200, (x, y) => {
      const inSquare = x >= 60 && x < 140 && y >= 60 && y < 140
      return inSquare ? [220, 20, 20] : [255, 255, 255]
    })
    const points = suggestPoints(img)
    expect(points.length).toBeGreaterThan(0)
    // Every returned point should fall on the red square, not the white bg.
    for (const pt of points) {
      expect(pt.x).toBeGreaterThanOrEqual(55)
      expect(pt.x).toBeLessThan(145)
      expect(pt.y).toBeGreaterThanOrEqual(55)
      expect(pt.y).toBeLessThan(145)
    }
  })

  it("returns hex colors near the sampled region color", () => {
    const img = makeImage(200, 200, (x, y) => {
      const inSquare = x >= 60 && x < 140 && y >= 60 && y < 140
      return inSquare ? [220, 20, 20] : [255, 255, 255]
    })
    const points = suggestPoints(img)
    expect(points[0].color).toMatch(/^#[0-9a-f]{6}$/)
    // Red-dominant: R channel should be the largest.
    const r = parseInt(points[0].color.slice(1, 3), 16)
    const g = parseInt(points[0].color.slice(3, 5), 16)
    expect(r).toBeGreaterThan(g)
  })

  it("returns no points for an all-background image", () => {
    const img = makeImage(60, 60, () => [128, 128, 128])
    const points = suggestPoints(img)
    expect(points).toEqual([])
  })

  it("caps the result at nPoints", () => {
    // Noisy multicolor image → many diverse candidates.
    const img = makeImage(200, 200, (x, y) => [
      (x * 5) % 256,
      (y * 5) % 256,
      ((x + y) * 3) % 256,
    ])
    const points = suggestPoints(img, 6)
    expect(points.length).toBeLessThanOrEqual(6)
  })

  it("orders greedily: the seed is the most background-distinct region", () => {
    // Background gray; a bright magenta square (very far from gray) and a
    // dull square (closer to gray). Seed should land on the magenta one.
    const img = makeImage(200, 200, (x, y) => {
      if (x >= 30 && x < 90 && y >= 30 && y < 90) return [255, 0, 255] // magenta
      if (x >= 120 && x < 180 && y >= 120 && y < 180) return [150, 150, 150] // dull
      return [128, 128, 128]
    })
    const points = suggestPoints(img)
    expect(points.length).toBeGreaterThan(0)
    // First (seed) point sits in the magenta square's quadrant.
    expect(points[0].x).toBeLessThan(100)
    expect(points[0].y).toBeLessThan(100)
  })
})
