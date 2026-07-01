import { describe, it, expect } from "vitest"
import { loadStyles } from "./styles"

describe("loadStyles", () => {
  const styles = loadStyles()
  const byName = (name: string) => styles.find((s) => s.name === name)

  it("returns 5 styles including pastel (Story 3.5)", () => {
    expect(styles).toHaveLength(5)
    expect(styles.map((s) => s.name)).toEqual([
      "float_clean",
      "float",
      "grid",
      "minimal",
      "pastel",
    ])
  })

  it("keeps float_clean as the default at index 0", () => {
    expect(styles[0].name).toBe("float_clean")
  })

  it("pastel carries the two texture paths", () => {
    const pastel = byName("pastel")!
    expect(pastel.swatchTexture).toBe("/textures/swatch-pencil.png")
    expect(pastel.borderTexture).toBe("/textures/swatch-border.png")
  })

  it("pastel reuses the existing curved connector (no textured-connector field)", () => {
    expect(byName("pastel")!.connectorType).toBe("curved")
  })

  it("the four existing styles have no texture fields (flat fallback path)", () => {
    for (const name of ["float_clean", "float", "grid", "minimal"]) {
      const s = byName(name)!
      expect(s.swatchTexture).toBeUndefined()
      expect(s.borderTexture).toBeUndefined()
    }
  })

  it("the four existing styles retain their known fields unchanged (AC2/AC4 regression guard)", () => {
    expect(byName("float_clean")).toMatchObject({
      swatchRadius: 48,
      connectorType: "curved",
      markerStyle: "ring",
      labelPosition: "none",
    })
    expect(byName("float")).toMatchObject({ connectorType: "curved", labelPosition: "beside" })
    expect(byName("grid")).toMatchObject({ connectorType: "none", markerStyle: "dot", labelPosition: "below" })
    expect(byName("minimal")).toMatchObject({
      swatchRadius: 40,
      connectorType: "straight",
      markerStyle: "none",
      labelPosition: "none",
    })
  })
})
