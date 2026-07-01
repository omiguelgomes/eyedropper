import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import type { SnapGuide } from "@/lib/swatch-layout"

// react-konva renders to canvas; mock Layer/Line to inspectable DOM (same pattern
// as EyedropperLayer.test.tsx) so we can assert the rendered guide geometry.
vi.mock("react-konva", () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="layer">{children}</div>
  ),
  Line: ({ points, stroke }: { points: number[]; stroke?: string }) => (
    <div data-testid="line" data-points={JSON.stringify(points)} data-stroke={stroke} />
  ),
}))

import SnapGuideLayer from "./SnapGuideLayer"

const CW = 400
const CH = 800
const SCALE = 0.5

describe("SnapGuideLayer", () => {
  it("renders nothing when guides is empty", () => {
    const { queryByTestId, queryAllByTestId } = render(
      <SnapGuideLayer guides={[]} canvasWidth={CW} canvasHeight={CH} scale={SCALE} />
    )
    expect(queryByTestId("layer")).toBeNull()
    expect(queryAllByTestId("line")).toHaveLength(0)
  })

  it("renders a vertical full-canvas line for an x-axis guide", () => {
    const guides: SnapGuide[] = [{ axis: "x", pos: 200 }]
    const { getAllByTestId } = render(
      <SnapGuideLayer guides={guides} canvasWidth={CW} canvasHeight={CH} scale={SCALE} />
    )
    const lines = getAllByTestId("line")
    expect(lines).toHaveLength(1)
    // Vertical line at x=200 spanning the full canvas height.
    expect(JSON.parse(lines[0].getAttribute("data-points")!)).toEqual([200, 0, 200, CH])
  })

  it("renders a horizontal full-canvas line for a y-axis guide", () => {
    const guides: SnapGuide[] = [{ axis: "y", pos: 300 }]
    const { getAllByTestId } = render(
      <SnapGuideLayer guides={guides} canvasWidth={CW} canvasHeight={CH} scale={SCALE} />
    )
    const lines = getAllByTestId("line")
    expect(lines).toHaveLength(1)
    // Horizontal line at y=300 spanning the full canvas width.
    expect(JSON.parse(lines[0].getAttribute("data-points")!)).toEqual([0, 300, CW, 300])
  })

  it("renders one Line per guide for a mixed array, with correct points per axis", () => {
    const guides: SnapGuide[] = [
      { axis: "x", pos: 100 },
      { axis: "y", pos: 250 },
      { axis: "x", pos: 380 },
    ]
    const { getAllByTestId } = render(
      <SnapGuideLayer guides={guides} canvasWidth={CW} canvasHeight={CH} scale={SCALE} />
    )
    const lines = getAllByTestId("line")
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[0].getAttribute("data-points")!)).toEqual([100, 0, 100, CH])
    expect(JSON.parse(lines[1].getAttribute("data-points")!)).toEqual([0, 250, CW, 250])
    expect(JSON.parse(lines[2].getAttribute("data-points")!)).toEqual([380, 0, 380, CH])
  })

  it("uses the accent stroke color", () => {
    const { getAllByTestId } = render(
      <SnapGuideLayer guides={[{ axis: "x", pos: 50 }]} canvasWidth={CW} canvasHeight={CH} scale={SCALE} />
    )
    expect(getAllByTestId("line")[0].getAttribute("data-stroke")).toBe("#c4956a")
  })
})
