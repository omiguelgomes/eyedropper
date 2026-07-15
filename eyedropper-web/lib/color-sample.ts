// Average the color over a square sample box centred on (x, y) in the canvas's
// natural-pixel space. `size` is the box EDGE length in image pixels: the box is
// size×size. Default 8 preserves the original fixed 8×8 (64-pixel) sample. size=1
// reads a true single pixel; the Precision slider raises it so a point averages a
// larger patch, smoothing over local texture/noise. Clamped so the box stays
// on-canvas.
export function sampleColor(ctx: CanvasRenderingContext2D, x: number, y: number, size = 8): string {
  // Clamp the edge so the full box fits, even on a tiny canvas (tests use 10×10).
  // At least 1 so getImageData always reads a non-empty region.
  const edge = Math.max(1, Math.min(Math.round(size), ctx.canvas.width, ctx.canvas.height))
  // Top-left of the box, centred on (x, y) and clamped so it stays on-canvas.
  const x0 = Math.max(0, Math.min(ctx.canvas.width - edge, Math.round(x) - Math.floor(edge / 2)))
  const y0 = Math.max(0, Math.min(ctx.canvas.height - edge, Math.round(y) - Math.floor(edge / 2)))
  const data = ctx.getImageData(x0, y0, edge, edge).data
  let r = 0, g = 0, b = 0
  const n = edge * edge
  for (let i = 0; i < n; i++) {
    r += data[i * 4]
    g += data[i * 4 + 1]
    b += data[i * 4 + 2]
  }
  return `#${Math.round(r / n).toString(16).padStart(2, "0")}${Math.round(g / n).toString(16).padStart(2, "0")}${Math.round(b / n).toString(16).padStart(2, "0")}`
}
