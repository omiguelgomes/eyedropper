import { describe, it, expect } from "vitest"
import { loadStyles } from "./styles"

describe("loadStyles", () => {
  const styles = loadStyles()
  const byName = (name: string) => styles.find((s) => s.name === name)

  it("returns the 4 styles: 3 pastels + float, in order", () => {
    expect(styles).toHaveLength(4)
    expect(styles.map((s) => s.name)).toEqual([
      "pastel",
      "pastel ring",
      "pastel bold",
      "float",
    ])
  })

  it("makes ring-less pastel the default at index 0", () => {
    expect(styles[0].name).toBe("pastel")
    // The default pastel has the pencil texture but NO border ring.
    expect(styles[0].swatchTexture).toBe("/textures/swatch-pencil.png")
    expect(styles[0].borderTexture).toBeUndefined()
  })

  it("the three pastels all use the pencil texture and curved connector", () => {
    for (const name of ["pastel", "pastel ring", "pastel bold"]) {
      const s = byName(name)!
      expect(s.swatchTexture).toBe("/textures/swatch-pencil.png")
      expect(s.connectorType).toBe("curved")
    }
  })

  it("the two ringed pastels carry the thin/strong border textures", () => {
    expect(byName("pastel ring")!.borderTexture).toBe("/textures/swatch-border-thin.png")
    expect(byName("pastel bold")!.borderTexture).toBe("/textures/swatch-border.png")
  })

  it("the flat style has no texture fields (flat fallback path)", () => {
    const s = byName("float")!
    expect(s.swatchTexture).toBeUndefined()
    expect(s.borderTexture).toBeUndefined()
  })

  it("the flat style retains its known fields unchanged", () => {
    expect(byName("float")).toMatchObject({
      swatchRadius: 48,
      connectorType: "curved",
      markerStyle: "ring",
      labelPosition: "beside",
    })
  })
})
