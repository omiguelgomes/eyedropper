import { describe, it, expect, vi } from "vitest"

// next/font/google is a build-time transform that fails under Vitest — stub each
// font the module imports so it resolves to a deterministic family/variable.
vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ style: { fontFamily: "Cormorant" }, variable: "--font-cormorant" }),
  Playfair_Display: () => ({ style: { fontFamily: "Playfair" }, variable: "--font-playfair" }),
  Inter: () => ({ style: { fontFamily: "Inter" }, variable: "--font-inter" }),
  DM_Serif_Display: () => ({ style: { fontFamily: "DMSerif" }, variable: "--font-dm-serif" }),
  Libre_Baskerville: () => ({ style: { fontFamily: "Libre" }, variable: "--font-libre" }),
}))

import { FONT_OPTIONS, resolveFontFamily } from "./fonts"

describe("FONT_OPTIONS", () => {
  it("has exactly 6 entries in the AC7 order", () => {
    expect(FONT_OPTIONS.map((o) => o.label)).toEqual([
      "Cormorant Garamond Italic",
      "Playfair Display Italic",
      "Inter",
      "DM Serif Display",
      "Libre Baskerville Italic",
      "System",
    ])
  })

  it("defaults to Cormorant Garamond Italic first", () => {
    expect(FONT_OPTIONS[0].label).toBe("Cormorant Garamond Italic")
  })

  it("ends with System mapped to serif", () => {
    expect(FONT_OPTIONS[FONT_OPTIONS.length - 1]).toEqual({ label: "System", family: "serif" })
  })
})

describe("resolveFontFamily", () => {
  it("maps System to serif", () => {
    expect(resolveFontFamily("System")).toBe("serif")
  })

  it("maps a known label to a non-empty render family", () => {
    expect(resolveFontFamily("Cormorant Garamond Italic")).toBeTruthy()
  })

  it("falls back to the passed string for an unknown label", () => {
    expect(resolveFontFamily("nonexistent")).toBe("nonexistent")
  })

  it("falls back to serif for an empty string", () => {
    expect(resolveFontFamily("")).toBe("serif")
  })
})
