import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import type { DistributionGuide } from "@/lib/swatch-layout"

// react-konva renders to canvas; mock Layer/Arrow to inspectable DOM (same pattern
// as SnapGuideLayer.test.tsx) so we can assert the rendered arrow geometry.
vi.mock("react-konva", () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="layer">{children}</div>
  ),
  Arrow: ({ points, stroke }: { points: number[]; stroke?: string }) => (
    <div data-testid="arrow" data-points={JSON.stringify(points)} data-stroke={stroke} />
  ),
}))

import DistributionGuideLayer from "./DistributionGuideLayer"

const SCALE = 0.5

describe("DistributionGuideLayer", () => {
  it("renders nothing when distribution is empty", () => {
    const { queryByTestId, queryAllByTestId } = render(
      <DistributionGuideLayer distribution={[]} scale={SCALE} />
    )
    expect(queryByTestId("layer")).toBeNull()
    expect(queryAllByTestId("arrow")).toHaveLength(0)
  })

  it("renders nothing when a guide has fewer than 2 marks", () => {
    const dist: DistributionGuide[] = [{ axis: "y", alignPos: 150, marks: [100] }]
    const { queryAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    expect(queryAllByTestId("arrow")).toHaveLength(0)
  })

  it("draws one double-headed arrow per gap (N marks → N−1 arrows)", () => {
    // 3 marks → 2 gaps → 2 arrows.
    const dist: DistributionGuide[] = [{ axis: "y", alignPos: 150, marks: [100, 200, 300] }]
    const { getAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    expect(getAllByTestId("arrow")).toHaveLength(2)
  })

  it("vertical column (axis 'y'): arrows run along Y, offset in +x from alignPos", () => {
    const dist: DistributionGuide[] = [{ axis: "y", alignPos: 150, marks: [100, 300] }]
    const { getAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    const arrows = getAllByTestId("arrow").map((l) => JSON.parse(l.getAttribute("data-points")!))
    // off = 16/0.5 = 32; mx = 150 + 32 = 182.
    const mx = 182
    expect(arrows[0]).toEqual([mx, 100, mx, 300])
  })

  it("horizontal row (axis 'x'): arrows run along X, offset in +y from alignPos", () => {
    const dist: DistributionGuide[] = [{ axis: "x", alignPos: 600, marks: [120, 320] }]
    const { getAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    const arrows = getAllByTestId("arrow").map((l) => JSON.parse(l.getAttribute("data-points")!))
    const my = 632 // 600 + 32
    expect(arrows[0]).toEqual([120, my, 320, my])
  })

  it("renders both cues at once (a swatch centred in both a row and a column)", () => {
    const dist: DistributionGuide[] = [
      { axis: "x", alignPos: 600, marks: [120, 320] }, // row: 1 gap
      { axis: "y", alignPos: 150, marks: [100, 200, 300] }, // column: 2 gaps
    ]
    const { getAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    expect(getAllByTestId("arrow")).toHaveLength(3)
  })

  it("uses the distinct equal-distance accent color (not the tan alignment color)", () => {
    const dist: DistributionGuide[] = [{ axis: "y", alignPos: 150, marks: [100, 300] }]
    const { getAllByTestId } = render(
      <DistributionGuideLayer distribution={dist} scale={SCALE} />
    )
    expect(getAllByTestId("arrow")[0].getAttribute("data-stroke")).toBe("#2dd4bf")
  })
})
