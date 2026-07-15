"use client"

import { useEffect, useRef } from "react"
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { CanvasLayout } from "@/lib/canvas-layout"
import type { EyedropperPoint } from "@/lib/types"
import type { Style } from "@/lib/styles"
import type { SnapGuide, DistributionGuide } from "@/lib/swatch-layout"
import EyedropperLayer from "./EyedropperLayer"
import LabelLayer from "./LabelLayer"
import LabelEditOverlay from "./LabelEditOverlay"
import SnapGuideLayer from "./SnapGuideLayer"
import DistributionGuideLayer from "./DistributionGuideLayer"

interface CanvasProps {
  image: HTMLImageElement
  stageRef: React.RefObject<Konva.Stage | null>
  canvasLayout: CanvasLayout
  imageHeight: number
  bgColor: string
  displayWidth: number
  displayHeight: number
  points: EyedropperPoint[]
  style: Style
  // Global size multiplier; forwarded to EyedropperLayer to scale the marker
  // dot/ring, whose base sizes are hardcoded there (not on the style).
  sizeScale: number
  interactionMode: "select" | "add" | "pan"
  labelEditMode: boolean
  snapGuides: SnapGuide[]
  distribution: DistributionGuide[]
  pencilTexture: HTMLImageElement | null
  borderTexture: HTMLImageElement | null
  // Clamped pan offset (canvas units). Applied as a uniform view translation to
  // the image AND every annotation layer (markers/connectors/swatches/labels/
  // guides) so the whole scene moves RIGIDLY together during a pan. The layout
  // itself is pan-free; only this render-time translate (and the swatch/handle
  // dragBoundFunc clamps, via panX/panY on EyedropperLayer) know about pan.
  pan: { x: number; y: number }
  // Precision cue: dashed-ring radius in CANVAS units, forwarded to the
  // EyedropperLayer. 0/undefined draws nothing.
  precisionRadius?: number
  // Pan tool: called with the screen-pixel delta since the last pan event.
  onPanBy: (screenDX: number, screenDY: number) => void
  onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
  onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onSwatchDragMove: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onSwatchDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onConnectorDragMove: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onConnectorDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  selectedPointId: string | null
  onAddPoint: (canvasX: number, canvasY: number) => void
  onRequestRemove: (id: string, clientX: number, clientY: number) => void
  onSelectPoint: (id: string) => void
  onDeselect: () => void
  onUpdateLabelText: (id: string, text: string) => void
  onUpdateLabelPos: (id: string, x: number, y: number) => void
  onLabelDragEnd: (id: string, x: number, y: number) => void
}

export default function Canvas({
  image,
  stageRef,
  canvasLayout,
  imageHeight,
  bgColor,
  displayWidth,
  displayHeight,
  points,
  style,
  sizeScale,
  interactionMode,
  labelEditMode,
  snapGuides,
  distribution,
  pencilTexture,
  borderTexture,
  pan,
  precisionRadius,
  onPanBy,
  onMarkerDragMove,
  onMarkerDragEnd,
  onSwatchDragMove,
  onSwatchDragEnd,
  onConnectorDragMove,
  onConnectorDragEnd,
  selectedPointId,
  onAddPoint,
  onRequestRemove,
  onSelectPoint,
  onDeselect,
  onUpdateLabelText,
  onUpdateLabelPos,
  onLabelDragEnd,
}: CanvasProps) {
  const scale = displayWidth / canvasLayout.canvasWidth

  // Last pointer position during a pan drag (screen/display px). null = not
  // panning. Held in a ref so it survives re-renders without re-subscribing.
  const panLast = useRef<{ x: number; y: number } | null>(null)

  // The crosshair cursor is set on mouseenter while in add mode. If the mode
  // switches to "select" while the pointer is still over the image, the add-mode
  // onMouseLeave handler is unmounted before it can fire, leaving the cursor
  // stuck. Reset it explicitly. In pan mode show a grab cursor.
  useEffect(() => {
    const c = stageRef.current?.container()
    if (!c) return
    if (interactionMode === "pan") c.style.cursor = "grab"
    else if (interactionMode !== "add") c.style.cursor = "default"
  }, [interactionMode])

  return (
    <div style={{ position: "relative", width: displayWidth, height: displayHeight }}>
    <Stage
      ref={stageRef}
      width={displayWidth}
      height={displayHeight}
      scaleX={scale}
      scaleY={scale}
      onClick={(e: KonvaEventObject<MouseEvent>) => {
        if (interactionMode === "pan") {
          // Pan mode consumes drags; ignore clicks entirely.
          return
        }
        if (interactionMode === "add") {
          // Konva synthesizes a click for any mouse button, so a right-click
          // (which also opens the Remove context menu) would otherwise add a
          // stray point. Only the primary button should add.
          if (e.evt.button !== 0) return
          const pos = e.target.getStage()?.getRelativePointerPosition()
          if (pos) onAddPoint(pos.x, pos.y)
        } else {
          // Select mode: only empty-area clicks reach the Stage (swatch/marker
          // clicks set cancelBubble), so this is the "click empty canvas" deselect.
          onDeselect()
        }
      }}
      {...(interactionMode === "pan" && {
        onMouseDown: (e: KonvaEventObject<MouseEvent>) => {
          if (e.evt.button !== 0) return
          panLast.current = { x: e.evt.clientX, y: e.evt.clientY }
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = "grabbing"
        },
        onMouseMove: (e: KonvaEventObject<MouseEvent>) => {
          if (!panLast.current) return
          const dx = e.evt.clientX - panLast.current.x
          const dy = e.evt.clientY - panLast.current.y
          panLast.current = { x: e.evt.clientX, y: e.evt.clientY }
          onPanBy(dx, dy)
        },
        onMouseUp: (e: KonvaEventObject<MouseEvent>) => {
          panLast.current = null
          const c = e.target.getStage()?.container()
          if (c) c.style.cursor = "grab"
        },
        onMouseLeave: () => {
          panLast.current = null
        },
      })}
    >
      <Layer>
        <Rect
          x={0}
          y={0}
          width={canvasLayout.canvasWidth}
          height={canvasLayout.canvasHeight}
          fill={bgColor}
        />
        <KonvaImage
          image={image}
          x={canvasLayout.imageOffsetX + pan.x}
          y={canvasLayout.imageOffsetY + pan.y}
          width={canvasLayout.canvasWidth * canvasLayout.imageScale}
          height={imageHeight * canvasLayout.imageScale}
          listening={interactionMode !== "pan"}
          {...(interactionMode === "add" && {
            onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
              const c = e.target.getStage()?.container()
              if (c) c.style.cursor = "crosshair"
            },
            onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
              const c = e.target.getStage()?.container()
              if (c) c.style.cursor = "default"
            },
          })}
        />
      </Layer>
      <EyedropperLayer
        points={points}
        imageScale={canvasLayout.imageScale}
        imageOffsetX={canvasLayout.imageOffsetX}
        imageOffsetY={canvasLayout.imageOffsetY}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        panX={pan.x}
        panY={pan.y}
        style={style}
        sizeScale={sizeScale}
        interactionMode={interactionMode}
        pencilTexture={pencilTexture}
        borderTexture={borderTexture}
        onMarkerDragMove={onMarkerDragMove}
        onMarkerDragEnd={onMarkerDragEnd}
        onSwatchDragMove={onSwatchDragMove}
        onSwatchDragEnd={onSwatchDragEnd}
        onConnectorDragMove={onConnectorDragMove}
        onConnectorDragEnd={onConnectorDragEnd}
        labelEditMode={labelEditMode}
        selectedPointId={selectedPointId}
        precisionRadius={precisionRadius}
        onRequestRemove={onRequestRemove}
        onSelectPoint={onSelectPoint}
      />
      {/* Guides above swatches (CAD convention); empty array renders nothing.
          Translated by pan like the swatches they align, so the guide lines stay
          registered with the panned swatch centers. */}
      <SnapGuideLayer
        guides={snapGuides}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        scale={scale}
        panX={pan.x}
        panY={pan.y}
      />
      {/* Equal-interval gap badges (Story 5.3); null renders nothing. The
          alignment line (SnapGuideLayer) and the badges are complementary:
          line = "aligned axis", badges = "equal gaps". */}
      <DistributionGuideLayer distribution={distribution} scale={scale} panX={pan.x} panY={pan.y} />
      {/* Kept mounted in BOTH modes: in edit mode it is the live preview that the
          transparent LabelEditOverlay inputs sit exactly on top of, so what the
          artist sees while typing is pixel-identical to the export. Panned with
          the scene so labels stay attached to their swatches. */}
      <LabelLayer
        points={points}
        style={style}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        panX={pan.x}
        panY={pan.y}
      />
    </Stage>
    {labelEditMode && (
      <LabelEditOverlay
        points={points}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        scale={scale}
        panX={pan.x}
        panY={pan.y}
        onUpdateLabelText={onUpdateLabelText}
        onUpdateLabelPos={onUpdateLabelPos}
        onLabelDragEnd={onLabelDragEnd}
        onSelectPoint={onSelectPoint}
      />
    )}
    </div>
  )
}
