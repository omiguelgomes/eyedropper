import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import Canvas from "./Canvas"
import type { CanvasLayout } from "@/lib/canvas-to-916"
import { loadStyles } from "@/lib/styles"

// Stand-in for the Konva stage container, so cursor changes are inspectable.
// Created via vi.hoisted so it exists when the hoisted vi.mock factory runs.
const { imageStageContainer } = vi.hoisted(() => ({
  imageStageContainer: globalThis.document.createElement("div"),
}))

// Mock react-konva to avoid canvas rendering in jsdom
vi.mock("react-konva", () => ({
  Stage: ({ children, width, height, scaleX, scaleY, onClick }: any) => (
    <div
      data-testid="konva-stage"
      data-width={width}
      data-height={height}
      data-scalex={scaleX}
      data-scaley={scaleY}
      data-has-click={onClick ? "true" : "false"}
      onClick={(e: any) =>
        onClick?.({
          evt: { button: e?.button ?? 0 },
          cancelBubble: false,
          target: { getStage: () => ({ getRelativePointerPosition: () => ({ x: 33, y: 77 }) }) },
        })
      }
    >
      {children}
    </div>
  ),
  Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
  Rect: (props: any) => <div data-testid="konva-rect" data-fill={props.fill} />,
  Image: (props: any) => {
    const evt = { target: { getStage: () => ({ container: () => imageStageContainer }) } }
    return (
      <div
        data-testid="konva-image"
        data-image={props.image ? "loaded" : "none"}
        data-x={props.x}
        data-y={props.y}
        data-width={props.width}
        data-height={props.height}
        data-has-hover={props.onMouseEnter ? "true" : "false"}
        onMouseEnter={() => props.onMouseEnter?.(evt)}
        onMouseLeave={() => props.onMouseLeave?.(evt)}
      />
    )
  },
  Circle: () => null,
}))

// Mock EyedropperLayer so Canvas tests don't depend on it
vi.mock("./EyedropperLayer", () => ({
  default: () => null,
}))

// Mock the label components to simple markers so Canvas tests stay isolated.
vi.mock("./LabelLayer", () => ({
  default: () => <div data-testid="label-layer" />,
}))
vi.mock("./LabelEditOverlay", () => ({
  default: () => <div data-testid="label-edit-overlay" />,
}))

const defaultLayout: CanvasLayout = {
  canvasWidth: 800,
  canvasHeight: 1422,
  imageOffsetY: 411,
}

// A stand-in for the decoded HTMLImageElement now passed in as a prop.
const fakeImage = {} as HTMLImageElement

function makeProps(overrides?: Partial<Parameters<typeof Canvas>[0]>) {
  return {
    image: fakeImage,
    stageRef: { current: null },
    canvasLayout: defaultLayout,
    imageHeight: 600,
    bgColor: "#f0ebe3",
    displayWidth: 400,
    displayHeight: 711,
    points: [],
    style: loadStyles()[0],
    interactionMode: "select" as const,
    labelEditMode: false,
    snapGuides: [],
    distribution: [],
    pencilTexture: null,
    borderTexture: null,
    onMarkerDragMove: vi.fn(),
    onMarkerDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
    onSwatchDragMove: vi.fn(() => ({ x: 0, y: 0 })),
    onSwatchDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
    onConnectorDragMove: vi.fn(() => ({ x: 0, y: 0 })),
    onConnectorDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
    selectedPointId: null,
    onAddPoint: vi.fn(),
    onRequestRemove: vi.fn(),
    onSelectPoint: vi.fn(),
    onDeselect: vi.fn(),
    onUpdateLabelText: vi.fn(),
    onUpdateLabelPos: vi.fn(),
    ...overrides,
  }
}

describe("Canvas", () => {
  it("renders the Konva Stage with the display dimensions", () => {
    const { getByTestId } = render(<Canvas {...makeProps()} />)
    const stage = getByTestId("konva-stage")
    expect(stage.getAttribute("data-width")).toBe("400")
    expect(stage.getAttribute("data-height")).toBe("711")
  })

  it("scales the stage by displayWidth / canvasWidth", () => {
    const { getByTestId } = render(<Canvas {...makeProps()} />)
    const stage = getByTestId("konva-stage")
    // 400 / 800 = 0.5
    expect(stage.getAttribute("data-scalex")).toBe("0.5")
    expect(stage.getAttribute("data-scaley")).toBe("0.5")
  })

  it("renders the background Rect with bgColor", () => {
    const { getByTestId } = render(<Canvas {...makeProps({ bgColor: "#aabbcc" })} />)
    expect(getByTestId("konva-rect").getAttribute("data-fill")).toBe("#aabbcc")
  })

  it("renders KonvaImage at imageOffsetY with logical canvas width and natural height", () => {
    const { getByTestId } = render(<Canvas {...makeProps()} />)
    const img = getByTestId("konva-image")
    expect(img.getAttribute("data-image")).toBe("loaded")
    expect(img.getAttribute("data-x")).toBe("0")
    expect(img.getAttribute("data-y")).toBe("411") // imageOffsetY
    expect(img.getAttribute("data-width")).toBe("800") // canvasWidth
    expect(img.getAttribute("data-height")).toBe("600") // natural imageHeight
  })

  it("in add mode the Stage has an onClick that calls onAddPoint with the relative pointer position (AC2)", () => {
    const onAddPoint = vi.fn()
    const onDeselect = vi.fn()
    const { getByTestId } = render(
      <Canvas {...makeProps({ interactionMode: "add", onAddPoint, onDeselect })} />
    )
    const stage = getByTestId("konva-stage")
    expect(stage.getAttribute("data-has-click")).toBe("true")
    fireEvent.click(stage)
    expect(onAddPoint).toHaveBeenCalledWith(33, 77)
    expect(onDeselect).not.toHaveBeenCalled()
  })

  it("in add mode a right-click (button 2) does NOT add a point (Konva synthesizes a click for any button)", () => {
    const onAddPoint = vi.fn()
    const { getByTestId } = render(
      <Canvas {...makeProps({ interactionMode: "add", onAddPoint })} />
    )
    fireEvent.click(getByTestId("konva-stage"), { button: 2 })
    expect(onAddPoint).not.toHaveBeenCalled()
  })

  it("in select mode the Stage click deselects (empty-area click) and does NOT add a point (AC4)", () => {
    const onAddPoint = vi.fn()
    const onDeselect = vi.fn()
    const { getByTestId } = render(
      <Canvas {...makeProps({ interactionMode: "select", onAddPoint, onDeselect })} />
    )
    const stage = getByTestId("konva-stage")
    // onClick is now attached in BOTH modes (select branch only does work on
    // bubbled empty-area clicks), so data-has-click is "true".
    expect(stage.getAttribute("data-has-click")).toBe("true")
    fireEvent.click(stage)
    expect(onDeselect).toHaveBeenCalledTimes(1)
    expect(onAddPoint).not.toHaveBeenCalled()
  })

  it("in add mode hovering the image sets the cursor to crosshair and resets on leave (AC1)", () => {
    const { getByTestId } = render(
      <Canvas {...makeProps({ interactionMode: "add" })} />
    )
    const img = getByTestId("konva-image")
    expect(img.getAttribute("data-has-hover")).toBe("true")
    fireEvent.mouseEnter(img)
    expect(imageStageContainer.style.cursor).toBe("crosshair")
    fireEvent.mouseLeave(img)
    expect(imageStageContainer.style.cursor).toBe("default")
  })

  it("in select mode the image has no crosshair hover handlers (AC1 guard)", () => {
    const { getByTestId } = render(
      <Canvas {...makeProps({ interactionMode: "select" })} />
    )
    expect(getByTestId("konva-image").getAttribute("data-has-hover")).toBe("false")
  })

  it("renders LabelLayer (display) and not LabelEditOverlay when labelEditMode is false (AC5)", () => {
    const { queryByTestId } = render(<Canvas {...makeProps({ labelEditMode: false })} />)
    expect(queryByTestId("label-layer")).not.toBeNull()
    expect(queryByTestId("label-edit-overlay")).toBeNull()
  })

  it("renders BOTH LabelLayer (live preview) and LabelEditOverlay when labelEditMode is true", () => {
    // LabelLayer stays mounted in edit mode as the live preview; the transparent
    // LabelEditOverlay inputs sit exactly on top of it (position-drift fix).
    const { queryByTestId } = render(<Canvas {...makeProps({ labelEditMode: true })} />)
    expect(queryByTestId("label-edit-overlay")).not.toBeNull()
    expect(queryByTestId("label-layer")).not.toBeNull()
  })
})
