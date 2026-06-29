import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import ContextMenu from "./ContextMenu"

describe("ContextMenu", () => {
  it("renders a 'Remove point' button", () => {
    const { getByText } = render(
      <ContextMenu x={10} y={20} onRemove={vi.fn()} />
    )
    expect(getByText("Remove point")).toBeDefined()
  })

  it("calls onRemove when the button is clicked", () => {
    const onRemove = vi.fn()
    const { getByText } = render(
      <ContextMenu x={10} y={20} onRemove={onRemove} />
    )
    fireEvent.click(getByText("Remove point"))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("positions the menu at the given x/y", () => {
    const { getByTestId } = render(
      <ContextMenu x={123} y={456} onRemove={vi.fn()} />
    )
    const menu = getByTestId("context-menu")
    expect(menu.style.left).toBe("123px")
    expect(menu.style.top).toBe("456px")
  })
})
