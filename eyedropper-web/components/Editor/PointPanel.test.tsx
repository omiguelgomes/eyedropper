import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import PointPanel from "./PointPanel"

const DEFAULT_PROPS = {
  pointNumber: 3,
  color: "#8b5e52",
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

  it("no longer renders the 'Swatch side' control (Story 5.1 — swatches are freely placed)", () => {
    const { queryByText, queryByRole } = render(<PointPanel {...DEFAULT_PROPS} />)
    expect(queryByText("Swatch side")).toBeNull()
    for (const side of ["auto", "left", "right", "top", "bottom"]) {
      expect(queryByRole("button", { name: side })).toBeNull()
    }
  })

  it("clicking the remove button calls onRemove (AC3)", () => {
    const onRemove = vi.fn()
    const { getByText } = render(<PointPanel {...DEFAULT_PROPS} onRemove={onRemove} />)
    fireEvent.click(getByText("× Remove this point"))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
