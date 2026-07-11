"use client"

import { useLayoutEffect, useRef } from "react"
import { Stage, Layer, Circle, Line, Group, Image as KonvaImage } from "react-konva"
import type Konva from "konva"
import type { Style } from "@/lib/styles"

const THUMB_W = 60
const THUMB_H = 80

// Fixed sample points in thumbnail-pixel space: a marker over the drawing and a
// swatch pinned to the right edge. Hardcoded warm skin tones so the preview
// reads "at a glance" without sampling the image. Three points is enough to
// show the connector fanning and the relative swatch size.
const SAMPLE_POINTS: { markerX: number; markerY: number; swatchY: number; color: string }[] = [
  { markerX: 22, markerY: 20, swatchY: 16, color: "#e8c4a0" },
  { markerX: 28, markerY: 42, swatchY: 40, color: "#c98a5e" },
  { markerX: 20, markerY: 60, swatchY: 64, color: "#a86a45" },
]

// Reduced swatch radius — the real radius (40–48) would dwarf a 60px-wide
// thumbnail. A small fixed radius keeps the connector + marker readable while
// the style's border still shows.
const SWATCH_R = 7

function curvedMidpoint(sx: number, sy: number, mx: number, my: number): [number, number] {
  // Swatches sit on the right edge, so bow the curve to the right (matching the
  // real EyedropperLayer "right" side offset, scaled down).
  const cx = (sx + mx) / 2
  const cy = (sy + my) / 2
  return [cx + 10, cy]
}

// Thumbnail-scale textured swatch (pastel). Same disc × pencil(multiply) ∩
// pencil-alpha + border pipeline as EyedropperLayer, in a cached Group so the
// composite ops stay isolated from the sample drawing beneath (AC9). Small
// enough that a faithful-enough approximation reads as pastel at a glance.
function ThumbTexturedSwatch({
  x, y, radius, color, pencil, border,
}: {
  x: number; y: number; radius: number; color: string
  pencil: HTMLImageElement; border: HTMLImageElement | null
}) {
  const groupRef = useRef<Konva.Group>(null)
  useLayoutEffect(() => {
    const g = groupRef.current
    if (g && typeof g.cache === "function") g.cache()
  }, [color, radius, pencil, border])
  return (
    <Group ref={groupRef} x={x} y={y} listening={false}>
      <Circle x={0} y={0} radius={radius} fill={color} />
      <KonvaImage image={pencil} x={-radius} y={-radius} width={2 * radius} height={2 * radius}
        globalCompositeOperation="multiply" listening={false} />
      <KonvaImage image={pencil} x={-radius} y={-radius} width={2 * radius} height={2 * radius}
        globalCompositeOperation="destination-in" listening={false} />
      {border && (
        <KonvaImage image={border} x={-radius} y={-radius} width={2 * radius} height={2 * radius} listening={false} />
      )}
    </Group>
  )
}

interface Props {
  style: Style
  sampleImg: HTMLImageElement | null
  pencilTexture?: HTMLImageElement | null
  borderTexture?: HTMLImageElement | null
}

export default function StyleThumbnail({ style, sampleImg, pencilTexture, borderTexture }: Props) {
  // Hydration-safe: until the shared sample image has loaded, render a neutral
  // placeholder box (no Konva Stage, which needs a real browser canvas).
  if (!sampleImg) {
    return (
      <div
        data-testid="thumbnail-placeholder"
        style={{ width: THUMB_W, height: THUMB_H }}
        className="bg-[var(--color-border)] rounded"
      />
    )
  }

  const swatchX = THUMB_W - SWATCH_R
  // Pencil-only gate (the border is optional — the ring-less "pastel" has none).
  const useTexture = !!(style.swatchTexture && pencilTexture)

  return (
    <Stage width={THUMB_W} height={THUMB_H}>
      <Layer>
        {/* Sample drawing — same 0.75 aspect ratio as the 60×80 thumbnail */}
        <KonvaImage image={sampleImg} x={0} y={0} width={THUMB_W} height={THUMB_H} />

        {/* Connectors — drawn first (underneath swatches/markers) */}
        {style.connectorType !== "none" &&
          SAMPLE_POINTS.map((p, i) => {
            const [midCx, midCy] = curvedMidpoint(swatchX, p.swatchY, p.markerX, p.markerY)
            return (
              <Line
                key={`connector-${i}`}
                points={
                  style.connectorType === "curved"
                    ? [swatchX, p.swatchY, midCx, midCy, p.markerX, p.markerY]
                    : [swatchX, p.swatchY, p.markerX, p.markerY]
                }
                tension={style.connectorType === "curved" ? 0.5 : 0}
                stroke={style.connectorColor}
                strokeWidth={style.connectorWidth}
                listening={false}
              />
            )
          })}

        {/* Swatches — textured (pastel) or flat, mirroring EyedropperLayer. */}
        {SAMPLE_POINTS.map((p, i) =>
          useTexture ? (
            <ThumbTexturedSwatch
              key={`swatch-${i}`}
              x={swatchX}
              y={p.swatchY}
              radius={SWATCH_R}
              color={p.color}
              pencil={pencilTexture!}
              border={borderTexture ?? null}
            />
          ) : (
            <Circle
              key={`swatch-${i}`}
              x={swatchX}
              y={p.swatchY}
              radius={SWATCH_R}
              fill={p.color}
              stroke={style.swatchBorderColor}
              strokeWidth={style.swatchBorderWidth}
              listening={false}
            />
          )
        )}

        {/* Markers — ring (hollow) / dot (filled), mirroring EyedropperLayer */}
        {SAMPLE_POINTS.map((p, i) => {
          const isDot = style.markerStyle === "dot"
          return (
            <Circle
              key={`marker-${i}`}
              x={p.markerX}
              y={p.markerY}
              radius={isDot ? 2.5 : 4}
              fill={isDot ? style.markerColor : undefined}
              stroke={style.markerColor}
              strokeWidth={isDot ? 0 : 1.5}
              listening={false}
            />
          )
        })}
      </Layer>
    </Stage>
  )
}
