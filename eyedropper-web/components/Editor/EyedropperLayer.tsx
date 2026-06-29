"use client"

import { Layer, Circle, Line, Group } from "react-konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { EyedropperPoint } from "@/lib/types"
import type { Style } from "@/lib/styles"

interface Props {
  points: EyedropperPoint[]
  imageOffsetY: number
  canvasWidth: number
  canvasHeight: number
  style: Style
  interactionMode: "select" | "add"
  onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
  onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onSwatchDragMove: (id: string, canvasX: number, canvasY: number) => void
  onSwatchDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onRequestRemove: (id: string, clientX: number, clientY: number) => void
  onSelectPoint: (id: string) => void
}

export function getSwatchPos(
  p: EyedropperPoint,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): { x: number; y: number } {
  const r = swatchRadius
  switch (p.swatchSide) {
    case "left":   return { x: r, y: p.swatchOrder! }
    case "right":  return { x: canvasWidth - r, y: p.swatchOrder! }
    case "top":    return { x: p.swatchOrder!, y: r }
    case "bottom": return { x: p.swatchOrder!, y: canvasHeight - r }
    default:       return { x: r, y: p.swatchOrder ?? canvasHeight / 2 }
  }
}

function getCurvedMidpoint(
  sx: number, sy: number,
  mx: number, my: number,
  side: string
): [number, number] {
  const cx = (sx + mx) / 2
  const cy = (sy + my) / 2
  const offset = 40
  if (side === "left")   return [cx - offset, cy]
  if (side === "right")  return [cx + offset, cy]
  if (side === "top")    return [cx, cy - offset]
  if (side === "bottom") return [cx, cy + offset]
  return [cx, cy]
}

export default function EyedropperLayer({
  points,
  imageOffsetY,
  canvasWidth,
  canvasHeight,
  style,
  interactionMode,
  onMarkerDragMove,
  onMarkerDragEnd,
  onSwatchDragMove,
  onSwatchDragEnd,
  onRequestRemove,
  onSelectPoint,
}: Props) {
  return (
    <Layer>
      {points.map((p) => {
        if (p.swatchOrder === null) return null

        const markerX = p.x
        const markerY = p.y + imageOffsetY
        const swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)
        const [midCx, midCy] = getCurvedMidpoint(
          swatchPos.x, swatchPos.y,
          markerX, markerY,
          p.swatchSide
        )

        return (
          <Group key={p.id}>
            {/* Connector — drawn first (underneath) */}
            {style.connectorType !== "none" && (
              <Line
                points={
                  style.connectorType === "curved"
                    ? [swatchPos.x, swatchPos.y, midCx, midCy, markerX, markerY]
                    : [swatchPos.x, swatchPos.y, markerX, markerY]
                }
                tension={style.connectorType === "curved" ? 0.5 : 0}
                stroke={style.connectorColor}
                strokeWidth={style.connectorWidth}
                listening={false}
              />
            )}

            {/* Swatch circle */}
            <Circle
              x={swatchPos.x}
              y={swatchPos.y}
              radius={style.swatchRadius}
              fill={p.color}
              stroke={style.swatchBorderColor}
              strokeWidth={style.swatchBorderWidth}
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
                // Konva calls dragBoundFunc with ABSOLUTE (stage-pixel) coords
                // and applies the return via setAbsolutePosition, so the
                // canvas-space bounds must be scaled by the stage scale.
                dragBoundFunc: function (pos) {
                  const s = this.getStage()?.scaleX() ?? 1
                  const r = style.swatchRadius * s
                  const w = canvasWidth * s
                  const h = canvasHeight * s
                  if (p.swatchSide === "left")   return { x: r,     y: Math.max(r, Math.min(h - r, pos.y)) }
                  if (p.swatchSide === "right")  return { x: w - r, y: Math.max(r, Math.min(h - r, pos.y)) }
                  if (p.swatchSide === "top")    return { x: Math.max(r, Math.min(w - r, pos.x)), y: r }
                  if (p.swatchSide === "bottom") return { x: Math.max(r, Math.min(w - r, pos.x)), y: h - r }
                  return pos
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
                  onSwatchDragMove(p.id, e.target.x(), e.target.y())
                },
                onDragEnd: (e: KonvaEventObject<DragEvent>) => {
                  const snapped = onSwatchDragEnd(p.id, e.target.x(), e.target.y())
                  e.target.x(snapped.x)
                  e.target.y(snapped.y)
                },
              })}
            />

            {/* Marker — hollow ring or filled dot depending on style.markerStyle */}
            {style.markerStyle !== "none" && (
              <Circle
                x={markerX}
                y={markerY}
                radius={style.markerStyle === "dot" ? 6 : 12}
                fill={style.markerStyle === "dot" ? style.markerColor : undefined}
                stroke={style.markerColor}
                strokeWidth={style.markerStyle === "dot" ? 0 : 2}
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
            )}
          </Group>
        )
      })}
    </Layer>
  )
}
