"use client"

import { useRef } from "react"
import type { EyedropperPoint } from "@/lib/types"
import { resolveFontFamily } from "@/lib/fonts"
import { measureLabelWidth } from "@/lib/measure-text"

interface Props {
  points: EyedropperPoint[]
  canvasWidth: number
  canvasHeight: number
  scale: number
  // Pan offset (canvas units) — the Konva scene is translated by this, so the HTML
  // input overlay shifts by pan × scale screen px to stay atop the panned labels.
  // Drag math stays in pan-free canvas space (the input reads label.x/y directly).
  panX?: number
  panY?: number
  onUpdateLabelText: (id: string, text: string) => void
  onUpdateLabelPos: (id: string, x: number, y: number) => void
  onSelectPoint: (id: string) => void
  onLabelDragEnd?: (id: string, x: number, y: number) => void
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// HTML text-input overlay shown in EDIT mode (labelEditMode === true). Konva has
// no native editable text, so the standard recipe is absolutely-positioned HTML
// inputs on top of the canvas.
//
// The input is deliberately INVISIBLE (transparent text/background/border): the
// real Konva LabelLayer stays mounted underneath in edit mode and IS the live
// preview, so what the artist sees while typing is pixel-identical to the export.
// The input only captures keystrokes and shows the caret; it is positioned and
// sized to match the Konva Text exactly (origin at label.x/label.y, fontSize and
// family scaled to screen space) so the caret tracks the visible glyphs. A
// drag-grip sits just OUTSIDE the text origin (absolute, left of it) so it never
// shifts the glyphs — the old in-flow grip was the cause of the position drift.
export default function LabelEditOverlay({
  points,
  canvasWidth,
  canvasHeight,
  scale,
  panX = 0,
  panY = 0,
  onUpdateLabelText,
  onUpdateLabelPos,
  onSelectPoint,
  onLabelDragEnd,
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

        // Screen-space font size — the Konva Text renders at label.fontSize in
        // canvas space, so the input must scale by the same factor to line up.
        const screenFont = p.label.fontSize * scale
        // Screen-space width matching the measured glyph run (same measurement
        // getLabelPosition used to place a right-side label so its RIGHT edge sits
        // at the gap). A small floor keeps empty labels clickable. Using the fixed
        // 10ch box instead made right-side boxes overshoot rightward onto the swatch.
        const screenWidth = Math.max(
          measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily) * scale,
          screenFont
        )

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: (p.label.x + panX) * scale,
              top: (p.label.y + panY) * scale,
              pointerEvents: "auto",
            }}
          >
            {/* Drag grip — absolutely placed to the LEFT of the text origin so it
                is outside the text flow and never displaces the glyphs. */}
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
                const d = dragRef.current
                // p.label.x/y (not a ref) is intentional: every pointermove has
                // written the snapped position back to state, so this render's
                // p.label already holds the last drag position. The editor's end
                // handler re-snaps it (idempotent) and clears the guides.
                if (d) onLabelDragEnd?.(d.id, p.label.x, p.label.y)
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
                position: "absolute",
                right: "100%",
                top: "50%",
                transform: "translateY(-50%)",
                marginRight: 4,
                cursor: "move",
                fontSize: 12,
                lineHeight: 1,
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
              onFocus={() => onSelectPoint(p.id)}
              // Transparent text/background/border and zero box padding so the
              // input occupies the exact footprint of the Konva Text beneath it;
              // only the caret is visible. Width tracks the measured glyph run so
              // the box hugs the text and (for right-side labels) doesn't overshoot
              // the origin onto the swatch. A white outline (drawn OUTSIDE the box)
              // makes each input visible in edit mode without shifting the glyphs.
              style={{
                display: "block",
                margin: 0,
                padding: 0,
                border: "none",
                outline: "1px solid #ffffff",
                background: "transparent",
                color: "transparent",
                caretColor: "var(--color-accent)",
                fontSize: screenFont,
                fontFamily: resolveFontFamily(p.label.fontFamily),
                lineHeight: 1,
                height: screenFont,
                width: screenWidth,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
