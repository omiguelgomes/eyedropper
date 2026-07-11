"use client"

import { useEffect } from "react"
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva"
import type Konva from "konva"
import type { KonvaEventObject } from "konva/lib/Node"
import type { CanvasLayout } from "@/lib/canvas-to-916"
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
  interactionMode: "select" | "add"
  labelEditMode: boolean
  snapGuides: SnapGuide[]
  distribution: DistributionGuide[]
  pencilTexture: HTMLImageElement | null
  borderTexture: HTMLImageElement | null
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
  interactionMode,
  labelEditMode,
  snapGuides,
  distribution,
  pencilTexture,
  borderTexture,
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
}: CanvasProps) {
  const scale = displayWidth / canvasLayout.canvasWidth

  // The crosshair cursor is set on mouseenter while in add mode. If the mode
  // switches to "select" while the pointer is still over the image, the add-mode
  // onMouseLeave handler is unmounted before it can fire, leaving the cursor
  // stuck. Reset it explicitly whenever the mode is not "add".
  useEffect(() => {
    if (interactionMode !== "add") {
      const c = stageRef.current?.container()
      if (c) c.style.cursor = "default"
    }
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
          x={0}
          y={canvasLayout.imageOffsetY}
          width={canvasLayout.canvasWidth}
          height={imageHeight}
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
        imageOffsetY={canvasLayout.imageOffsetY}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        style={style}
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
        onRequestRemove={onRequestRemove}
        onSelectPoint={onSelectPoint}
      />
      {/* Guides above swatches (CAD convention); empty array renders nothing. */}
      <SnapGuideLayer
        guides={snapGuides}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        scale={scale}
      />
      {/* Equal-interval gap badges (Story 5.3); null renders nothing. The
          alignment line (SnapGuideLayer) and the badges are complementary:
          line = "aligned axis", badges = "equal gaps". */}
      <DistributionGuideLayer distribution={distribution} scale={scale} />
      {!labelEditMode && (
        <LabelLayer
          points={points}
          style={style}
          canvasWidth={canvasLayout.canvasWidth}
          canvasHeight={canvasLayout.canvasHeight}
        />
      )}
    </Stage>
    {labelEditMode && (
      <LabelEditOverlay
        points={points}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        scale={scale}
        onUpdateLabelText={onUpdateLabelText}
        onUpdateLabelPos={onUpdateLabelPos}
      />
    )}
    </div>
  )
}
