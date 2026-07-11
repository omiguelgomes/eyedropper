import { resolveFontFamily } from "./fonts"

// A single reused offscreen canvas context for text measurement — created lazily
// on first use in the browser. In jsdom getContext("2d") returns null, so we cache
// the null result and fall through to the estimate every time (never re-probe).
let ctx: CanvasRenderingContext2D | null | undefined

function getCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  if (typeof document === "undefined") return (ctx = null)
  ctx = document.createElement("canvas").getContext("2d")
  return ctx
}

// Canvas-space width (px) of `text` at the label's font. Falls back to a coarse
// estimate when no 2D context is available (jsdom) so callers and tests stay
// deterministic without a real canvas backend. `fontFamily` is the label's stored
// font key; resolveFontFamily maps it to the @font-face family Konva renders with.
export function measureLabelWidth(text: string, fontSize: number, fontFamily: string): number {
  const c = getCtx()
  if (c) {
    c.font = `${fontSize}px ${resolveFontFamily(fontFamily)}`
    const w = c.measureText(text).width
    if (w > 0) return w
  }
  return Math.max(text.length, 1) * fontSize * 0.55
}
