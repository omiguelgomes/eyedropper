import type React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import type { EyedropperPoint } from "@/lib/types"

// Mock @/lib/fonts so the component's FONT_OPTIONS import resolves without the
// real next/font transform. Provide a small grouped set spanning two categories
// so the <optgroup> rendering is exercised.
vi.mock("@/lib/fonts", () => ({
  FONT_CATEGORIES: ["Serif", "Sans"],
  FONT_OPTIONS: [
    { label: "Cormorant Garamond Italic", family: "Cormorant", category: "Serif" },
    { label: "Playfair Display Italic", family: "Playfair", category: "Serif" },
    { label: "System", family: "serif", category: "Serif" },
    { label: "Inter", family: "Inter", category: "Sans" },
    { label: "Montserrat", family: "Montserrat", category: "Sans" },
  ],
  resolveFontFamily: (s: string) => s,
}))

import LabelPanel from "./LabelPanel"

function makeLabel(overrides: Partial<EyedropperPoint["label"]> = {}): EyedropperPoint["label"] {
  return {
    text: "Crimson",
    visible: true,
    x: 100,
    y: 200,
    fontSize: 24,
    fontFamily: "Cormorant Garamond Italic",
    color: "#1a1a1a",
    ...overrides,
  }
}

// LabelPanel now requires onApplyToAll (Story 3.4). Centralize the required
// props so each test only overrides what it asserts on.
function makeProps(overrides: Partial<React.ComponentProps<typeof LabelPanel>> = {}) {
  return {
    label: makeLabel(),
    onUpdate: vi.fn(),
    onApplyToAll: vi.fn(),
    ...overrides,
  }
}

describe("LabelPanel", () => {
  it("pre-fills the text input and calls onUpdate({ text }) on change (AC2)", () => {
    const onUpdate = vi.fn()
    const { getByLabelText } = render(<LabelPanel {...makeProps({ onUpdate })} />)
    const input = getByLabelText("Label text") as HTMLInputElement
    expect(input.value).toBe("Crimson")
    fireEvent.change(input, { target: { value: "Scarlet" } })
    expect(onUpdate).toHaveBeenCalledWith({ text: "Scarlet" })
  })

  it("lists font options grouped by category and reflects label.fontFamily", () => {
    const onUpdate = vi.fn()
    const { getByLabelText } = render(<LabelPanel {...makeProps({ onUpdate })} />)
    const select = getByLabelText("Font family") as HTMLSelectElement
    // Options appear grouped, in category order (Serif then Sans).
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "Cormorant Garamond Italic",
      "Playfair Display Italic",
      "System",
      "Inter",
      "Montserrat",
    ])
    // Rendered inside <optgroup> containers, one per category.
    const groups = select.querySelectorAll("optgroup")
    expect(Array.from(groups).map((g) => g.label)).toEqual(["Serif", "Sans"])
    expect(select.value).toBe("Cormorant Garamond Italic")
    fireEvent.change(select, { target: { value: "Inter" } })
    expect(onUpdate).toHaveBeenCalledWith({ fontFamily: "Inter" })
  })

  it("renders a 12-48 size slider and calls onUpdate({ fontSize: number }) (AC4)", () => {
    const onUpdate = vi.fn()
    const { getByLabelText } = render(<LabelPanel {...makeProps({ onUpdate })} />)
    const slider = getByLabelText("Font size") as HTMLInputElement
    expect(slider.min).toBe("12")
    expect(slider.max).toBe("48")
    expect(slider.value).toBe("24")
    fireEvent.change(slider, { target: { value: "32" } })
    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 32 })
  })

  it("reflects label.color and calls onUpdate({ color }) on change (AC5)", () => {
    const onUpdate = vi.fn()
    const { getByLabelText } = render(<LabelPanel {...makeProps({ onUpdate })} />)
    const color = getByLabelText("Label color") as HTMLInputElement
    expect(color.value).toBe("#1a1a1a")
    fireEvent.change(color, { target: { value: "#ff8800" } })
    expect(onUpdate).toHaveBeenCalledWith({ color: "#ff8800" })
  })

  it("mirrors label.visible and calls onUpdate({ visible }) on toggle (AC6)", () => {
    const onUpdate = vi.fn()
    const { getByLabelText } = render(<LabelPanel {...makeProps({ onUpdate })} />)
    const checkbox = getByLabelText("Show label") as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(onUpdate).toHaveBeenCalledWith({ visible: false })
  })

  it("renders Font/Size/Color apply-to-all buttons that broadcast the field key (AC1-AC4)", () => {
    const onApplyToAll = vi.fn()
    const { getByRole } = render(<LabelPanel {...makeProps({ onApplyToAll })} />)

    const fontBtn = getByRole("button", { name: "Font" })
    const sizeBtn = getByRole("button", { name: "Size" })
    const colorBtn = getByRole("button", { name: "Color" })

    fireEvent.click(fontBtn)
    expect(onApplyToAll).toHaveBeenCalledWith("fontFamily")
    fireEvent.click(sizeBtn)
    expect(onApplyToAll).toHaveBeenCalledWith("fontSize")
    fireEvent.click(colorBtn)
    expect(onApplyToAll).toHaveBeenCalledWith("color")
  })
})
