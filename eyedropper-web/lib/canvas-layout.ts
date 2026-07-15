import type { Ratio } from "./aspect"

// The canvas is a frame of aspect `ratio`. `canvasWidth` stays equal to the
// image's natural width as the reference unit (so export pixelRatio and the
// on-screen scale keep working); `canvasHeight` follows the ratio. The image is
// drawn COVER: scaled up until it fills the frame on both axes, cropping whatever
// overflows — so the drawn image can be wider/taller than the frame and its
// top-left offset can be negative. `pan` slides the crop within the covered area.
//
// Points are stored in IMAGE space (natural pixels). Use imageToCanvas /
// canvasToImage to move between the two. Swatches and labels are stored in CANVAS
// space and are unaffected by the image transform (only by canvasWidth/Height).
export interface CanvasLayout {
  canvasWidth: number
  canvasHeight: number
  imageScale: number
  imageOffsetX: number
  imageOffsetY: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function computeLayout(
  imageWidth: number,
  imageHeight: number,
  ratio: Ratio,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  // Extra magnification (≥1) applied on top of the cover scale so the artist can
  // zoom into a tighter crop before working. Multiplies the drawn image size,
  // which grows the pan slack; markers (drawn via imageScale) follow the zoom,
  // while swatches/labels (canvas space) and chrome are unaffected. 1 = no zoom.
  zoom: number = 1
): CanvasLayout {
  if (imageWidth <= 0 || imageHeight <= 0 || ratio.w <= 0 || ratio.h <= 0) {
    return { canvasWidth: 0, canvasHeight: 0, imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 }
  }

  const canvasWidth = imageWidth
  const canvasHeight = Math.round(canvasWidth * ratio.h / ratio.w)

  // Cover scale: fill the frame on both axes. canvasWidth === imageWidth makes
  // the width term exactly 1, so this is max(1, canvasHeight/imageHeight). Zoom
  // multiplies it so the image is drawn larger and cropped tighter.
  const imageScale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight) * Math.max(1, zoom)

  const drawnW = imageWidth * imageScale
  const drawnH = imageHeight * imageScale

  // Pan is clamped so the image always still covers the frame (no gaps). The
  // slack on each axis is how far the centered image can slide before an edge
  // would expose the frame background.
  const slackX = Math.max(0, (drawnW - canvasWidth) / 2)
  const slackY = Math.max(0, (drawnH - canvasHeight) / 2)
  const panX = clamp(pan.x, -slackX, slackX)
  const panY = clamp(pan.y, -slackY, slackY)

  const imageOffsetX = Math.round((canvasWidth - drawnW) / 2 + panX)
  const imageOffsetY = Math.round((canvasHeight - drawnH) / 2 + panY)

  return { canvasWidth, canvasHeight, imageScale, imageOffsetX, imageOffsetY }
}

// Clamp a pan offset to the layout's covered area — exposed so the pan tool can
// keep its live drag within bounds without recomputing the whole layout.
export function clampPan(
  imageWidth: number,
  imageHeight: number,
  ratio: Ratio,
  pan: { x: number; y: number },
  zoom: number = 1
): { x: number; y: number } {
  if (imageWidth <= 0 || imageHeight <= 0 || ratio.w <= 0 || ratio.h <= 0) return { x: 0, y: 0 }
  const canvasWidth = imageWidth
  const canvasHeight = Math.round(canvasWidth * ratio.h / ratio.w)
  const imageScale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight) * Math.max(1, zoom)
  const slackX = Math.max(0, (imageWidth * imageScale - canvasWidth) / 2)
  const slackY = Math.max(0, (imageHeight * imageScale - canvasHeight) / 2)
  return { x: clamp(pan.x, -slackX, slackX), y: clamp(pan.y, -slackY, slackY) }
}

export function imageToCanvas(
  x: number,
  y: number,
  layout: CanvasLayout
): { x: number; y: number } {
  return {
    x: layout.imageOffsetX + x * layout.imageScale,
    y: layout.imageOffsetY + y * layout.imageScale,
  }
}

export function canvasToImage(
  cx: number,
  cy: number,
  layout: CanvasLayout
): { x: number; y: number } {
  return {
    x: (cx - layout.imageOffsetX) / layout.imageScale,
    y: (cy - layout.imageOffsetY) / layout.imageScale,
  }
}

// Whether an image-space point currently falls INSIDE the visible frame. The
// annotation scene is drawn on the pan-free layout and then translated by `pan`
// on screen, so a point's screen position is imageToCanvas(...) + pan; the frame
// occupies [0, canvasWidth] × [0, canvasHeight]. Used to keep suggestions on the
// currently-visible crop when the image is zoomed/panned under a cover fit.
export function isPointInFrame(
  x: number,
  y: number,
  layout: CanvasLayout,
  pan: { x: number; y: number } = { x: 0, y: 0 }
): boolean {
  const c = imageToCanvas(x, y, layout)
  const sx = c.x + pan.x
  const sy = c.y + pan.y
  return sx >= 0 && sx <= layout.canvasWidth && sy >= 0 && sy <= layout.canvasHeight
}
