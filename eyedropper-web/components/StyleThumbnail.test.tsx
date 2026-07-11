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
      <StyleThumbnail style={byName("float")} sampleImg={null} />
    )
    expect(getByTestId("thumbnail-placeholder")).toBeDefined()
    expect(queryByTestId("stage")).toBeNull()
  })

  it("float (curved connector, ring marker): connector lines present, markers hollow", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail style={byName("float")} sampleImg={fakeImg} />
    )
    // Curved connector → one Line per sample point.
    expect(queryAllByTestId("line").length).toBeGreaterThan(0)
    // Markers are the circles with no fill (hollow ring).
    const hollow = queryAllByTestId("circle").filter((c) => c.getAttribute("data-fill") === null)
    expect(hollow.length).toBeGreaterThan(0)
  })

  it("ring-less pastel renders the pencil (multiply) but NO border image", () => {
    // The default "pastel" style has swatchTexture but no borderTexture, so the
    // picker resolves borderTexture to null → pencil disc only, no chalk ring.
    const { queryAllByTestId } = render(
      <StyleThumbnail
        style={byName("pastel")}
        sampleImg={fakeImg}
        pencilTexture={fakeTexture}
        borderTexture={null}
      />
    )
    const gcos = queryAllByTestId("image").map((i) => i.getAttribute("data-gco"))
    expect(gcos).toContain("multiply")
    // Only the sample drawing + two pencil images per swatch (multiply +
    // destination-in); no as-is border image beyond those.
    const asIs = gcos.filter((g) => g === "")
    // The single "" entry is the sample drawing; a border image would add more.
    expect(asIs).toHaveLength(1)
  })

  it("ringed pastel renders the pencil (multiply) AND a border image", () => {
    const { queryAllByTestId } = render(
      <StyleThumbnail
        style={byName("pastel ring")}
        sampleImg={fakeImg}
        pencilTexture={fakeTexture}
        borderTexture={fakeTexture}
      />
    )
    const gcos = queryAllByTestId("image").map((i) => i.getAttribute("data-gco"))
    expect(gcos).toContain("multiply")
    // Sample drawing + one border image per sample point are drawn as-is ("").
    const asIs = gcos.filter((g) => g === "")
    expect(asIs.length).toBeGreaterThan(1)
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
