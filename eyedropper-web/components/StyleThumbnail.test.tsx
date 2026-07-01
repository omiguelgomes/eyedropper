import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { loadStyles } from "@/lib/styles"

// react-konva renders to a real canvas; mock the primitives to DOM nodes that
// record the props we assert on (same precedent as EyedropperLayer.test.tsx).
vi.mock("react-konva", () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: { children?: React.ReactNode }) => <div data-testid="layer">{children}</div>,
  Group: ({ children }: { children?: React.ReactNode }) => <div data-testid="group">{children}</div>,
  Image: ({ image, globalCompositeOperation }: { image?: HTMLImageElement; globalCompositeOperation?: string }) => (
    <div data-testid="image" data-image={image ? "loaded" : "none"} data-gco={globalCompositeOperation ?? ""} />
  ),
  Line: ({ stroke }: { stroke?: string }) => <div data-testid="line" data-stroke={stroke} />,
  Circle: ({ radius, fill, stroke }: { radius?: number; fill?: string; stroke?: string }) => (
    <div data-testid="circle" data-radius={radius} data-fill={fill} data-stroke={stroke} />
  ),
}))

import StyleThumbnail from "./StyleThumbnail"

const styles = loadStyles()
const byName = (name: string) => styles.find((s) => s.name === name)!

// A minimal stand-in for the loaded sample image — the mocked Konva Image
// ignores it, so any non-null value satisfies the "loaded" branch.
const fakeImg = {} as HTMLImageElement
const fakeTexture = {} as HTMLImageElement

describe("StyleThumbnail", () => {
  it("renders a neutral placeholder (no Stage) until the sample image loads", () => {
    const { getByTestId, queryByTestId } = render(
      <StyleThumbnail style={byName("float_clean")} sampleImg={null} />
    )
    expect(getByTestId("thumbnail-placeholder")).toBeDefined()
    expect(queryByTestId("stage")).toBeNull()
  })

  it("float_clean (curved connector, ring marker): connector lines present, markers hollow", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail style={byName("float_clean")} sampleImg={fakeImg} />
    )
    // Curved connector → one Line per sample point.
    expect(queryAllByTestId("line").length).toBeGreaterThan(0)
    // Markers are the circles with no fill (hollow ring).
    const hollow = queryAllByTestId("circle").filter((c) => c.getAttribute("data-fill") === null)
    expect(hollow.length).toBeGreaterThan(0)
  })

  it("grid (no connector, dot marker): no connector lines, markers filled", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail style={byName("grid")} sampleImg={fakeImg} />
    )
    // connectorType "none" → no Line elements at all.
    expect(queryAllByTestId("line")).toHaveLength(0)
    // Dot markers are filled with the marker color.
    const filledMarkers = queryAllByTestId("circle").filter(
      (c) => c.getAttribute("data-fill") === byName("grid").markerColor
    )
    expect(filledMarkers.length).toBeGreaterThan(0)
  })

  it("minimal (straight connector, no marker): connector lines present, no hollow ring markers", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail style={byName("minimal")} sampleImg={fakeImg} />
    )
    // straight connector → Lines present.
    expect(queryAllByTestId("line").length).toBeGreaterThan(0)
    // markerStyle "none" → the only circles are swatches (all filled with a
    // point color, none hollow).
    const hollow = queryAllByTestId("circle").filter((c) => c.getAttribute("data-fill") === null)
    expect(hollow).toHaveLength(0)
  })

  it("pastel with textures supplied renders textured swatch elements (pencil multiply + border images) (AC9)", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail
        style={byName("pastel")}
        sampleImg={fakeImg}
        pencilTexture={fakeTexture}
        borderTexture={fakeTexture}
      />
    )
    // The sample drawing image plus per-swatch texture images. A pencil image
    // uses multiply; the border image is drawn as-is.
    const gcos = queryAllByTestId("image").map((i) => i.getAttribute("data-gco"))
    expect(gcos).toContain("multiply")
    // At least one flat swatch Circle should NOT be drawn (textured path replaces
    // it); markers still render as hollow rings.
    const swatchGroups = queryAllByTestId("group")
    expect(swatchGroups.length).toBeGreaterThan(0)
  })

  it("pastel with textures null falls back to flat swatch Circles, no crash (AC9)", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail
        style={byName("pastel")}
        sampleImg={fakeImg}
        pencilTexture={null}
        borderTexture={null}
      />
    )
    // No multiply texture images (only the sample drawing image, drawn as-is).
    const gcos = queryAllByTestId("image").map((i) => i.getAttribute("data-gco"))
    expect(gcos).not.toContain("multiply")
    // Flat swatch circles filled with the sample colors are present.
    const filled = queryAllByTestId("circle").filter((c) => {
      const f = c.getAttribute("data-fill")
      return f && f !== byName("pastel").markerColor
    })
    expect(filled.length).toBeGreaterThan(0)
  })
})
