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
}

// Static Konva text labels shown in DISPLAY mode (labelEditMode === false).
// Only styles whose labelPosition is "beside" or "below" show labels; "none"
// (minimal) renders nothing. Position comes from the stored
// label.x/label.y (the source of truth — seeded on edit-mode entry and updated
// by dragging), so labels stay where the artist dragged them.
export default function LabelLayer({ points, style }: Props) {
  return (
    <Layer>
      {style.labelPosition === "none"
        ? null
        : points.map((p) => {
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
