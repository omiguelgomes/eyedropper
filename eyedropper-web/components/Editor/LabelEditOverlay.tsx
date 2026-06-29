"use client"

import { useRef } from "react"
import type { EyedropperPoint } from "@/lib/types"
import { resolveFontFamily } from "@/lib/fonts"

interface Props {
  points: EyedropperPoint[]
  canvasWidth: number
  canvasHeight: number
  scale: number
  onUpdateLabelText: (id: string, text: string) => void
  onUpdateLabelPos: (id: string, x: number, y: number) => void
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// HTML text-input overlay shown in EDIT mode (labelEditMode === true). Konva has
// no native editable text, so the standard recipe is absolutely-positioned HTML
// inputs on top of the canvas. Each label is the controlled <input> (typing) plus
// a drag-grip beside it (free dragging). Position comes from the stored
// label.x/label.y (source of truth), converted to screen space via `scale`.
export default function LabelEditOverlay({
  points,
  canvasWidth,
  canvasHeight,
  scale,
  onUpdateLabelText,
  onUpdateLabelPos,
}: Props) {
  // Active drag: maps the captured pointerId to the label's start position so
  // onPointerMove can compute the new (clamped) canvas-space coords.
  const dragRef = useRef<{
    id: string
    pointerId: number
    startScreenX: number
    startScreenY: number
    startX: number
    startY: number
  } | null>(null)

  return (
    // pointer-events: none lets empty areas pass clicks through to the canvas;
    // each label wrapper re-enables pointer events on itself.
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {points.map((p, i) => {
        if (p.swatchOrder === null) return null
        if (!p.label.visible) return null

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.label.x * scale,
              top: p.label.y * scale,
              display: "flex",
              alignItems: "center",
              gap: 2,
              pointerEvents: "auto",
            }}
          >
            <span
              role="button"
              tabIndex={0}
              aria-label={`Drag label ${i + 1}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId)
                dragRef.current = {
                  id: p.id,
                  pointerId: e.pointerId,
                  startScreenX: e.clientX,
                  startScreenY: e.clientY,
                  startX: p.label.x,
                  startY: p.label.y,
                }
              }}
              onPointerMove={(e) => {
                const d = dragRef.current
                if (!d || d.pointerId !== e.pointerId) return
                const nx = clamp(d.startX + (e.clientX - d.startScreenX) / scale, 0, canvasWidth)
                const ny = clamp(d.startY + (e.clientY - d.startScreenY) / scale, 0, canvasHeight)
                // Use the captured id from the ref, not the render-closure p.id —
                // if points reorder mid-drag the closure could point elsewhere.
                onUpdateLabelPos(d.id, nx, ny)
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                dragRef.current = null
              }}
              // Keyboard nudge: the grip is announced as a button, so it must be
              // operable without a pointer. Arrow keys move the label 1px (canvas
              // space), clamped to the canvas like dragging.
              onKeyDown={(e) => {
                const step =
                  e.key === "ArrowLeft" ? [-1, 0]
                  : e.key === "ArrowRight" ? [1, 0]
                  : e.key === "ArrowUp" ? [0, -1]
                  : e.key === "ArrowDown" ? [0, 1]
                  : null
                if (!step) return
                e.preventDefault()
                const nx = clamp(p.label.x + step[0], 0, canvasWidth)
                const ny = clamp(p.label.y + step[1], 0, canvasHeight)
                onUpdateLabelPos(p.id, nx, ny)
              }}
              style={{
                cursor: "move",
                fontSize: 12,
                lineHeight: 1,
                padding: "1px 2px",
                color: "var(--color-accent)",
                userSelect: "none",
                touchAction: "none",
              }}
            >
              ⠿
            </span>
            <input
              type="text"
              data-point-id={p.id}
              aria-label={`Label text for point ${i + 1}`}
              value={p.label.text}
              onChange={(e) => onUpdateLabelText(p.id, e.target.value)}
              style={{
                pointerEvents: "auto",
                minWidth: 80,
                padding: "1px 4px",
                fontSize: 12,
                fontFamily: resolveFontFamily(p.label.fontFamily),
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid var(--color-accent)",
                borderRadius: 3,
                color: "#1a1a1a",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
