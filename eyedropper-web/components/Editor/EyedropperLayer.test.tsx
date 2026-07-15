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
    Layer: ({ children, x, y }: { children?: React.ReactNode; x?: number; y?: number }) => (
      <div data-testid="layer" data-x={x ?? 0} data-y={y ?? 0}>{children}</div>
    ),
    // The textured swatch (pastel) is a Group carrying the drag/select/remove
    // handlers. Mirror the Circle mock's event wiring so those handlers can be
    // asserted; the outer per-point wrapper Group has no handlers and just
    // renders its children. dragBoundFunc is recorded like the Circle path.
    Group: ({
      children, x, y, draggable, dragBoundFunc,
      onDragMove, onDragEnd, onMouseEnter, onMouseLeave, onContextMenu, onClick,
    }: {
      children?: React.ReactNode
      x?: number; y?: number; draggable?: boolean
      dragBoundFunc?: DragBoundFunc
      onDragMove?: (e: { target: { x: (v?: number) => number | void; y: (v?: number) => number | void } }) => void
      onDragEnd?: (e: { target: { x: (v?: number) => number | void; y: (v?: number) => number | void } }) => void
      onMouseEnter?: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => void
      onMouseLeave?: (e: { target: { getStage: () => { container: () => HTMLElement } | null } }) => void
      onContextMenu?: (e: { evt: { preventDefault: () => void; clientX: number; clientY: number } }) => void
      onClick?: (e: { evt: { button: number }; cancelBubble: boolean }) => void
    }) => {
      // Only the textured swatch Group sets interaction props; leave the plain
      // wrapper Group as a bare container.
      const isInteractive = draggable !== undefined || onClick !== undefined || onContextMenu !== undefined
      if (!isInteractive) return <div data-testid="group">{children}</div>
      if (dragBoundFunc) lastDragBoundFunc.fn = dragBoundFunc
      const makeMouseEvent = () => ({ target: { getStage: () => ({ container: () => stageContainer }) } })
      const gx = x ?? 0
      const gy = y ?? 0
      return (
        <div
          data-testid="swatch-group"
          data-x={gx} data-y={gy}
          data-draggable={draggable === true ? "true" : "false"}
          data-has-hover={onMouseEnter ? "true" : "false"}
          data-has-click={onClick ? "true" : "false"}
          onClick={() => {
            const evt = { evt: { button: 0 }, cancelBubble: false }
            lastClickEvent.evt = evt
            onClick?.(evt)
          }}
          onMouseDown={() => {
            onDragMove?.({
              target: {
                x: (v?: number) => { if (v !== undefined) { lastSetPos.x = v; return } return gx + 10 },
                y: (v?: number) => { if (v !== undefined) { lastSetPos.y = v; return } return gy + 10 },
              },
            })
          }}
          onMouseUp={() => {
            onDragEnd?.({
              target: {
                x: (v?: number) => { if (v !== undefined) { lastSetPos.x = v; return } return gx + 10 },
                y: (v?: number) => { if (v !== undefined) { lastSetPos.y = v; return } return gy + 10 },
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
        >
          {children}
        </div>
      )
    },
    Image: ({ image, globalCompositeOperation }: { image?: HTMLImageElement; globalCompositeOperation?: string }) => (
      <div
        data-testid="konva-image"
        data-image={image ? "loaded" : "none"}
        data-gco={globalCompositeOperation ?? ""}
      />
    ),
    Circle: ({
      x, y, radius, fill, stroke, draggable, dragBoundFunc, name,
      onDragMove, onDragEnd, onMouseEnter, onMouseLeave, onContextMenu, onClick,
    }: {
      x: number; y: number; radius?: number; fill?: string; stroke?: string
      draggable?: boolean; name?: string
      dragBoundFunc?: DragBoundFunc
      onDragMove?: (e: { target: { x: (v?: number) => number | void; y: (v?: number) => number | void } }) => void
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
          data-name={name ?? ""}
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
            onDragMove?.({
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

import EyedropperLayer, { getSwatchPos } from "./EyedropperLayer"

// A flat (non-textured) style for the fill+stroke Circle path. styles[0] is now
// the ring-less pastel, so pick "float" explicitly for the flat-path tests.
const defaultStyle = loadStyles().find((s) => s.name === "float")!

// Ring-less pastel (pencil texture, no border) and a ringed pastel (has border).
const pastelStyle = loadStyles().find((s) => s.name === "pastel")!
const pastelRingStyle = loadStyles().find((s) => s.name === "pastel ring")!
// A minimal stand-in for a decoded texture; the mocked Konva Image only checks truthiness.
const fakeTexture = {} as HTMLImageElement

const DEFAULT_PROPS = {
  imageOffsetY: 100,
  canvasWidth: 400,
  canvasHeight: 800,
  style: defaultStyle,
  sizeScale: 1,
  interactionMode: "select" as const,
  // Null by default → every existing test stays on the flat Circle path.
  pencilTexture: null as HTMLImageElement | null,
  borderTexture: null as HTMLImageElement | null,
  onMarkerDragMove: vi.fn(),
  onMarkerDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
  onSwatchDragMove: vi.fn(() => ({ x: 0, y: 0 })),
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
  swatchOrder: number | null = 200,
  swatchX: number | null = null,
  swatchY: number | null = null
): EyedropperPoint {
  return {
    id,
    x,
    y,
    color,
    swatchSide,
    swatchOrder,
    swatchX,
    swatchY,
    connectorMid: null,
    label: { text: "", visible: true, x, y, fontSize: 16, fontFamily: "serif", color: "#000" },
  }
}

describe("EyedropperLayer", () => {
  it("renders a Layer with no circles when points is empty", () => {
    const { getByTestId, queryAllByTestId } = render(<EyedropperLayer points={[]} {...DEFAULT_PROPS} />)
    expect(getByTestId("layer")).toBeDefined()
    expect(queryAllByTestId("circle")).toHaveLength(0)
  })

  it("translates the whole Layer by panX/panY so the trio moves rigidly on pan", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} panX={25} panY={-15} />
    )
    const layer = getByTestId("layer")
    expect(layer.getAttribute("data-x")).toBe("25")
    expect(layer.getAttribute("data-y")).toBe("-15")
  })

  it("defaults the Layer pan translate to 0 when panX/panY are omitted", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    const layer = getByTestId("layer")
    expect(layer.getAttribute("data-x")).toBe("0")
    expect(layer.getAttribute("data-y")).toBe("0")
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

  it("sizeScale multiplies the ring marker radius and stroke", () => {
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} sizeScale={2} />
    )
    const circles = getAllByTestId("circle")
    const marker = circles[circles.length - 1]
    // Ring base radius 12 → 24 at 2×.
    expect(marker.getAttribute("data-radius")).toBe("24")
  })

  it("sizeScale multiplies the dot marker radius", () => {
    const dotStyle = { ...defaultStyle, markerStyle: "dot" as const }
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={dotStyle} sizeScale={3} />
    )
    const circles = getAllByTestId("circle")
    const marker = circles[circles.length - 1]
    // Dot base radius 6 → 18 at 3×.
    expect(marker.getAttribute("data-radius")).toBe("18")
  })

  it("always renders a marker Circle (a ring marker) alongside the swatch", () => {
    // markerStyle "none" was removed with the minimal style; every style now has
    // a visible marker, so a laid-out point renders swatch + marker = 2 circles.
    const points = [makePoint("p1", 100, 200, "#ff0000")]
    const { getAllByTestId } = render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} style={defaultStyle} />
    )
    expect(getAllByTestId("circle")).toHaveLength(2)
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

  it("swatch onDragMove snaps the Konva node to the position returned by onSwatchDragMove (Story 5.2)", () => {
    // Mirrors the onDragEnd snap-back: the handler returns the aligned position
    // and the component writes it back onto the node live during the drag.
    const onSwatchDragMove = vi.fn(() => ({ x: 60, y: 250 }))
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    const { getAllByTestId } = render(
      <EyedropperLayer
        points={points}
        {...DEFAULT_PROPS}
        interactionMode="select"
        onSwatchDragMove={onSwatchDragMove}
      />
    )
    lastSetPos.x = null
    lastSetPos.y = null
    const swatch = getAllByTestId("circle")[0]
    fireEvent.mouseDown(swatch)
    expect(lastSetPos).toEqual({ x: 60, y: 250 })
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

  it("swatch dragBoundFunc clamps to 2D canvas bounds in absolute (scaled) space (Story 5.1)", () => {
    // Konva calls dragBoundFunc with absolute stage-pixel coords and applies the
    // result via setAbsolutePosition, so bounds must be scaled by the stage scale.
    // Story 5.1: the swatch is freely draggable in 2D (no longer edge-locked).
    const r = defaultStyle.swatchRadius
    const scale = 0.5
    const w = DEFAULT_PROPS.canvasWidth * scale
    const h = DEFAULT_PROPS.canvasHeight * scale
    // `this` inside dragBoundFunc is the Konva node; this.getStage() → the stage.
    const node: FakeNode = { getStage: () => ({ scaleX: () => scale }) }
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    render(<EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" />)
    // The swatch is the only Circle that sets a dragBoundFunc.
    const bound = lastDragBoundFunc.fn!
    // Both axes clamp independently to [r*scale, dim*scale - r*scale].
    const overflow = bound.call(node, { x: 9999, y: 9999 })
    expect(overflow.x).toBe(w - r * scale)
    expect(overflow.y).toBe(h - r * scale)
    const underflow = bound.call(node, { x: -50, y: -50 })
    expect(underflow.x).toBe(r * scale)
    expect(underflow.y).toBe(r * scale)
    // In-bounds position passes through untouched (free 2D placement).
    const inside = bound.call(node, { x: 100, y: 120 })
    expect(inside).toEqual({ x: 100, y: 120 })
  })

  it("swatch dragBoundFunc shifts its absolute-space clamp band by pan·scale", () => {
    // With the Layer translated by (panX, panY) canvas units, the pan-free clamp
    // band [r, dim−r] maps into absolute space shifted by pan·scale, so the swatch
    // stays clamped to the (panned) image, not the frame.
    const r = defaultStyle.swatchRadius
    const scale = 0.5
    const panX = 40
    const panY = -30
    const w = DEFAULT_PROPS.canvasWidth * scale
    const h = DEFAULT_PROPS.canvasHeight * scale
    const node: FakeNode = { getStage: () => ({ scaleX: () => scale }) }
    const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
    render(
      <EyedropperLayer points={points} {...DEFAULT_PROPS} interactionMode="select" panX={panX} panY={panY} />
    )
    const bound = lastDragBoundFunc.fn!
    const overflow = bound.call(node, { x: 99999, y: 99999 })
    expect(overflow.x).toBeCloseTo(w - r * scale + panX * scale)
    expect(overflow.y).toBeCloseTo(h - r * scale + panY * scale)
    const underflow = bound.call(node, { x: -99999, y: -99999 })
    expect(underflow.x).toBeCloseTo(r * scale + panX * scale)
    expect(underflow.y).toBeCloseTo(r * scale + panY * scale)
  })

  it("getSwatchPos returns (swatchX, swatchY) when both set, edge position when null (Story 5.1)", () => {
    const r = defaultStyle.swatchRadius
    const W = 1080
    const H = 1920
    // Free-floating: absolute coords override the edge layout.
    const free = makePoint("f", 0, 0, "#fff", "left", 300, 777, 888)
    expect(getSwatchPos(free, W, H, r)).toEqual({ x: 777, y: 888 })
    // Not detached (swatchX/Y null): falls through to the edge switch.
    const edge = makePoint("e", 0, 0, "#fff", "left", 300)
    expect(getSwatchPos(edge, W, H, r)).toEqual({ x: r, y: 300 })
    const right = makePoint("rt", 0, 0, "#fff", "right", 300)
    expect(getSwatchPos(right, W, H, r)).toEqual({ x: W - r, y: 300 })
  })

  it("renders a detached free swatch even when swatchOrder is null (Story 5.1)", () => {
    // A free-floating swatch (swatchX/Y set) must still render despite a null order.
    const points = [makePoint("p1", 100, 200, "#ff0000", "auto", null, 400, 600)]
    const { getAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
    const circles = getAllByTestId("circle")
    // swatch + ring marker = 2 circles; the swatch sits at the free coords.
    expect(circles).toHaveLength(2)
    expect(circles[0].getAttribute("data-x")).toBe("400")
    expect(circles[0].getAttribute("data-y")).toBe("600")
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

  describe("precision cue ring", () => {
    it("draws no extra ring when precisionRadius is omitted", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000")]
      const { getAllByTestId } = render(<EyedropperLayer points={points} {...DEFAULT_PROPS} />)
      // swatch + marker only.
      expect(getAllByTestId("circle")).toHaveLength(2)
    })

    it("draws a dashed ring at the marker sized to precisionRadius when set", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000")]
      const { getAllByTestId } = render(
        <EyedropperLayer points={points} {...DEFAULT_PROPS} precisionRadius={37} />
      )
      const circles = getAllByTestId("circle")
      // swatch + precision ring + marker.
      expect(circles).toHaveLength(3)
      const ring = circles.find((c) => c.getAttribute("data-radius") === "37")
      expect(ring).toBeDefined()
      // Centered on the marker (p.x, p.y + imageOffsetY).
      expect(ring!.getAttribute("data-x")).toBe("100")
      expect(ring!.getAttribute("data-y")).toBe(String(200 + DEFAULT_PROPS.imageOffsetY))
    })
  })

  describe("connector bend handle (Story 5.4)", () => {
    const handles = (getAll: (id: string) => HTMLElement[]) =>
      getAll("circle").filter((c) => c.getAttribute("data-name") === "connector-handle")

    it("renders a bend handle for the SELECTED point in select mode", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      expect(handles(getAllByTestId)).toHaveLength(1)
    })

    it("does NOT render a handle for a non-selected point", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="other"
        />
      )
      expect(handles(getAllByTestId)).toHaveLength(0)
    })

    it("does NOT render a handle in add mode even for the selected point (AC7)", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="add"
          selectedPointId="p1"
        />
      )
      expect(handles(getAllByTestId)).toHaveLength(0)
    })

    it("does NOT render a handle in label-edit mode (AC7)", () => {
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
          labelEditMode
        />
      )
      expect(handles(getAllByTestId)).toHaveLength(0)
    })

    it("does NOT render a handle when connectorType is 'none' (AC6)", () => {
      const noConnectorStyle = { ...defaultStyle, connectorType: "none" as const }
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={noConnectorStyle}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      expect(handles(getAllByTestId)).toHaveLength(0)
    })

    it("handle sits at the derived midpoint until bent (AC1)", () => {
      // straight style, un-bent → handle at the geometric midpoint of swatch↔marker.
      const straightStyle = { ...defaultStyle, connectorType: "straight" as const }
      const r = defaultStyle.swatchRadius
      // left-edge swatch at (r, 300); marker at (100, 200 + imageOffsetY 100 = 300).
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={straightStyle}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      const handle = handles(getAllByTestId)[0]
      expect(handle.getAttribute("data-x")).toBe(String((r + 100) / 2))
      expect(handle.getAttribute("data-y")).toBe("300")
    })

    it("handle sits at connectorMid once bent (AC3)", () => {
      const points = [
        { ...makePoint("p1", 100, 200, "#ff0000", "left", 300), connectorMid: { x: 222, y: 333 } },
      ]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      const handle = handles(getAllByTestId)[0]
      expect(handle.getAttribute("data-x")).toBe("222")
      expect(handle.getAttribute("data-y")).toBe("333")
    })

    it("clicking the handle sets cancelBubble so the Stage does not deselect the point", () => {
      // Regression: Konva also fires a click on release after a drag; without
      // cancelBubble it bubbles to the Stage's select-mode onClick → onDeselect,
      // unmounting the handle (which only renders for the selected point). The
      // swatch/marker guard this the same way.
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      fireEvent.click(handles(getAllByTestId)[0])
      expect(lastClickEvent.evt?.cancelBubble).toBe(true)
    })

    it("dragging the handle calls onConnectorDragMove/End with the node coords", () => {
      const onConnectorDragMove = vi.fn(() => ({ x: 0, y: 0 }))
      const onConnectorDragEnd = vi.fn(() => ({ x: 0, y: 0 }))
      const points = [
        { ...makePoint("p1", 100, 200, "#ff0000", "left", 300), connectorMid: { x: 200, y: 200 } },
      ]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
          onConnectorDragMove={onConnectorDragMove}
          onConnectorDragEnd={onConnectorDragEnd}
        />
      )
      const handle = handles(getAllByTestId)[0]
      // mock fires drag with node x+10, y+10 (handle at 200,200 → 210,210).
      fireEvent.mouseDown(handle)
      expect(onConnectorDragMove).toHaveBeenCalledWith("p1", 210, 210)
      fireEvent.mouseUp(handle)
      expect(onConnectorDragEnd).toHaveBeenCalledWith("p1", 210, 210)
    })

    it("writes back the clamped position returned by onConnectorDragEnd", () => {
      const onConnectorDragEnd = vi.fn(() => ({ x: 42, y: 99 }))
      const points = [
        { ...makePoint("p1", 100, 200, "#ff0000", "left", 300), connectorMid: { x: 200, y: 200 } },
      ]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
          onConnectorDragEnd={onConnectorDragEnd}
        />
      )
      lastSetPos.x = null
      lastSetPos.y = null
      fireEvent.mouseUp(handles(getAllByTestId)[0])
      expect(lastSetPos).toEqual({ x: 42, y: 99 })
    })

    it("handle dragBoundFunc clamps to [0,w]×[0,h] in scaled space (no radius inset)", () => {
      const scale = 0.5
      const w = DEFAULT_PROPS.canvasWidth * scale
      const h = DEFAULT_PROPS.canvasHeight * scale
      const node: FakeNode = { getStage: () => ({ scaleX: () => scale }) }
      const points = [makePoint("p1", 100, 200, "#ff0000", "left", 300)]
      lastDragBoundFunc.fn = null
      render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          interactionMode="select"
          selectedPointId="p1"
        />
      )
      // The bend handle is the only Circle setting a dragBoundFunc here (the swatch
      // sets one too, but the handle renders after it — last write wins).
      const bound = lastDragBoundFunc.fn!
      expect(bound.call(node, { x: 9999, y: 9999 })).toEqual({ x: w, y: h })
      expect(bound.call(node, { x: -50, y: -50 })).toEqual({ x: 0, y: 0 })
    })
  })

  describe("pastel textured swatch (Story 3.5)", () => {
    it("flat style renders the swatch as a fill+stroke Circle, no texture Images (AC4)", () => {
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getAllByTestId, queryAllByTestId } = render(
        <EyedropperLayer points={points} {...DEFAULT_PROPS} style={defaultStyle} />
      )
      const swatch = getAllByTestId("circle")[0]
      expect(swatch.getAttribute("data-fill")).toBe("#aabbcc")
      expect(swatch.getAttribute("data-stroke")).toBe(defaultStyle.swatchBorderColor)
      expect(queryAllByTestId("konva-image")).toHaveLength(0)
      expect(queryAllByTestId("swatch-group")).toHaveLength(0)
    })

    it("ringed pastel with both textures renders disc + pencil(multiply) + destination-in clip + border (AC3)", () => {
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelRingStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
        />
      )
      // Disc Circle filled with the point's sampled color (no border stroke — the
      // ring is the border texture image, not a crisp stroke).
      const discs = getAllByTestId("circle").filter((c) => c.getAttribute("data-fill") === "#aabbcc")
      expect(discs.length).toBeGreaterThan(0)
      // Two pencil images (multiply + destination-in) and one border image (over).
      const images = getAllByTestId("konva-image")
      const gcos = images.map((i) => i.getAttribute("data-gco"))
      expect(gcos).toContain("multiply")
      expect(gcos).toContain("destination-in")
      // Border image is drawn as-is (no composite op).
      expect(gcos.filter((g) => g === "")).toHaveLength(1)
      // The textured swatch is a Group, not a flat swatch Circle.
      expect(getAllByTestId("swatch-group")).toHaveLength(1)
    })

    it("ring-less pastel renders pencil texture but NO border image (pencil disc only)", () => {
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
        />
      )
      // Still textured (pencil multiply + destination-in), but the style has no
      // borderTexture so the "over" ring image is omitted → no zero-gco image.
      const gcos = getAllByTestId("konva-image").map((i) => i.getAttribute("data-gco"))
      expect(gcos).toContain("multiply")
      expect(gcos).toContain("destination-in")
      expect(gcos.filter((g) => g === "")).toHaveLength(0)
      expect(getAllByTestId("swatch-group")).toHaveLength(1)
    })

    it("pastel style but the pencil is still null → falls back to the flat Circle, no crash", () => {
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getAllByTestId, queryAllByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelRingStyle}
          pencilTexture={null}
          borderTexture={fakeTexture}
        />
      )
      // No texture images; swatch is the flat Circle fallback.
      expect(queryAllByTestId("konva-image")).toHaveLength(0)
      expect(queryAllByTestId("swatch-group")).toHaveLength(0)
      expect(getAllByTestId("circle")[0].getAttribute("data-fill")).toBe("#aabbcc")
    })

    it("textured swatch stays draggable and selectable in select mode (AC5)", () => {
      const onSelectPoint = vi.fn()
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
          interactionMode="select"
          onSelectPoint={onSelectPoint}
        />
      )
      const group = getByTestId("swatch-group")
      expect(group.getAttribute("data-draggable")).toBe("true")
      expect(group.getAttribute("data-has-click")).toBe("true")
      expect(group.getAttribute("data-has-hover")).toBe("true")
      fireEvent.click(group)
      expect(onSelectPoint).toHaveBeenCalledWith("p1")
      expect(lastClickEvent.evt?.cancelBubble).toBe(true)
    })

    it("textured swatch is not draggable and has no click in add mode (AC5)", () => {
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
          interactionMode="add"
        />
      )
      const group = getByTestId("swatch-group")
      expect(group.getAttribute("data-draggable")).toBe("false")
      expect(group.getAttribute("data-has-click")).toBe("false")
    })

    it("right-click on the textured swatch calls onRequestRemove and preventDefault (AC5)", () => {
      const onRequestRemove = vi.fn()
      lastContextMenu.preventDefault.mockClear()
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
          onRequestRemove={onRequestRemove}
        />
      )
      fireEvent.contextMenu(getByTestId("swatch-group"))
      expect(onRequestRemove).toHaveBeenCalledWith("p1", 123, 456)
      expect(lastContextMenu.preventDefault).toHaveBeenCalled()
    })

    it("textured swatch drag writes back the snapped position from onSwatchDragEnd (AC5)", () => {
      const onSwatchDragEnd = vi.fn(() => ({ x: 55, y: 210 }))
      const points = [makePoint("p1", 100, 200, "#aabbcc", "left", 300)]
      const { getByTestId } = render(
        <EyedropperLayer
          points={points}
          {...DEFAULT_PROPS}
          style={pastelStyle}
          pencilTexture={fakeTexture}
          borderTexture={fakeTexture}
          interactionMode="select"
          onSwatchDragEnd={onSwatchDragEnd}
        />
      )
      lastSetPos.x = null
      lastSetPos.y = null
      fireEvent.mouseUp(getByTestId("swatch-group"))
      expect(lastSetPos).toEqual({ x: 55, y: 210 })
    })
  })
})
