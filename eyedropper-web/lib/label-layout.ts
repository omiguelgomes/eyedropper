import type { EyedropperPoint } from "./types"
import type { Style } from "./styles"

// Gap (px, canvas space) between the swatch edge and the label.
export const LABEL_GAP = 8

// Compute the canvas-space ORIGIN (top-left) where a label sits relative to its
// swatch. Pure. The caller supplies the swatch position (getSwatchPos) and the
// measured label box (labelWidth/labelHeight) so this never touches a canvas.
//
// - "below": centered under the swatch — origin x = swatchCenterX - labelWidth/2;
//   ABOVE a bottom-edge swatch, whose "below" would fall off the canvas floor.
// - "beside": to the inner side of the swatch at its vertical center. Left-edge
//   swatch → label right; right-edge swatch → label left; top/bottom/auto → right.
//
// The whole BOX is finally clamped into [0, canvasWidth-labelWidth] ×
// [0, canvasHeight-labelHeight] so no part of the label seeds off-screen.
export function getLabelPosition(
  swatchPos: { x: number; y: number },
  side: EyedropperPoint["swatchSide"],
  labelPosition: Style["labelPosition"],
  swatchRadius: number,
  canvasWidth: number,
  canvasHeight: number,
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  let pos: { x: number; y: number }
  if (labelPosition === "below") {
    const dy = side === "bottom" ? -(swatchRadius + LABEL_GAP) : swatchRadius + LABEL_GAP
    pos = { x: swatchPos.x - labelWidth / 2, y: swatchPos.y + dy }
  } else if (side === "right") {
    pos = { x: swatchPos.x - swatchRadius - LABEL_GAP, y: swatchPos.y }
  } else {
    pos = { x: swatchPos.x + swatchRadius + LABEL_GAP, y: swatchPos.y }
  }
  return {
    x: Math.max(0, Math.min(canvasWidth - labelWidth, pos.x)),
    y: Math.max(0, Math.min(canvasHeight - labelHeight, pos.y)),
  }
}
