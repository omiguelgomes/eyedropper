import { describe, it, expect } from "vitest"
import { parseRatio, ratiosEqual, PRESETS, DEFAULT_RATIO } from "./aspect"

describe("parseRatio", () => {
  it("parses W:H integers", () => {
    expect(parseRatio("3:2")).toEqual({ w: 3, h: 2 })
  })

  it("parses W/H with slash separator", () => {
    expect(parseRatio("16/9")).toEqual({ w: 16, h: 9 })
  })

  it("parses decimals", () => {
    expect(parseRatio("1.5:1")).toEqual({ w: 1.5, h: 1 })
    expect(parseRatio("0.5:0.25")).toEqual({ w: 0.5, h: 0.25 })
  })

  it("tolerates surrounding and inner whitespace", () => {
    expect(parseRatio("  4 : 5 ")).toEqual({ w: 4, h: 5 })
  })

  it("rejects a zero term", () => {
    expect(parseRatio("0:5")).toBeNull()
    expect(parseRatio("5:0")).toBeNull()
  })

  it("rejects negatives", () => {
    // The leading '-' isn't matched by the numeric group, so it fails to parse.
    expect(parseRatio("-3:2")).toBeNull()
  })

  it("rejects junk and empties", () => {
    expect(parseRatio("")).toBeNull()
    expect(parseRatio("abc")).toBeNull()
    expect(parseRatio("3")).toBeNull()
    expect(parseRatio("3:")).toBeNull()
    expect(parseRatio("3:2:1")).toBeNull()
  })
})

describe("ratiosEqual", () => {
  it("matches proportional ratios regardless of terms", () => {
    expect(ratiosEqual({ w: 16, h: 9 }, { w: 16, h: 9 })).toBe(true)
    expect(ratiosEqual({ w: 8, h: 4.5 }, { w: 16, h: 9 })).toBe(true)
  })

  it("distinguishes different proportions", () => {
    expect(ratiosEqual({ w: 4, h: 5 }, { w: 1, h: 1 })).toBe(false)
  })
})

describe("PRESETS / DEFAULT_RATIO", () => {
  it("defaults to 9:16 as the first preset", () => {
    expect(DEFAULT_RATIO).toEqual({ w: 9, h: 16 })
    expect(ratiosEqual(PRESETS[0], DEFAULT_RATIO)).toBe(true)
  })

  it("includes the expected common set", () => {
    expect(PRESETS.map((p) => p.label)).toEqual(["9:16", "4:5", "1:1", "4:3", "16:9"])
  })
})
