"use client"

import { useLayoutEffect, useRef } from "react"
import { Layer, Circle, Line, Group, Image as KonvaImage } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { EyedropperPoint } from "@/lib/types"
import type { Style } from "@/lib/styles"
import { computeConnectorGeometry } from "@/lib/swatch-layout"
import { imageToCanvas } from "@/lib/canvas-layout"

interface Props {
  points: EyedropperPoint[]
  // Image→canvas transform (cover-crop). imageScale defaults to 1 and
  // imageOffsetX to 0 so existing callers/tests that pass only imageOffsetY still
  // render the legacy full-width layout unchanged.
  imageScale?: number
  imageOffsetX?: number
  imageOffsetY: number
  canvasWidth: number
  canvasHeight: number
  // Pan offset (canvas units) applied as a translate on this whole Layer so the
  // markers/connectors/swatches move RIGIDLY with the panned image. Default 0.
  // Node-local coords (drag write-backs) stay pan-free; only the dragBoundFuncs,
  // which see ABSOLUTE stage coords, add the (scaled) pan back in to clamp.
  panX?: number
  panY?: number
  style: Style
  // Global size multiplier for the marker dot/ring, whose base sizes (dot r=6,
  // ring r=12, ring stroke=2) are hardcoded here rather than on the style. The
  // swatch/connector/border are already scaled into `style` upstream.
  sizeScale: number
  interactionMode: "select" | "add" | "pan"
  // Decoded pastel textures, shared across all swatches. Null until loaded (or
  // when the active style is not textured); the swatch falls back to flat then.
  pencilTexture?: HTMLImageElement | null
  borderTexture?: HTMLImageElement | null
  onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
  onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  // `disableSnap` (held Alt/Option, CAD-style) suppresses alignment guides and
  // distribution snapping for this frame — the swatch tracks the cursor freely.
  onSwatchDragMove: (id: string, canvasX: number, canvasY: number, disableSnap: boolean) => { x: number; y: number }
  onSwatchDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onRequestRemove: (id: string, clientX: number, clientY: number) => void
  onSelectPoint: (id: string) => void
  // Story 5.4: connector bend-handle drag. Optional so existing tests/callers that
  // don't wire them still compile; the handle only renders when in select mode
  // for the selected point (see below), so absent handlers simply mean no handle.
  onConnectorDragMove?: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onConnectorDragEnd?: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  // Gate the bend handle off in label-edit mode (the EyedropperLayer stays mounted
  // underneath the HTML label overlay) and show it only for the selected point.
  labelEditMode?: boolean
  selectedPointId?: string | null
  // Precision cue: while the artist is adjusting the sample-area (Precision)
  // slider, draw a dashed ring around each marker at `precisionRadius` (canvas
  // units) showing the footprint sampleColor averages. Non-interactive and
  // ephemeral — never part of the export. Omitted/0 → nothing drawn.
  precisionRadius?: number
}

// Konva event handler props shared by BOTH swatch render paths (flat Circle and
// textured Group). Factored once so the two paths cannot drift (the recurring
// "don't fork the handlers" lesson). onContextMenu + draggable live on the node
// directly; the rest are gated on select mode.
type SwatchHandlers = {
  onClick?: (e: KonvaEventObject<MouseEvent>) => void
  dragBoundFunc?: (this: Konva.Node, pos: { x: number; y: number }) => { x: number; y: number }
  onMouseEnter?: (e: KonvaEventObject<MouseEvent>) => void
  onMouseLeave?: (e: KonvaEventObject<MouseEvent>) => void
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void
}

// A single pastel swatch: disc(sampledColor) × pencil(multiply) ∩ pencil-alpha +
// border(over), rendered inside a CACHED Group so the multiply composites within
// the group's own offscreen buffer and never tints the photo/neighbours (AC6).
// Children are in group-local coords centred on (0,0); the Group is positioned at
// the swatch centre so drag write-back (Group x/y) matches the flat path.
// `border` is optional: the plain "pastel" style has no ring (pencil disc only),
// while "pastel ring"/"pastel bold" supply the thin/strong chalk ring texture.
function TexturedSwatch({
  color,
  radius,
  pencil,
  border,
  x,
  y,
  draggable,
  onContextMenu,
  handlers,
}: {
  color: string
  radius: number
  pencil: HTMLImageElement
  border: HTMLImageElement | null
  x: number
  y: number
  draggable: boolean
  onContextMenu: (e: KonvaEventObject<PointerEvent>) => void
  handlers: SwatchHandlers
}) {
  const groupRef = useRef<Konva.Group>(null)

  // Cache after mount and re-cache whenever the cached pixels change (color,
  // size, or texture identity) — NOT on position, which is local to the cache.
  useLayoutEffect(() => {
    const g = groupRef.current
    // Guard for the jsdom test mock, where the ref is a plain div with no cache().
    if (g && typeof g.cache === "function") {
      g.cache()
    }
  }, [color, radius, pencil, border])

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable={draggable}
      onContextMenu={onContextMenu}
      {...handlers}
    >
      {/* Solid disc = the point's sampled color (hard circle). */}
      <Circle x={0} y={0} radius={radius} fill={color} />
      {/* Pencil striation multiplied over the disc — darkens ≤~22% so the tint
          stays faithful. Composites inside the cached buffer only (AC6). */}
      <KonvaImage
        image={pencil}
        x={-radius}
        y={-radius}
        width={2 * radius}
        height={2 * radius}
        globalCompositeOperation="multiply"
        listening={false}
      />
      {/* Clip the disc+striation to the pencil's feathered circular alpha so the
          hard disc edge doesn't show — destination-in keeps buffer pixels only
          where the pencil is opaque. Isolated by the group cache. */}
      <KonvaImage
        image={pencil}
        x={-radius}
        y={-radius}
        width={2 * radius}
        height={2 * radius}
        globalCompositeOperation="destination-in"
        listening={false}
      />
      {/* Rough white chalk ring on top, drawn as-is (no tint). Omitted for the
          ring-less "pastel" style (border === null). */}
      {border && (
        <KonvaImage
          image={border}
          x={-radius}
          y={-radius}
          width={2 * radius}
          height={2 * radius}
          listening={false}
        />
      )}
    </Group>
  )
}

export function getSwatchPos(
  p: EyedropperPoint,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): { x: number; y: number } {
  // Free-floating: absolute canvas position overrides edge layout.
  if (p.swatchX !== null && p.swatchY !== null) {
    return { x: p.swatchX, y: p.swatchY }
  }
  const r = swatchRadius
  switch (p.swatchSide) {
    case "left":   return { x: r, y: p.swatchOrder! }
    case "right":  return { x: canvasWidth - r, y: p.swatchOrder! }
    case "top":    return { x: p.swatchOrder!, y: r }
    case "bottom": return { x: p.swatchOrder!, y: canvasHeight - r }
    default:       return { x: r, y: p.swatchOrder ?? canvasHeight / 2 }
  }
}

export default function EyedropperLayer({
  points,
  imageScale = 1,
  imageOffsetX = 0,
  imageOffsetY,
  canvasWidth,
  canvasHeight,
  panX = 0,
  panY = 0,
  style,
  sizeScale,
  interactionMode,
  pencilTexture,
  borderTexture,
  onMarkerDragMove,
  onMarkerDragEnd,
  onSwatchDragMove,
  onSwatchDragEnd,
  onRequestRemove,
  onSelectPoint,
  onConnectorDragMove,
  onConnectorDragEnd,
  labelEditMode,
  selectedPointId,
  precisionRadius = 0,
}: Props) {
  // Draw the textured swatch only when the style asks for it AND the pencil has
  // decoded; otherwise the flat Circle is the fallback (float always takes
  // that path, and pastel does too for the frame before load). The border is
  // independent: the plain "pastel" style has none, so it is NOT required here.
  const useTexture = !!(style.swatchTexture && pencilTexture)

  // Precompute per-point geometry once so we can render in TWO passes: all
  // connector lines first (underneath), then all swatches/markers/handles on
  // top. A single Group-per-point would let a LATER point's connector paint over
  // an EARLIER point's swatch when the lines cross — swatches must always win.
  const rendered = points
    .filter((p) => !(p.swatchOrder === null && (p.swatchX === null || p.swatchY === null)))
    .map((p) => {
      const marker = imageToCanvas(p.x, p.y, {
        canvasWidth,
        canvasHeight,
        imageScale,
        imageOffsetX,
        imageOffsetY,
      })
      const swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)
      const connector = computeConnectorGeometry({
        swatch: swatchPos,
        marker: { x: marker.x, y: marker.y },
        connectorMid: p.connectorMid,
        connectorType: style.connectorType,
        swatchSide: p.swatchSide,
      })
      return { p, markerX: marker.x, markerY: marker.y, swatchPos, connector }
    })

  return (
    <Layer x={panX} y={panY}>
      {/* Pass 1 — all connector lines, underneath every swatch/marker. */}
      {style.connectorType !== "none" &&
        rendered.map(({ p, connector }) => (
          <Line
            key={p.id}
            points={connector.linePoints}
            tension={connector.curved ? 0.5 : 0}
            stroke={style.connectorColor}
            strokeWidth={style.connectorWidth}
            listening={false}
          />
        ))}

      {/* Pass 2 — swatches, markers, precision cues, and bend handles on top. */}
      {rendered.map(({ p, markerX, markerY, swatchPos, connector }) => {
        // Show the bend handle only for the SELECTED point, only in select mode,
        // and never in label-edit mode. This keeps at most one small handle on the
        // canvas (uncluttered) and gates interactivity per AC7. Export additionally
        // hides handles by name in handleExport (belt-and-suspenders — see index.tsx).
        const showConnectorHandle =
          style.connectorType !== "none" &&
          interactionMode === "select" &&
          !labelEditMode &&
          selectedPointId === p.id

        // Shared right-click remove — attached to whichever swatch node renders.
        const onSwatchContextMenu = (e: KonvaEventObject<PointerEvent>) => {
          e.evt.preventDefault()
          onRequestRemove(p.id, e.evt.clientX, e.evt.clientY)
        }
        // Shared select-mode handlers, factored once so the flat and textured
        // swatch paths cannot drift. e.target.x()/y() read the node position,
        // which is the swatch centre for both the flat Circle and the Group.
        const swatchHandlers: SwatchHandlers =
          interactionMode === "select"
            ? {
                onClick: (e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true
                  onSelectPoint(p.id)
                },
                // Konva calls dragBoundFunc with ABSOLUTE (stage-pixel) coords
                // and applies the return via setAbsolutePosition, so the
                // canvas-space bounds must be scaled by the stage scale. The
                // swatch is freely draggable in 2D and clamped to stay fully
                // inside the 9:16 canvas (image area or letterbox padding).
                dragBoundFunc: function (pos) {
                  // Konva passes ABSOLUTE stage-pixel coords and applies the result
                  // via setAbsolutePosition. The VISIBLE 9:16 frame is fixed on
                  // screen at [r·s, dim·s − r·s] — independent of pan — so the swatch
                  // can always reach the current visible edge. (The Layer's own
                  // (panX, panY) translate positions the node visually; the clamp
                  // must NOT re-add pan or the swatch would stop at the pre-pan edge.)
                  const s = this.getStage()?.scaleX() ?? 1
                  const r = style.swatchRadius * s
                  const w = canvasWidth * s
                  const h = canvasHeight * s
                  return {
                    x: Math.max(r, Math.min(w - r, pos.x)),
                    y: Math.max(r, Math.min(h - r, pos.y)),
                  }
                },
                onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "grab"
                },
                onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "default"
                },
                onDragMove: (e: KonvaEventObject<DragEvent>) => {
                  // Story 5.2: snap the node visually to the aligned position
                  // returned by the handler (same write-back pattern as onDragEnd).
                  // Holding Alt/Option disables snapping (CAD-style free placement).
                  const snapped = onSwatchDragMove(p.id, e.target.x(), e.target.y(), e.evt.altKey)
                  e.target.x(snapped.x)
                  e.target.y(snapped.y)
                },
                onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                  const snapped = onSwatchDragEnd(p.id, e.target.x(), e.target.y())
                  e.target.x(snapped.x)
                  e.target.y(snapped.y)
                },
              }
            : {}

        return (
          <Group key={p.id}>
            {/* Connector lines render in pass 1 above so a later point's line can
                never paint over an earlier point's swatch when they cross. */}

            {/* Swatch — textured (pastel) or flat Circle (fallback). */}
            {useTexture ? (
              <TexturedSwatch
                color={p.color}
                radius={style.swatchRadius}
                pencil={pencilTexture!}
                border={style.borderTexture ? borderTexture ?? null : null}
                x={swatchPos.x}
                y={swatchPos.y}
                draggable={interactionMode === "select"}
                onContextMenu={onSwatchContextMenu}
                handlers={swatchHandlers}
              />
            ) : (
              <Circle
                x={swatchPos.x}
                y={swatchPos.y}
                radius={style.swatchRadius}
                fill={p.color}
                stroke={style.swatchBorderColor}
                strokeWidth={style.swatchBorderWidth}
                draggable={interactionMode === "select"}
                onContextMenu={onSwatchContextMenu}
                {...swatchHandlers}
              />
            )}

            {/* Marker — hollow ring or filled dot depending on style.markerStyle.
                Base sizes scaled by the global sizeScale in lockstep with the swatch. */}
            <Circle
              x={markerX}
              y={markerY}
              radius={(style.markerStyle === "dot" ? 6 : 12) * sizeScale}
              fill={style.markerStyle === "dot" ? style.markerColor : undefined}
              stroke={style.markerColor}
              strokeWidth={style.markerStyle === "dot" ? 0 : 2 * sizeScale}
              draggable={interactionMode === "select"}
              onContextMenu={(e: KonvaEventObject<PointerEvent>) => {
                e.evt.preventDefault()
                onRequestRemove(p.id, e.evt.clientX, e.evt.clientY)
              }}
              {...(interactionMode === "select" && {
                onClick: (e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true
                  onSelectPoint(p.id)
                },
                onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "move"
                },
                onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "default"
                },
                onDragMove: (e: KonvaEventObject<DragEvent>) => {
                  onMarkerDragMove(p.id, e.target.x(), e.target.y())
                },
                onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                  const snapped = onMarkerDragEnd(p.id, e.target.x(), e.target.y())
                  // Snap the node to the clamped final position so it doesn't
                  // sit at the (possibly out-of-bounds) drop point for a frame
                  // before React reconciles the new coords.
                  e.target.x(snapped.x)
                  e.target.y(snapped.y)
                },
              })}
            />

            {/* Precision cue — a dashed ring around the marker showing the area
                sampleColor averages, sized to precisionRadius (canvas units).
                Shown only while the Precision slider is active; non-interactive so
                it never blocks drags, and unmounted otherwise so it's absent from
                the export. Stroke/dash scaled by sizeScale to stay ~constant on
                screen (matches the marker's constant-size treatment). */}
            {precisionRadius > 0 && (
              <Circle
                x={markerX}
                y={markerY}
                radius={precisionRadius}
                stroke={style.markerColor}
                strokeWidth={1.5 * sizeScale}
                dash={[4 * sizeScale, 3 * sizeScale]}
                listening={false}
              />
            )}

            {/* Bend handle (Story 5.4) — a small draggable ring at the connector's
                current midpoint, drawn ON TOP so it is easy to grab. Drag it to bow
                the line through that point. Shown only for the selected point in
                select mode (see showConnectorHandle) so at most one is ever visible
                and the canvas stays uncluttered; gated so it never reacts in
                add/label-edit mode (AC7). Named "connector-handle" so handleExport
                can hide it before toDataURL (AC8 — handles are chrome, not artwork). */}
            {showConnectorHandle && (
              <Circle
                name="connector-handle"
                x={connector.handle.x}
                y={connector.handle.y}
                radius={6}
                fill="#c4956a99"
                stroke="#c4956a"
                strokeWidth={1.5}
                hitStrokeWidth={16}
                draggable
                // Stop the click (which Konva also fires after a drag on release)
                // from bubbling to the Stage's select-mode onClick, which would
                // call onDeselect() and unmount this handle — mirrors the swatch
                // and marker onClick guards above.
                onClick={(e: KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true
                }}
                dragBoundFunc={function (pos) {
                  // Konva passes absolute stage-pixel coords; scale the canvas
                  // bounds by the stage scale. No radius inset — the handle may sit
                  // anywhere on the canvas (over image or letterbox). The Layer is
                  // translated by (panX, panY), so the band shifts by pan·scale.
                  const s = this.getStage()?.scaleX() ?? 1
                  const w = canvasWidth * s
                  const h = canvasHeight * s
                  const px = panX * s
                  const py = panY * s
                  return {
                    x: Math.max(px, Math.min(w + px, pos.x)),
                    y: Math.max(py, Math.min(h + py, pos.y)),
                  }
                }}
                onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "grab"
                }}
                onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
                  const c = e.target.getStage()?.container()
                  if (c) c.style.cursor = "default"
                }}
                onDragMove={(e: KonvaEventObject<DragEvent>) => {
                  const next = onConnectorDragMove?.(p.id, e.target.x(), e.target.y())
                  if (next) {
                    e.target.x(next.x)
                    e.target.y(next.y)
                  }
                }}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                  const next = onConnectorDragEnd?.(p.id, e.target.x(), e.target.y())
                  if (next) {
                    e.target.x(next.x)
                    e.target.y(next.y)
                  }
                }}
              />
            )}
          </Group>
        )
      })}
    </Layer>
  )
}
