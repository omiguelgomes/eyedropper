export function sampleColor(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const cx = Math.max(4, Math.min(ctx.canvas.width - 4, Math.round(x)))
  const cy = Math.max(4, Math.min(ctx.canvas.height - 4, Math.round(y)))
  const data = ctx.getImageData(cx - 4, cy - 4, 8, 8).data
  let r = 0, g = 0, b = 0
  const n = 64
  for (let i = 0; i < n; i++) {
    r += data[i * 4]
    g += data[i * 4 + 1]
    b += data[i * 4 + 2]
  }
  return `#${Math.round(r / n).toString(16).padStart(2, "0")}${Math.round(g / n).toString(16).padStart(2, "0")}${Math.round(b / n).toString(16).padStart(2, "0")}`
}
