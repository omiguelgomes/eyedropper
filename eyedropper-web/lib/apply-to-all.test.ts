import { describe, it, expect } from "vitest"
import type { EyedropperPoint } from "./types"
import { applyFieldToAll } from "./apply-to-all"

function makePoint(id: string, overrides: Partial<EyedropperPoint["label"]> = {}): EyedropperPoint {
  return {
    id,
    x: 10,
    y: 20,
    color: "#abcdef",
    swatchSide: "auto",
    swatchOrder: null,
    label: {
      text: `label-${id}`,
      visible: true,
      x: 100,
      y: 200,
      fontSize: 24,
      fontFamily: "Inter",
      color: "#1a1a1a",
      ...overrides,
    },
  }
}

describe("applyFieldToAll", () => {
  it("copies the selected point's fontFamily to every point", () => {
    const points = [
      makePoint("a", { fontFamily: "Playfair Display Italic" }),
      makePoint("b", { fontFamily: "Inter" }),
      makePoint("c", { fontFamily: "System" }),
    ]
    const result = applyFieldToAll(points, "a", "fontFamily")
    expect(result.map((p) => p.label.fontFamily)).toEqual([
      "Playfair Display Italic",
      "Playfair Display Italic",
      "Playfair Display Italic",
    ])
  })

  it("copies the selected point's fontSize to every point", () => {
    const points = [makePoint("a", { fontSize: 40 }), makePoint("b", { fontSize: 12 })]
    const result = applyFieldToAll(points, "a", "fontSize")
    expect(result.map((p) => p.label.fontSize)).toEqual([40, 40])
  })

  it("copies the selected point's color to every point", () => {
    const points = [makePoint("a", { color: "#ff8800" }), makePoint("b", { color: "#000000" })]
    const result = applyFieldToAll(points, "a", "color")
    expect(result.map((p) => p.label.color)).toEqual(["#ff8800", "#ff8800"])
  })

  it("leaves other label fields untouched (text, x, y, visible, and the two non-applied font fields)", () => {
    const points = [
      makePoint("a", { fontSize: 40, fontFamily: "Inter", color: "#ff8800" }),
      makePoint("b", { text: "keep-me", x: 5, y: 6, visible: false, fontFamily: "System", color: "#111111" }),
    ]
    const result = applyFieldToAll(points, "a", "fontSize")
    // fontSize broadcast
    expect(result[1].label.fontSize).toBe(40)
    // everything else on b is preserved
    expect(result[1].label.text).toBe("keep-me")
    expect(result[1].label.x).toBe(5)
    expect(result[1].label.y).toBe(6)
    expect(result[1].label.visible).toBe(false)
    expect(result[1].label.fontFamily).toBe("System")
    expect(result[1].label.color).toBe("#111111")
  })

  it("returns the array unchanged when selectedId is null", () => {
    const points = [makePoint("a"), makePoint("b")]
    expect(applyFieldToAll(points, null, "fontSize")).toBe(points)
  })

  it("returns the array unchanged when selectedId matches no point", () => {
    const points = [makePoint("a"), makePoint("b")]
    expect(applyFieldToAll(points, "missing", "fontSize")).toBe(points)
  })
})
