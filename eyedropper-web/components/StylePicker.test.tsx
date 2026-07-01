import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { loadStyles } from "@/lib/styles"

// StyleThumbnail renders a Konva Stage, which doesn't work in jsdom. The picker
// test only cares about button structure/selection, so stub the thumbnail to a
// simple DOM node that echoes which style it received.
vi.mock("./StyleThumbnail", () => ({
  default: ({ style }: { style: { name: string } }) => (
    <div data-testid="thumbnail" data-style={style.name} />
  ),
}))

import StylePicker from "./StylePicker"

const STYLES = loadStyles()

describe("StylePicker", () => {
  it("renders one button per style (5 built-in styles incl. pastel)", () => {
    const { getAllByRole } = render(
      <StylePicker styles={STYLES} activeStyleName="float_clean" onSelect={vi.fn()} />
    )
    const buttons = getAllByRole("button")
    expect(buttons).toHaveLength(5)
    const names = buttons.map((b) => b.textContent)
    expect(names).toEqual(["float_clean", "float", "grid", "minimal", "pastel"])
  })

  it("marks only the active style button aria-pressed='true'", () => {
    const { getByText } = render(
      <StylePicker styles={STYLES} activeStyleName="grid" onSelect={vi.fn()} />
    )
    const button = (name: string) => getByText(name).closest("button")!
    expect(button("grid").getAttribute("aria-pressed")).toBe("true")
    expect(button("float_clean").getAttribute("aria-pressed")).toBe("false")
    expect(button("float").getAttribute("aria-pressed")).toBe("false")
    expect(button("minimal").getAttribute("aria-pressed")).toBe("false")
  })

  it("the active button carries the accent border class", () => {
    const { getByText } = render(
      <StylePicker styles={STYLES} activeStyleName="float" onSelect={vi.fn()} />
    )
    const activeButton = getByText("float").closest("button")!
    expect(activeButton.className).toContain("border-[var(--color-accent)]")
    const inactiveButton = getByText("grid").closest("button")!
    expect(inactiveButton.className).toContain("border-[var(--color-border)]")
  })

  it("clicking a non-active button calls onSelect with that full style object", () => {
    const onSelect = vi.fn()
    const { getByText } = render(
      <StylePicker styles={STYLES} activeStyleName="float_clean" onSelect={onSelect} />
    )
    fireEvent.click(getByText("grid").closest("button")!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    const arg = onSelect.mock.calls[0][0]
    expect(arg.name).toBe("grid")
    expect(arg.markerStyle).toBe("dot")
    expect(arg.connectorType).toBe("none")
  })

  it("pastel is selectable and highlights when active (Story 3.5 AC1)", () => {
    const onSelect = vi.fn()
    const { getByText, rerender } = render(
      <StylePicker styles={STYLES} activeStyleName="float_clean" onSelect={onSelect} />
    )
    const pastelBtn = getByText("pastel").closest("button")!
    expect(pastelBtn.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(pastelBtn)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].name).toBe("pastel")
    expect(onSelect.mock.calls[0][0].swatchTexture).toBe("/textures/swatch-pencil.png")
    rerender(<StylePicker styles={STYLES} activeStyleName="pastel" onSelect={onSelect} />)
    const activePastel = getByText("pastel").closest("button")!
    expect(activePastel.getAttribute("aria-pressed")).toBe("true")
    expect(activePastel.className).toContain("border-[var(--color-accent)]")
  })

  it("passes each style down to its thumbnail", () => {
    const { getAllByTestId } = render(
      <StylePicker styles={STYLES} activeStyleName="float_clean" onSelect={vi.fn()} />
    )
    const thumbs = getAllByTestId("thumbnail")
    expect(thumbs.map((t) => t.getAttribute("data-style"))).toEqual([
      "float_clean",
      "float",
      "grid",
      "minimal",
      "pastel",
    ])
  })
})
