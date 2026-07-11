import { describe, it, expect, vi } from "vitest"

// measure-text imports ./fonts (→ next/font/google, a build-time transform that
// fails under Vitest). These tests only hit the jsdom fallback branch, where
// resolveFontFamily is never called, so stub ./fonts wholesale.
vi.mock("./fonts", () => ({
  resolveFontFamily: (s: string) => s,
}))

import { measureLabelWidth } from "./measure-text"

describe("measureLabelWidth", () => {
  it("falls back to a length*fontSize estimate when no 2D context (jsdom)", () => {
    // jsdom's canvas has no 2D backend, so this exercises the fallback branch.
    const w = measureLabelWidth("Crimson", 16, "serif")
    // 7 chars * 16 * 0.55 = 61.6
    expect(w).toBeCloseTo(7 * 16 * 0.55, 5)
  })

  it("uses a minimum width of 1 char for empty text", () => {
    const w = measureLabelWidth("", 20, "serif")
    // max(0,1) * 20 * 0.55 = 11
    expect(w).toBeCloseTo(1 * 20 * 0.55, 5)
  })
})
