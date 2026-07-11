import type { EyedropperPoint } from "./types"
import type { Style } from "./styles"

// Gap (px, canvas space) between the swatch edge and the label.
export const LABEL_GAP = 8

// Compute the canvas-space (x, y) where a label sits relative to its swatch.
// Pure: a function of its args only. The caller supplies the already-computed
// swatch position (from getSwatchPos), so this never reads swatchOrder.
//
// - "below": under the swatch — but ABOVE it for a bottom-edge swatch,
//   whose "below" would fall off the bottom of the canvas.
// - "beside": to the inner side of the swatch at its vertical center.
//   A left-edge swatch → label to the right; a right-edge swatch → label to the
//   left; top/bottom/auto default to the right.
//
// The anchor is finally clamped into [0, canvasWidth] × [0, canvasHeight] so a
// label never seeds off-screen for an edge swatch.
export function getLabelPosition(
  swatchPos: { x: number; y: number },
  side: EyedropperPoint["swatchSide"],
  labelPosition: Style["labelPosition"],
  swatchRadius: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  let pos: { x: number; y: number }
  if (labelPosition === "below") {
    // A bottom-edge swatch sits at the canvas floor, so its label goes above it
    // (interior) rather than below (off-canvas).
    const dy = side === "bottom" ? -(swatchRadius + LABEL_GAP) : swatchRadius + LABEL_GAP
    pos = { x: swatchPos.x, y: swatchPos.y + dy }
  } else if (side === "right") {
    pos = { x: swatchPos.x - swatchRadius - LABEL_GAP, y: swatchPos.y }
  } else {
    pos = { x: swatchPos.x + swatchRadius + LABEL_GAP, y: swatchPos.y }
  }
  return {
    x: Math.max(0, Math.min(canvasWidth, pos.x)),
    y: Math.max(0, Math.min(canvasHeight, pos.y)),
  }
}
