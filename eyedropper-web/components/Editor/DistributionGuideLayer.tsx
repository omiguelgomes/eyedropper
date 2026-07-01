"use client"

import { Layer, Arrow } from "react-konva"
import type { DistributionGuide } from "@/lib/swatch-layout"

interface Props {
  distribution: DistributionGuide[]
  scale: number
}

// Screen-px offset of the gap arrows to one side of the alignment line, so the
// measures don't sit on top of the swatches.
const BADGE_OFFSET_PX = 16
// Equal-distance accent — deliberately DISTINCT from the tan alignment guides
// (#c4956a) so the "equal gap" cue reads at a glance.
const EQUAL_DIST_COLOR = "#2dd4bf"
// On-screen stroke / arrowhead size (divided by scale to stay constant).
const STROKE_PX = 2.5
const POINTER_LEN_PX = 8
const POINTER_WIDTH_PX = 8

// Renders the equal-interval gap cue emitted by computeSwatchSnap while a free
// swatch is dragged into an evenly-spaced column/row (Story 5.3). For each
// consecutive pair of marks it draws a bold double-headed arrow spanning the gap
// — every gap drawn identically so equal gaps read as equal (AC4). Multiple cues
// can be active at once (a swatch centred in both a row and a column), so
// `distribution` is an array; each entry renders independently. Non-interactive;
// an empty array (or any sub-2-mark guide) renders nothing.
//
// Axis convention (matches DistributionGuide): axis "y" = vertical column (gaps
// run vertically, arrows offset in +x from the shared X = alignPos); axis "x" =
// horizontal row (gaps run horizontally, arrows offset in +y from shared Y).
// strokeWidth / offset / pointer sizes are divided by `scale` so they're constant
// on-screen despite the downscaled stage (mirrors SnapGuideLayer).
export default function DistributionGuideLayer({ distribution, scale }: Props) {
  const guides = distribution.filter((d) => d.marks.length >= 2)
  if (guides.length === 0) return null
  const w = STROKE_PX / scale
  const off = BADGE_OFFSET_PX / scale
  const pointerLen = POINTER_LEN_PX / scale
  const pointerWidth = POINTER_WIDTH_PX / scale

  // One double-headed arrow per equal gap, drawn at the offset alignment line.
  const arrows: number[][] = []
  for (const { axis, alignPos, marks } of guides) {
    if (axis === "y") {
      // Vertical column: gaps run along Y at x = alignPos + off.
      const mx = alignPos + off
      for (let i = 0; i < marks.length - 1; i++) {
        arrows.push([mx, marks[i], mx, marks[i + 1]])
      }
    } else {
      // Horizontal row: gaps run along X at y = alignPos + off.
      const my = alignPos + off
      for (let i = 0; i < marks.length - 1; i++) {
        arrows.push([marks[i], my, marks[i + 1], my])
      }
    }
  }

  return (
    <Layer listening={false}>
      {arrows.map((points, i) => (
        <Arrow
          key={i}
          points={points}
          stroke={EQUAL_DIST_COLOR}
          fill={EQUAL_DIST_COLOR}
          strokeWidth={w}
          pointerLength={pointerLen}
          pointerWidth={pointerWidth}
          pointerAtBeginning
        />
      ))}
    </Layer>
  )
}
