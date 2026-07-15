import { describe, it, expect } from "vitest"
import { loadStyles } from "./styles"
import { scaleStyleForDisplay } from "./style-scale"

// The chrome (swatch/connector/border) is authored as on-screen pixel references
// at 1×. scaleStyleForDisplay divides by the viewport-fit stageScale so the
// rendered on-screen size stays CONSTANT across aspect ratios / crops / image
// resolutions / window sizes (the "everything looks huge when cropped" fix), with
// the user size slider multiplying that constant. On-screen size == canvasUnits ×
// stageScale, so the invariant to check is: scaled × stageScale == base × sizeScale.
const base = loadStyles()[0]

describe("scaleStyleForDisplay", () => {
  it("keeps on-screen swatch/border size constant across stageScale (ratio-invariant)", () => {
    // Same sizeScale, wildly different stageScale (e.g. 9:16 vs 16:9 viewport fit).
    for (const stageScale of [1.76, 3.14, 4.16]) {
      const s = scaleStyleForDisplay(base, 1, stageScale)
      expect(s.swatchRadius * stageScale).toBeCloseTo(base.swatchRadius)
      expect(s.swatchBorderWidth * stageScale).toBeCloseTo(base.swatchBorderWidth)
    }
  })

  it("connector width is constant on-screen at 1× and scales with the growth axis", () => {
    // At 1× the on-screen connector width equals the authored width (no 1.5×
    // amplification at rest); the amplification only applies to growth above 1×.
    const at1 = scaleStyleForDisplay(base, 1, 3.14)
    expect(at1.connectorWidth * 3.14).toBeCloseTo(base.connectorWidth)
    // At 2× the growth (×1.5) applies: on-screen width = base × (1 + 1×1.5) = 2.5×.
    const at2 = scaleStyleForDisplay(base, 2, 3.14)
    expect(at2.connectorWidth * 3.14).toBeCloseTo(base.connectorWidth * 2.5)
  })

  it("the size slider multiplies the constant on-screen baseline", () => {
    const stageScale = 2.5
    const at1 = scaleStyleForDisplay(base, 1, stageScale)
    const at2 = scaleStyleForDisplay(base, 2, stageScale)
    // Doubling the slider doubles the on-screen swatch size, independent of ratio.
    expect(at2.swatchRadius / at1.swatchRadius).toBeCloseTo(2)
    expect(at2.swatchRadius * stageScale).toBeCloseTo(base.swatchRadius * 2)
  })

  it("treats a non-positive stageScale as 1 (no image loaded yet)", () => {
    const s = scaleStyleForDisplay(base, 1, 0)
    expect(s.swatchRadius).toBeCloseTo(base.swatchRadius)
  })

  it("carries non-size fields through unchanged", () => {
    const s = scaleStyleForDisplay(base, 1.4, 2)
    expect(s.name).toBe(base.name)
    expect(s.connectorType).toBe(base.connectorType)
    expect(s.markerColor).toBe(base.markerColor)
    expect(s.swatchTexture).toBe(base.swatchTexture)
  })
})
