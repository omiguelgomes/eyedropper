import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import type { EyedropperPoint } from "@/lib/types"
// LabelEditOverlay imports @/lib/fonts (→ next/font/google, a build-time
// transform that fails under Vitest). Stub resolveFontFamily as identity.
vi.mock("@/lib/fonts", () => ({
  FONT_OPTIONS: [],
  resolveFontFamily: (s: string) => s,
}))

import LabelEditOverlay from "./LabelEditOverlay"

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

const DEFAULT = { canvasWidth: 800, canvasHeight: 1422, scale: 0.5 }

describe("LabelEditOverlay", () => {
  it("renders one input per visible point", () => {
    const points = [makePoint("p1"), makePoint("p2")]
    const { getAllByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    expect(getAllByRole("textbox")).toHaveLength(2)
  })

  it("pre-fills each input with the point's label.text (AC3 — Claude description)", () => {
    const points = [makePoint("p1", { label: { text: "warm ochre from the wheat field" } })]
    const { getByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    expect((getByRole("textbox") as HTMLInputElement).value).toBe(
      "warm ochre from the wheat field"
    )
  })

  it("typing into an input calls onUpdateLabelText with (id, newText) (AC4)", () => {
    const onUpdateLabelText = vi.fn()
    const points = [makePoint("p1")]
    const { getByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={onUpdateLabelText}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    fireEvent.change(getByRole("textbox"), { target: { value: "Scarlet" } })
    expect(onUpdateLabelText).toHaveBeenCalledWith("p1", "Scarlet")
  })

  it("renders an input regardless of style (overlay no longer reads style) (AC2)", () => {
    const points = [makePoint("p1"), makePoint("p2")]
    const { getAllByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    expect(getAllByRole("textbox")).toHaveLength(2)
  })

  it("renders no input for a label.visible: false point", () => {
    const points = [makePoint("p1", { label: { visible: false } }), makePoint("p2")]
    const { getAllByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    expect(getAllByRole("textbox")).toHaveLength(1)
  })

  it("renders no input for a swatchOrder: null point", () => {
    const points = [makePoint("p1", { swatchOrder: null }), makePoint("p2")]
    const { getAllByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    expect(getAllByRole("textbox")).toHaveLength(1)
  })

  it("positions each label wrapper at label.x/y * scale in screen space", () => {
    // Source of truth is now the stored label.x/label.y (not the computed swatch
    // position). label.x=120, label.y=200, scale=0.5 → wrapper left=60, top=100.
    const points = [makePoint("p1", { label: { x: 120, y: 200 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        {...DEFAULT}
      />
    )
    const wrapper = getByLabelText("Drag label 1").parentElement as HTMLElement
    expect(wrapper.style.left).toBe("60px")
    expect(wrapper.style.top).toBe("100px")
  })

  it("dragging the grip calls onUpdateLabelPos with start + delta/scale (AC1)", () => {
    const onUpdateLabelPos = vi.fn()
    // label start (100, 100); scale 0.5; drag screen delta (+40, +20) →
    // canvas delta (80, 40) → new (180, 140).
    const points = [makePoint("p1", { label: { x: 100, y: 100 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={onUpdateLabelPos}
        {...DEFAULT}
      />
    )
    const grip = getByLabelText("Drag label 1")
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 200, clientY: 300 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 240, clientY: 320 })
    expect(onUpdateLabelPos).toHaveBeenCalledWith("p1", 180, 140)
  })

  it("clamps the dragged position to canvas bounds (AC1)", () => {
    const onUpdateLabelPos = vi.fn()
    // label start (10, 10); scale 0.5; drag screen delta (-100, -100) → canvas
    // delta (-200, -200) → (-190, -190) clamped to (0, 0).
    const points = [makePoint("p1", { label: { x: 10, y: 10 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={onUpdateLabelPos}
        {...DEFAULT}
      />
    )
    const grip = getByLabelText("Drag label 1")
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 200, clientY: 300 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 100, clientY: 200 })
    expect(onUpdateLabelPos).toHaveBeenCalledWith("p1", 0, 0)
  })

  it("is keyboard-focusable and arrow keys nudge the label 1px, clamped", () => {
    const onUpdateLabelPos = vi.fn()
    const points = [makePoint("p1", { label: { x: 0, y: 50 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={onUpdateLabelPos}
        {...DEFAULT}
      />
    )
    const grip = getByLabelText("Drag label 1")
    expect(grip).toHaveProperty("tabIndex", 0)
    // ArrowDown → +1 in y
    fireEvent.keyDown(grip, { key: "ArrowDown" })
    expect(onUpdateLabelPos).toHaveBeenLastCalledWith("p1", 0, 51)
    // ArrowLeft at x=0 stays clamped at 0
    fireEvent.keyDown(grip, { key: "ArrowLeft" })
    expect(onUpdateLabelPos).toHaveBeenLastCalledWith("p1", 0, 50)
  })
})
