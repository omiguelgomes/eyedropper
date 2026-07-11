import { describe, it, expect, vi } from "vitest"

// next/font/google is a build-time transform that fails under Vitest. Its exports
// are all called the same way (options object → { style.fontFamily, variable }),
// so a Proxy returns a deterministic stub for EVERY font name the module imports,
// keeping this mock stable as the font list grows.
vi.mock("next/font/google", () => ({
  __esModule: true,
  default: undefined,
  ...new Proxy(
    {},
    {
      get: (_t, name: string) => () => ({
        style: { fontFamily: String(name) },
        variable: `--font-${String(name).toLowerCase()}`,
      }),
    }
  ),
}))

import { FONT_OPTIONS, FONT_CATEGORIES, fontVariables, resolveFontFamily } from "./fonts"

describe("FONT_OPTIONS", () => {
  it("has ~30 entries, all with a label/family/category", () => {
    expect(FONT_OPTIONS.length).toBeGreaterThanOrEqual(28)
    for (const o of FONT_OPTIONS) {
      expect(o.label).toBeTruthy()
      expect(o.family).toBeTruthy()
      expect(FONT_CATEGORIES).toContain(o.category)
    }
  })

  it("defaults to Cormorant Garamond Italic first (the seeded label)", () => {
    expect(FONT_OPTIONS[0].label).toBe("Cormorant Garamond Italic")
  })

  it("labels are unique", () => {
    const labels = FONT_OPTIONS.map((o) => o.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("keeps System mapped to serif, in the Serif group", () => {
    const sys = FONT_OPTIONS.find((o) => o.label === "System")!
    expect(sys.family).toBe("serif")
    expect(sys.category).toBe("Serif")
  })

  it("has at least one option per category", () => {
    for (const cat of FONT_CATEGORIES) {
      expect(FONT_OPTIONS.some((o) => o.category === cat)).toBe(true)
    }
  })

  it("exposes one CSS variable per google-font option (System has none)", () => {
    // Every option except "System" (the device serif) is backed by a webfont.
    const webfontCount = FONT_OPTIONS.filter((o) => o.label !== "System").length
    expect(fontVariables.length).toBe(webfontCount)
  })
})

describe("resolveFontFamily", () => {
  it("maps System to serif", () => {
    expect(resolveFontFamily("System")).toBe("serif")
  })

  it("maps a known label to a non-empty render family", () => {
    expect(resolveFontFamily("Cormorant Garamond Italic")).toBeTruthy()
    expect(resolveFontFamily("Caveat")).toBeTruthy()
  })

  it("falls back to the passed string for an unknown label", () => {
    expect(resolveFontFamily("nonexistent")).toBe("nonexistent")
  })

  it("falls back to serif for an empty string", () => {
    expect(resolveFontFamily("")).toBe("serif")
  })
})
