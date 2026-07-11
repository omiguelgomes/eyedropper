import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import type { EyedropperPoint } from "@/lib/types"
import { loadStyles } from "@/lib/styles"

// Mock react-konva (no canvas in jsdom) — Layer/Text → DOM with data-* attrs.
vi.mock("react-konva", () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="label-layer">{children}</div>
  ),
  Text: (props: { text: string; x: number; y: number; fill?: string; fontSize?: number }) => (
    <div
      data-testid="label-text"
      data-text={props.text}
      data-x={props.x}
      data-y={props.y}
      data-fill={props.fill}
      data-fontsize={props.fontSize}
    />
  ),
}))

// LabelLayer imports @/lib/fonts (→ next/font/google, a build-time transform
// that fails under Vitest). Stub it so resolveFontFamily is a deterministic
// identity and FONT_OPTIONS resolves without the real font loader.
vi.mock("@/lib/fonts", () => ({
  FONT_OPTIONS: [],
  resolveFontFamily: (s: string) => s,
}))

import LabelLayer from "./LabelLayer"

const styles = loadStyles()
const styleByName = (name: string) => styles.find((s) => s.name === name)!

function makePoint(
  id: string,
  overrides: Omit<Partial<EyedropperPoint>, "label"> & {
    label?: Partial<EyedropperPoint["label"]>
  } = {}
): EyedropperPoint {
  const { label, ...rest } = overrides
  return {
    id,
    x: 100,
    y: 200,
    color: "#ff0000",
    swatchSide: "left",
    swatchOrder: 300,
    swatchX: null,
    swatchY: null,
    connectorMid: null,
    label: {
      text: "Crimson",
      visible: true,
      x: 0,
      y: 0,
      fontSize: 16,
      fontFamily: "serif",
      color: "#1a1a1a",
      ...label,
    },
    ...rest,
  }
}

const DEFAULT = { canvasWidth: 800, canvasHeight: 1422 }

describe("LabelLayer", () => {
  it("renders one Text per visible point for a 'beside' style (float)", () => {
    const points = [makePoint("p1"), makePoint("p2")]
    const { getAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    const texts = getAllByTestId("label-text")
    expect(texts).toHaveLength(2)
    expect(texts[0].getAttribute("data-text")).toBe("Crimson")
  })

  it("renders one Text per visible point for a 'below' style (grid)", () => {
    const points = [makePoint("p1")]
    const { getAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("grid")} {...DEFAULT} />
    )
    expect(getAllByTestId("label-text")).toHaveLength(1)
  })

  it("renders NO Text for a labelPosition 'none' style (minimal)", () => {
    const points = [makePoint("p1")]
    const { queryAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("minimal")} {...DEFAULT} />
    )
    expect(queryAllByTestId("label-text")).toHaveLength(0)
  })

  it("skips a point whose label.visible is false", () => {
    const points = [makePoint("p1", { label: { visible: false } }), makePoint("p2")]
    const { getAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    expect(getAllByTestId("label-text")).toHaveLength(1)
  })

  it("skips a point whose swatchOrder is null (not laid out)", () => {
    const points = [makePoint("p1", { swatchOrder: null }), makePoint("p2")]
    const { getAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    expect(getAllByTestId("label-text")).toHaveLength(1)
  })

  it("skips a point whose label.text is empty", () => {
    const points = [makePoint("p1", { label: { text: "" } }), makePoint("p2")]
    const { getAllByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    expect(getAllByTestId("label-text")).toHaveLength(1)
  })

  it("renders the Text at the stored label.x/label.y (source of truth)", () => {
    const points = [makePoint("p1", { label: { x: 321, y: 654 } })]
    const { getByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    const text = getByTestId("label-text")
    expect(text.getAttribute("data-x")).toBe("321")
    expect(text.getAttribute("data-y")).toBe("654")
  })

  it("uses the point's label color and fontSize", () => {
    const points = [makePoint("p1", { label: { color: "#abcdef", fontSize: 22 } })]
    const { getByTestId } = render(
      <LabelLayer points={points} style={styleByName("float")} {...DEFAULT} />
    )
    const text = getByTestId("label-text")
    expect(text.getAttribute("data-fill")).toBe("#abcdef")
    expect(text.getAttribute("data-fontsize")).toBe("22")
  })
})
