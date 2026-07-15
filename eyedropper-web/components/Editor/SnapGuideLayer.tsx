"use client"

import { Layer, Line } from "react-konva"
import type { SnapGuide } from "@/lib/swatch-layout"

interface Props {
  guides: SnapGuide[]
  canvasWidth: number
  canvasHeight: number
  scale: number
  // Pan offset (canvas units) applied as a Layer translate so guides stay
  // registered with the panned swatch centers. Default 0.
  panX?: number
  panY?: number
}

// Renders the ephemeral CAD-style alignment guides emitted by computeSwatchSnap
// while a free swatch is dragged (Story 5.2). Non-interactive; an empty guides
// array renders nothing. strokeWidth/dash are divided by `scale` so they appear
// ~1 screen px regardless of the downscaled stage.
export default function SnapGuideLayer({ guides, canvasWidth, canvasHeight, scale, panX = 0, panY = 0 }: Props) {
  if (guides.length === 0) return null
  const w = 1 / scale
  const dash = [6 / scale, 4 / scale]
  return (
    <Layer listening={false} x={panX} y={panY}>
      {guides.map((g, i) => (
        <Line
          key={`${g.axis}-${g.pos}-${i}`}
          points={g.axis === "x" ? [g.pos, 0, g.pos, canvasHeight] : [0, g.pos, canvasWidth, g.pos]}
          stroke="#c4956a"
          strokeWidth={w}
          dash={dash}
        />
      ))}
    </Layer>
  )
}
