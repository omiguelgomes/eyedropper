import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import AspectPicker from "./AspectPicker"
import { DEFAULT_RATIO } from "@/lib/aspect"

describe("AspectPicker", () => {
  it("applies a preset ratio on click", () => {
    const onSelect = vi.fn()
    const { getByText } = render(<AspectPicker ratio={DEFAULT_RATIO} onSelect={onSelect} />)
    fireEvent.click(getByText("1:1"))
    expect(onSelect).toHaveBeenCalledWith({ w: 1, h: 1 })
  })

  it("marks the active preset with aria-pressed", () => {
    const { getByText } = render(<AspectPicker ratio={{ w: 4, h: 5 }} onSelect={vi.fn()} />)
    expect(getByText("4:5").getAttribute("aria-pressed")).toBe("true")
    expect(getByText("1:1").getAttribute("aria-pressed")).toBe("false")
  })

  it("applies a valid custom ratio via the Set button", () => {
    const onSelect = vi.fn()
    const { getByLabelText, getByText } = render(
      <AspectPicker ratio={DEFAULT_RATIO} onSelect={onSelect} />
    )
    fireEvent.change(getByLabelText("Custom aspect ratio"), { target: { value: "3:2" } })
    fireEvent.click(getByText("Set"))
    expect(onSelect).toHaveBeenCalledWith({ w: 3, h: 2 })
  })

  it("shows an invalid state and does not apply a bad custom value", () => {
    const onSelect = vi.fn()
    const { getByLabelText, getByText, queryByText } = render(
      <AspectPicker ratio={DEFAULT_RATIO} onSelect={onSelect} />
    )
    fireEvent.change(getByLabelText("Custom aspect ratio"), { target: { value: "abc" } })
    expect(queryByText("Use W:H, e.g. 3:2")).not.toBeNull()
    // Set is disabled; clicking does nothing.
    fireEvent.click(getByText("Set"))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("applies a custom ratio on Enter", () => {
    const onSelect = vi.fn()
    const { getByLabelText } = render(<AspectPicker ratio={DEFAULT_RATIO} onSelect={onSelect} />)
    const input = getByLabelText("Custom aspect ratio")
    fireEvent.change(input, { target: { value: "2:3" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onSelect).toHaveBeenCalledWith({ w: 2, h: 3 })
  })
})
