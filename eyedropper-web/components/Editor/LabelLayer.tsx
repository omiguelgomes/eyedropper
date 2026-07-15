"use client"

import { Layer, Text } from "react-konva"
import type { EyedropperPoint } from "@/lib/types"
import type { Style } from "@/lib/styles"
import { resolveFontFamily } from "@/lib/fonts"

interface Props {
  points: EyedropperPoint[]
  style: Style
  canvasWidth: number
  canvasHeight: number
  // Pan offset (canvas units) applied as a Layer translate so labels move rigidly
  // with their swatches/markers during a pan. Default 0 (existing callers/tests).
  panX?: number
  panY?: number
}

// Static Konva text labels shown in DISPLAY mode, and also kept mounted in edit
// mode as the live preview under the transparent LabelEditOverlay. Position comes
// from the stored label.x/label.y (the source of truth — seeded on edit-mode
// entry and updated by dragging), so labels stay where the artist dragged them.
export default function LabelLayer({ points, style, panX = 0, panY = 0 }: Props) {
  return (
    <Layer x={panX} y={panY}>
      {points.map((p) => {
        if (p.swatchOrder === null) return null
        if (!p.label.visible) return null
        if (p.label.text === "") return null

        return (
          <Text
            key={p.id}
            x={p.label.x}
            y={p.label.y}
            text={p.label.text}
            fontSize={p.label.fontSize}
            fontFamily={resolveFontFamily(p.label.fontFamily)}
            fill={p.label.color}
            align={style.labelPosition === "below" ? "center" : "left"}
            listening={false}
          />
        )
      })}
    </Layer>
  )
}
