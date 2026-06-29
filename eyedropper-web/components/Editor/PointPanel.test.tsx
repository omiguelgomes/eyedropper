import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import PointPanel from "./PointPanel"

const DEFAULT_PROPS = {
  pointNumber: 3,
  color: "#8b5e52",
  swatchSide: "auto" as const,
  onSetSide: vi.fn(),
  onRemove: vi.fn(),
}

describe("PointPanel", () => {
  it("renders the 1-based point number heading (AC1)", () => {
    const { getByText } = render(<PointPanel {...DEFAULT_PROPS} pointNumber={3} />)
    expect(getByText("Point #3")).toBeDefined()
  })

  it("renders the hex string and a preview swatch filled with the point color (AC1)", () => {
    const { getByText, getByTestId } = render(<PointPanel {...DEFAULT_PROPS} color="#8b5e52" />)
    expect(getByText("#8b5e52")).toBeDefined()
    const preview = getByTestId("point-color-preview")
    expect(preview.style.backgroundColor).toBe("rgb(139, 94, 82)") // #8b5e52
  })

  it("renders 5 side buttons; the one matching swatchSide is highlighted via aria-pressed (AC1)", () => {
    const { getByRole } = render(<PointPanel {...DEFAULT_PROPS} swatchSide="left" />)
    const sides = ["auto", "left", "right", "top", "bottom"] as const
    for (const side of sides) {
      const btn = getByRole("button", { name: side })
      expect(btn.getAttribute("aria-pressed")).toBe(side === "left" ? "true" : "false")
    }
  })

  it("clicking a side button calls onSetSide with that side (AC2)", () => {
    const onSetSide = vi.fn()
    const { getByRole } = render(<PointPanel {...DEFAULT_PROPS} onSetSide={onSetSide} />)
    fireEvent.click(getByRole("button", { name: "right" }))
    expect(onSetSide).toHaveBeenCalledWith("right")
  })

  it("clicking the remove button calls onRemove (AC3)", () => {
    const onRemove = vi.fn()
    const { getByText } = render(<PointPanel {...DEFAULT_PROPS} onRemove={onRemove} />)
    fireEvent.click(getByText("× Remove this point"))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
