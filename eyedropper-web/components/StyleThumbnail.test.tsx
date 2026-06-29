import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { loadStyles } from "@/lib/styles"

// react-konva renders to a real canvas; mock the primitives to DOM nodes that
// record the props we assert on (same precedent as EyedropperLayer.test.tsx).
vi.mock("react-konva", () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: { children?: React.ReactNode }) => <div data-testid="layer">{children}</div>,
  Image: () => <div data-testid="image" />,
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
})
