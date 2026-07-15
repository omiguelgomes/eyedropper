import type { Style } from "./styles"

// Scale a base style's chrome dimensions for display. Style dimensions are
// authored as ON-SCREEN pixel references at 1×; dividing by stageScale (display
// px per canvas px) cancels the viewport-fit magnification so the swatch/
// connector/border render at a CONSTANT on-screen size regardless of aspect
// ratio, crop, image resolution, or window size. `sizeScale` (the user slider,
// 1–2.5×) then multiplies that constant. The result: on-screen size = base ×
// sizeScale, independent of stageScale. Marker dot/ring sizes are hardcoded in
// EyedropperLayer and get the same treatment via the `sizeScale` prop, which the
// component feeds as annotationScale = sizeScale / stageScale. Pure.
export function scaleStyleForDisplay(style: Style, sizeScale: number, stageScale: number): Style {
  const s = stageScale > 0 ? stageScale : 1
  const annotationScale = sizeScale / s
  return {
    ...style,
    swatchRadius: style.swatchRadius * annotationScale,
    // Connector grows faster than the swatch: only the GROWTH above 1× is
    // amplified (×1.5), so at rest (1×) the line stays at the style's designed
    // width rather than jumping to 1.5× it. sizeScale (not annotationScale) is
    // the "growth" axis; the whole width is then normalized by /stageScale.
    connectorWidth: style.connectorWidth * (1 + (sizeScale - 1) * 1.5) / s,
    swatchBorderWidth: style.swatchBorderWidth * annotationScale,
  }
}
