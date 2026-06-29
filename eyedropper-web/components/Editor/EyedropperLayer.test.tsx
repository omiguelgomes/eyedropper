import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import type { EyedropperPoint } from "@/lib/types"
import { loadStyles } from "@/lib/styles"

// react-konva renders via canvas; RTL can't inspect Konva shapes directly.
// Mock Layer/Group/Circle/Line to render DOM elements with data-* attributes.
// Circle immediately invokes onDragMove/onDragEnd via mousedown/mouseup so tests
// can verify the drag callbacks are wired up without simulating real Konva events.
// The Circle's target x()/y() act as getters with no arg and record set-calls
// with an arg, so tests can assert the onDragEnd snap-back position.

// Records the last (x, y) the component wrote back onto the dragged node.
const lastSetPos: { x: number | null; y: number | null } = { x: null, y: null }
// Records the last dragBoundFunc passed to a Circle (only the swatch sets one),
// so tests can invoke it directly against a scaled fake stage.
type FakeNode = { getStage: () => { scaleX: () => number } | null }
type DragBoundFunc = (this: FakeNode, pos: { x: number; y: number }) => { x: number; y: number }
const lastDragBoundFunc: { fn: DragBoundFunc | null } = { fn: null }
// Spy injected into the fake Konva contextmenu event so tests can assert the
// handler calls e.evt.preventDefault().
const lastContextMenu = { preventDefault: vi.fn() }
// Records the last Konva click event object passed to a Circle's onClick, so a
// test can assert the handler set e.cancelBubble = true (a property on the event
// object itself, not on e.evt).
const lastClickEvent: { evt: { evt: { button: number }; cancelBubble: boolean } | null } = { evt: null }
// Shared stand-in for the Konva stage container, so cursor changes are inspectable.
const stageContainer = document.createElement("div")

vi.mock("react-konva", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-konva")>()
  return {
    ...actual,
    Layer: ({ children }: { children?: React.ReactNode }) => <div data-testid="layer">{children}</div>,
    Group: ({ children }: { children?: React.ReactNode }) => <div data-testid="group">{children}</div>,
    Circle: ({
      x, y, radius, fill, stroke, draggable, dragBoundFunc,
      onDragMove, onDragEnd, onMouseEnter, onMouseLeave, onContextMenu, onClick,
    }: {
      x: number; y: number; radius?: number; fill?: string; stroke?: string
      draggable?: boolean
      dragBoundFunc?: DragBoundFunc
      onDragMove?: (e: { target: { x: () => number; y: () => number } }) => void
      onDragEnd?: (e: { target: { x: (v?: number) => number | void; y: (v?: number) => number | void } }) => void
      onMouseEnter?: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => void
      onMouseLeave?: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => void
      onContextMenu?: (e: { evt: { preventDefault: () => void; clientX: number; clientY: number } }) => void
      onClick?: (e: { evt: { button: number }; cancelBubble: boolean }) => void
    }) => {
      if (dragBoundFunc) lastDragBoundFunc.fn = dragBoundFunc
      const makeMouseEvent = () => ({ target: { getStage: () => ({ container: () => stageContainer }) } })
      return (
        <div
          data-testid="circle"
          data-x={x} data-y={y} data-radius={radius} data-fill={fill} data-stroke={stroke}
          data-draggable={draggable === true ? "true" : "false"}
          data-has-hover={onMouseEnter ? "true" : "false"}
          data-has-click={onClick ? "true" : "false"}
          onClick={() => {
            const evt = { evt: { button: 0 }, cancelBubble: false }
            lastClickEvent.evt = evt
            onClick?.(evt)
          }}
          onMouseDown={() => {
            onDragMove?.({ target: { x: () => x + 10, y: () => y + 10 } })
          }}
          onMouseUp={() => {
            onDragEnd?.({
              target: {
                x: (v?: number) => {
                  if (v !== undefined) { lastSetPos.x = v; return }
                  return x + 10
                },
                y: (v?: number) => {
                  if (v !== undefined) { lastSetPos.y = v; return }
                  return y + 10
                },
              },
            })
          }}
          onMouseEnter={() => onMouseEnter?.(makeMouseEvent())}
          onMouseLeave={() => onMouseLeave?.(makeMouseEvent())}
          onContextMenu={(domEvt) => {
            domEvt.preventDefault()
            onContextMenu?.({
              evt: { preventDefault: lastContextMenu.preventDefault, clientX: 123, clientY: 456 },
            })
          }}
        />
      )
    },
    Line: ({ points, stroke }: { points: number[]; stroke?: string }) => (
      <div data-testid="line" data-points={JSON.stringify(points)} data-stroke={stroke} />
    ),
  }
})

import EyedropperLayer from "./EyedropperLayer"

const defaultStyle = loadStyles()[0]

const DEFAULT_PROPS = {
  imageOffsetY: 100,
  canvasWidth: 400,
  canvasHeight: 800,
  style: defaultStyle,
  interactionMode: "select" as const,
  onMarkerDragMove: vi.fn(),
  onMarkerDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
  onSwatchDragMove: vi.fn(),
  onSwatchDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
  onRequestRemove: vi.fn(),
  onSelectPoint: vi.fn(),
}

function makePoint(
  id: string,
  x: number,
  y: number,
  color: string,
  swatchSide: EyedropperPoint["swatchSide"] = "left",
  swatchOrder: number | null = 200
): EyedropperPoint {
  return {
    id,
    x,
    y,
    color,
    swatchSide,
    swatchOrder,
    label: { text: "", visible: true, x, y, fontSize: 16, fontFamily: "serif", color: "#000" },
  }
}

describe("EyedropperLayer", () => {
  it("renders a Layer with no circles when points is empty", () => {
    const { getByTestId, queryAllByTestId } = render(<EyedropperLayer points={[]} {...DEFAULT_PROPS} />)
    expect(getByTestId("layer")).toBeDefined()
    expect(queryAllByTestId("circle")).toHaveLength(0)
  })

  it("renders two circles per point (ring + swatch)", () => {
    const points = [
      makePoint("p1", 100, 200, "#ff0000"),
      makePoint("p2", 300, 400, "#00ff00"),
      makePoint("p3", 500, 600, "#0000ff"),
    ]
    const { getAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    // 2 circles per point: swatch + ring marker (assuming style.markerStyle !== "none")
    expect(getAllByTestId("circle")).toHaveLength(2 * points.length)
  })

  it("ring marker renders at p.x, p.y + imageOffsetY", () => {
    const imageOffsetY = 100
    const points = [makePoint("p1", 150, 250, "#aabbcc")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} imageOffsetY={imageOffsetY} />
    )
    const circles = getAllByTestId("circle")
    // Ring marker is the last circle rendered (drawn after swatch)
    const ringMarker = circles[circles.length - 1]
    expect(ringMarker.getAttribute("data-x")).toBe("150")
    expect(ringMarker.getAttribute("data-y")).toBe(String(250 + imageOffsetY))
  })

  it("swatch renders at correct edge position (left edge: x = swatchRadius)", () => {
    const points = [makePoint("p1", 10, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    const circles = getAllByTestId("circle")
    // Swatch is the first circle rendered
    const swatch = circles[0]
    expect(swatch.getAttribute("data-x")).toBe(String(defaultStyle.swatchRadius))
    expect(swatch.getAttribute("data-y")).toBe("300")
    expect(swatch.getAttribute("data-fill")).toBe("#ff0000")
  })

  it("connector Line rendered when connectorType !== 'none'", () => {
    // default style should have a connector
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { queryAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    // If connectorType is not "none", lines should be present
    if (defaultStyle.connectorType !== "none") {
      expect(queryAllByTestId("line")).toHaveLength(1)
    }
  })

  it("no connector Line when style.connectorType === 'none'", () => {
    const noConnectorStyle = { ...defaultStyle, connectorType: "none" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { queryAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={noConnectorStyle} />
    )
    expect(queryAllByTestId("line")).toHaveLength(0)
  })

  it("point with swatchOrder === null → nothing rendered for that point", () => {
    const points = [
      makePoint("p1", 100, 200, "#ff0000", "left", null),
      makePoint("p2", 300, 400, "#00ff00", "left", 200),
    ]
    const { queryAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    // Only p2 renders (p1 is skipped due to null swatchOrder)
    expect(queryAllByTestId("circle")).toHaveLength(2) // ring + swatch for p2 only
  })

  it("renders circles at the correct fill colors", () => {
    const points = [makePoint("p1", 150, 250, "#aabbcc")]
    const { getAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    const circles = getAllByTestId("circle")
    // Swatch fill = point color
    expect(circles[0].getAttribute("data-fill")).toBe("#aabbcc")
  })

  it("ring marker (markerStyle 'ring') renders a hollow ring at radius 12", () => {
    const ringStyle = { ...defaultStyle, markerStyle: "ring" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={ringStyle} />
    )
    const circles = getAllByTestId("circle")
    const marker = circles[circles.length - 1]
    // Hollow: no fill, stroked at the marker color, ring radius 12.
    expect(marker.getAttribute("data-fill")).toBeNull()
    expect(marker.getAttribute("data-stroke")).toBe(ringStyle.markerColor)
    expect(marker.getAttribute("data-radius")).toBe("12")
  })

  it("dot marker (markerStyle 'dot') renders a filled dot at radius 6", () => {
    const dotStyle = { ...defaultStyle, markerStyle: "dot" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={dotStyle} />
    )
    const circles = getAllByTestId("circle")
    const marker = circles[circles.length - 1]
    // Filled with the marker color, dot radius 6.
    expect(marker.getAttribute("data-fill")).toBe(dotStyle.markerColor)
    expect(marker.getAttribute("data-radius")).toBe("6")
  })

  it("no marker Circle when markerStyle === 'none' (only the swatch renders)", () => {
    const noneStyle = { ...defaultStyle, markerStyle: "none" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={noneStyle} />
    )
    // Only the swatch Circle, no marker.
    expect(getAllByTestId("circle")).toHaveLength(1)
  })

  it("dot marker stays draggable and selectable in select mode", () => {
    const onSelectPoint = vi.fn()
    const dotStyle = { ...defaultStyle, markerStyle: "dot" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        style={dotStyle}
        interactionMode="select"
        onSelectPoint={onSelectPoint}
      />
    )
    const circles = getAllByTestId("circle")
    const marker = circles[circles.length - 1]
    expect(marker.getAttribute("data-draggable")).toBe("true")
    fireEvent.click(marker)
    expect(onSelectPoint).toHaveBeenCalledWith("p1")
  })

  it("ring marker has data-draggable='true' in select mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />
    )
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    expect(ringMarker.getAttribute("data-draggable")).toBe("true")
  })

  it("ring marker has data-draggable='false' in add mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="add" />
    )
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    expect(ringMarker.getAttribute("data-draggable")).toBe("false")
  })

  it("onDragMove on ring marker calls onMarkerDragMove with (id, x, y)", () => {
    const onMarkerDragMove = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onMarkerDragMove={onMarkerDragMove}
      />
    )
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    fireEvent.mouseDown(ringMarker)
    expect(onMarkerDragMove).toHaveBeenCalledWith("p1", 110, 310) // x+10, (y+imageOffsetY)+10 = 200+100+10
  })

  it("onDragEnd on ring marker calls onMarkerDragEnd with (id, x, y)", () => {
    const onMarkerDragEnd = vi.fn(() => ({ x: 0, y: 0 }))
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onMarkerDragEnd={onMarkerDragEnd}
      />
    )
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    fireEvent.mouseUp(ringMarker)
    expect(onMarkerDragEnd).toHaveBeenCalledWith("p1", 110, 310)
  })

  it("onDragEnd snaps the node to the clamped position returned by onMarkerDragEnd", () => {
    // The handler returns the clamped canvas-space position; the component must
    // write it back onto the node (not the stale pre-drag coords).
    const onMarkerDragEnd = vi.fn(() => ({ x: 42, y: 99 }))
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onMarkerDragEnd={onMarkerDragEnd}
      />
    )
    lastSetPos.x = null
    lastSetPos.y = null
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    fireEvent.mouseUp(ringMarker)
    expect(lastSetPos).toEqual({ x: 42, y: 99 })
  })

  it("ring marker has hover handlers in select mode and none in add mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const selectRender = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />
    )
    let circles = selectRender.getAllByTestId("circle")
    expect(circles[circles.length - 1].getAttribute("data-has-hover")).toBe("true")
    selectRender.unmount()

    const addRender = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="add" />
    )
    circles = addRender.getAllByTestId("circle")
    expect(circles[circles.length - 1].getAttribute("data-has-hover")).toBe("false")
  })

  it("hovering the ring marker sets the stage cursor to 'move' and resets on leave (AC1)", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />
    )
    const ringMarker = getAllByTestId("circle").slice(-1)[0]
    fireEvent.mouseEnter(ringMarker)
    expect(stageContainer.style.cursor).toBe("move")
    fireEvent.mouseLeave(ringMarker)
    expect(stageContainer.style.cursor).toBe("default")
  })

  it("swatch Circle has data-draggable='true' in select mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />
    )
    const circles = getAllByTestId("circle")
    const swatch = circles[0]
    expect(swatch.getAttribute("data-draggable")).toBe("true")
  })

  it("swatch Circle has data-draggable='false' in add mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="add" />
    )
    const circles = getAllByTestId("circle")
    const swatch = circles[0]
    expect(swatch.getAttribute("data-draggable")).toBe("false")
  })

  it("onDragMove on swatch circle calls onSwatchDragMove with (id, x, y)", () => {
    const onSwatchDragMove = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSwatchDragMove={onSwatchDragMove}
      />
    )
    const circles = getAllByTestId("circle")
    const swatch = circles[0]
    fireEvent.mouseDown(swatch)
    // mock fires onDragMove with x+10, y+10 of the swatch position
    // swatchPos for left side: x=swatchRadius, y=300
    const r = defaultStyle.swatchRadius
    expect(onSwatchDragMove).toHaveBeenCalledWith("p1", r + 10, 310)
  })

  it("onDragEnd on swatch circle calls onSwatchDragEnd with (id, x, y)", () => {
    const onSwatchDragEnd = vi.fn(() => ({ x: 0, y: 0 }))
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSwatchDragEnd={onSwatchDragEnd}
      />
    )
    const circles = getAllByTestId("circle")
    const swatch = circles[0]
    fireEvent.mouseUp(swatch)
    const r = defaultStyle.swatchRadius
    expect(onSwatchDragEnd).toHaveBeenCalledWith("p1", r + 10, 310)
  })

  it("swatch onDragEnd snaps the Konva node to the position returned by onSwatchDragEnd", () => {
    const onSwatchDragEnd = vi.fn(() => ({ x: 55, y: 200 }))
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSwatchDragEnd={onSwatchDragEnd}
      />
    )
    lastSetPos.x = null
    lastSetPos.y = null
    const circles = getAllByTestId("circle")
    const swatch = circles[0]
    fireEvent.mouseUp(swatch)
    expect(lastSetPos).toEqual({ x: 55, y: 200 })
  })

  it("swatch dragBoundFunc clamps in absolute (scaled) space, not canvas space", () => {
    // Konva calls dragBoundFunc with absolute stage-pixel coords and applies the
    // result via setAbsolutePosition, so bounds must be scaled by the stage scale.
    const r = defaultStyle.swatchRadius
    const scale = 0.5
    // `this` inside dragBoundFunc is the Konva node; this.getStage() → the stage.
    const node: FakeNode = { getStage: () => ({ scaleX: () => scale }) }
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    render(<EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />)
    // The swatch is the only Circle that sets a dragBoundFunc.
    const bound = lastDragBoundFunc.fn!
    // Left edge: x must pin to r*scale (absolute), NOT r (canvas-space).
    const result = bound.call(node, { x: 9999, y: 50 })
    expect(result.x).toBe(r * scale)
    // y clamped to [r*scale, (canvasHeight - r)*scale]; 50 is above the lower bound.
    expect(result.y).toBe(Math.max(r * scale, Math.min((DEFAULT_PROPS.canvasHeight - r) * scale, 50)))
  })

  it("right-click on swatch calls onRequestRemove with (id, clientX, clientY) (AC4)", () => {
    const onRequestRemove = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} onRequestRemove={onRequestRemove} />
    )
    const swatch = getAllByTestId("circle")[0]
    fireEvent.contextMenu(swatch)
    expect(onRequestRemove).toHaveBeenCalledWith("p1", 123, 456)
  })

  it("right-click on ring marker calls onRequestRemove with (id, clientX, clientY) (AC3)", () => {
    const onRequestRemove = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} onRequestRemove={onRequestRemove} />
    )
    const circles = getAllByTestId("circle")
    const ringMarker = circles[circles.length - 1]
    fireEvent.contextMenu(ringMarker)
    expect(onRequestRemove).toHaveBeenCalledWith("p1", 123, 456)
  })

  it("right-click suppresses the native browser menu via e.evt.preventDefault()", () => {
    lastContextMenu.preventDefault.mockClear()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} />
    )
    fireEvent.contextMenu(getAllByTestId("circle")[0])
    expect(lastContextMenu.preventDefault).toHaveBeenCalled()
  })

  it("right-click works in add mode too (onContextMenu attached unconditionally)", () => {
    const onRequestRemove = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="add"
        onRequestRemove={onRequestRemove}
      />
    )
    fireEvent.contextMenu(getAllByTestId("circle")[0])
    expect(onRequestRemove).toHaveBeenCalledWith("p1", 123, 456)
  })

  it("clicking the swatch in select mode calls onSelectPoint and sets cancelBubble (AC1)", () => {
    const onSelectPoint = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSelectPoint={onSelectPoint}
      />
    )
    fireEvent.click(getAllByTestId("circle")[0])
    expect(onSelectPoint).toHaveBeenCalledWith("p1")
    expect(lastClickEvent.evt?.cancelBubble).toBe(true)
  })

  it("clicking the ring marker in select mode calls onSelectPoint (AC1)", () => {
    const onSelectPoint = vi.fn()
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSelectPoint={onSelectPoint}
      />
    )
    const circles = getAllByTestId("circle")
    fireEvent.click(circles[circles.length - 1])
    expect(onSelectPoint).toHaveBeenCalledWith("p1")
  })

  it("in add mode neither circle has an onClick (clicks fall through to the Stage to add a point) (AC4)", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="add" />
    )
    for (const circle of getAllByTestId("circle")) {
      expect(circle.getAttribute("data-has-click")).toBe("false")
    }
  })

  it("both circles have an onClick wired in select mode", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />
    )
    for (const circle of getAllByTestId("circle")) {
      expect(circle.getAttribute("data-has-click")).toBe("true")
    }
  })
})
