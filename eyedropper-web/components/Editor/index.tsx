"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import type Konva from "konva"
import { canvasTo916 } from "@/lib/canvas-to-916"
import type { CanvasLayout } from "@/lib/canvas-to-916"
import type { EyedropperPoint } from "@/lib/types"
import { sampleColor } from "@/lib/color-sample"
import { assignSwatchLayout, resolveSwatchOverlap, computeSwatchSnap } from "@/lib/swatch-layout"
import type { SnapGuide, DistributionGuide } from "@/lib/swatch-layout"
import { clampToImage } from "@/lib/drag-utils"
import { applyFieldToAll } from "@/lib/apply-to-all"
import { triggerDownload } from "@/lib/download"
import { loadStyles } from "@/lib/styles"
import type { Style } from "@/lib/styles"
import { getSwatchPos } from "./EyedropperLayer"
import { getLabelPosition } from "@/lib/label-layout"
import Canvas from "./Canvas"
import ContextMenu from "./ContextMenu"
import PointPanel from "./PointPanel"
import LabelPanel from "./LabelPanel"
import StylePicker from "@/components/StylePicker"
import ExportButton from "@/components/ExportButton"

function detectBorderColor(img: HTMLImageElement): string {
  const offscreen = document.createElement("canvas")
  offscreen.width = img.naturalWidth
  offscreen.height = img.naturalHeight
  const ctx = offscreen.getContext("2d")!
  ctx.drawImage(img, 0, 0)

  const w = img.naturalWidth
  const h = img.naturalHeight
  const stride = Math.max(1, Math.floor(Math.min(w, h) / 20))
  const samples: [number, number, number][] = []

  for (let x = 0; x < w; x += stride) {
    const top = ctx.getImageData(x, 0, 1, 1).data
    const bot = ctx.getImageData(x, h - 1, 1, 1).data
    samples.push([top[0], top[1], top[2]], [bot[0], bot[1], bot[2]])
  }
  for (let y = 0; y < h; y += stride) {
    const left = ctx.getImageData(0, y, 1, 1).data
    const right = ctx.getImageData(w - 1, y, 1, 1).data
    samples.push([left[0], left[1], left[2]], [right[0], right[1], right[2]])
  }

  const [r, g, b] = samples
    .reduce(([ar, ag, ab], [sr, sg, sb]) => [ar + sr, ag + sg, ab + sb], [0, 0, 0])
    .map((v) => Math.round(v / samples.length))

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

interface EditorShellProps {
  imageId: string
  claudeAvailable?: boolean
}

let pointIdCounter = 0

// Snap pull distance in on-screen pixels; converted to canvas space per-frame
// using the live scale so it feels constant regardless of image resolution.
const SNAP_SCREEN_PX = 8

// Convert a canvas-space click into an in-band image-space point, or null if the
// click landed in the 9:16 letterbox padding (outside the drawn image). Exported
// for unit testing the AC2 band-guard without standing up the whole EditorShell.
export function canvasClickToImagePoint(
  canvasX: number,
  canvasY: number,
  layout: CanvasLayout,
  imageHeight: number
): { x: number; y: number } | null {
  const imageX = canvasX
  const imageY = canvasY - layout.imageOffsetY
  if (imageX < 0 || imageX > layout.canvasWidth || imageY < 0 || imageY > imageHeight) {
    return null
  }
  return clampToImage(imageX, imageY, layout.canvasWidth, imageHeight)
}

export function apiPointsToEyedroppers(
  raw: { x: number; y: number; color: string }[]
): EyedropperPoint[] {
  return raw.map((p) => ({
    id: `point-${pointIdCounter++}`,
    x: p.x,
    y: p.y,
    color: p.color,
    swatchSide: "auto",
    swatchOrder: null,
    swatchX: null,
    swatchY: null,
    label: {
      text: "",
      visible: true,
      x: p.x,
      y: p.y,
      fontSize: 16,
      fontFamily: "Cormorant Garamond Italic",
      color: "#1a1a1a",
    },
  }))
}

export function claudePointsToEyedroppers(
  raw: { x: number; y: number; description: string }[]
): EyedropperPoint[] {
  return raw.map((p) => ({
    id: `point-${pointIdCounter++}`,
    x: p.x,
    y: p.y,
    color: "#888888",
    swatchSide: "auto",
    swatchOrder: null,
    swatchX: null,
    swatchY: null,
    label: {
      text: p.description,
      visible: true,
      x: p.x,
      y: p.y,
      fontSize: 16,
      fontFamily: "Cormorant Garamond Italic",
      color: "#1a1a1a",
    },
  }))
}

// Seed label.x/y to the beside-swatch anchor (the same rule handleToggleLabelEdit
// uses) for points that JUST became laid out (swatchOrder null → assigned in this
// layout pass). Until a point has a swatchOrder neither label render path draws
// it, so this guarantees a label is never shown at its raw image-space seed coords
// (apiPointsToEyedroppers seeds label.x/y = image x/y as a placeholder). Points
// that were already laid out are left untouched, so a label the artist dragged
// survives later re-layouts (marker drag, side change, remove). Exported for unit
// testing.
export function seedNewLabels(
  before: EyedropperPoint[],
  after: EyedropperPoint[],
  style: Style,
  canvasWidth: number,
  canvasHeight: number
): EyedropperPoint[] {
  const alreadyLaidOut = new Set(
    before.filter((p) => p.swatchOrder !== null).map((p) => p.id)
  )
  return after.map((p) => {
    if (p.swatchOrder === null || alreadyLaidOut.has(p.id)) return p
    const swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)
    const anchor = getLabelPosition(
      swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius, canvasWidth, canvasHeight
    )
    return { ...p, label: { ...p.label, x: anchor.x, y: anchor.y } }
  })
}

export default function EditorShell({ imageId, claudeAvailable }: EditorShellProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null)
  const [imageHeight, setImageHeight] = useState<number>(0)
  const [bgColor, setBgColor] = useState<string>("#fafaf9")
  const [loadError, setLoadError] = useState(false)
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)
  const [points, setPoints] = useState<EyedropperPoint[]>([])
  const [isSuggestingLoading, setIsSuggestingLoading] = useState(false)
  const [loadingMethod, setLoadingMethod] = useState<"slic" | "claude" | null>(null)
  const [suggestError, setSuggestError] = useState(false)
  const hiddenCanvasCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  // Owned here so handleExport can capture the stage; Canvas attaches it to <Stage>.
  const stageRef = useRef<Konva.Stage | null>(null)
  // Mirror canvasLayout in a ref so runSuggest can read the latest layout
  // without depending on it (which would re-fire the auto-suggest effect).
  const canvasLayoutRef = useRef<CanvasLayout | null>(null)
  const imageHeightRef = useRef<number>(0)
  const styles = useMemo(() => loadStyles(), [])
  const [style, setStyle] = useState<Style>(() => styles[0])
  const styleRef = useRef<Style>(style)
  // Keep styleRef synced with the live style — the swatch drag handlers read
  // styleRef.current.swatchRadius (handleSwatchDragMove/End) and must see the
  // current radius after a style switch (minimal=40 vs 48 for the others).
  useEffect(() => {
    styleRef.current = style
  }, [style])
  const pointsRef = useRef<EyedropperPoint[]>([])
  // On-screen scale (display px per canvas px), mirrored in a ref so the swatch
  // drag handlers can read it without depending on displaySize (keeps their deps
  // empty). Synced by the effect below alongside displaySize/canvasLayout.
  const scaleRef = useRef<number>(1)
  // Ephemeral alignment guide lines shown only while a free swatch is dragged;
  // cleared on every dragEnd (Story 5.2). Never persisted.
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [distribution, setDistribution] = useState<DistributionGuide[]>([])
  // Pastel-swatch textures (Story 3.5), loaded once and shared across every
  // swatch. Hydration-safe (browser Image in an effect, init null, cleanup nulls
  // handlers) per docs/project-context.md. Only the pastel style uses them; the
  // two PNGs are tiny (~24KB) so loading unconditionally is fine, and the layer
  // falls back to the flat Circle until they decode.
  const [pencilTexture, setPencilTexture] = useState<HTMLImageElement | null>(null)
  const [borderTexture, setBorderTexture] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const pencil = new window.Image()
    pencil.onload = () => setPencilTexture(pencil)
    pencil.src = "/textures/swatch-pencil.png"
    const border = new window.Image()
    border.onload = () => setBorderTexture(border)
    border.src = "/textures/swatch-border.png"
    return () => {
      pencil.onload = null
      border.onload = null
    }
  }, [])

  const [interactionMode, setInteractionMode] = useState<"select" | "add">("select")
  const [contextMenu, setContextMenu] = useState<{ pointId: string; x: number; y: number } | null>(null)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [labelEditMode, setLabelEditMode] = useState(false)
  // Mirror labelEditMode in a ref so handleToggleLabelEdit can read the live
  // value without depending on it (keeping the callback's deps empty), and
  // without nesting setPoints inside a setLabelEditMode updater.
  const labelEditModeRef = useRef(labelEditMode)
  useEffect(() => {
    labelEditModeRef.current = labelEditMode
  }, [labelEditMode])

  useEffect(() => {
    pointsRef.current = points
  }, [points])

  // Keep scaleRef synced with the live on-screen scale (= displaySize.width /
  // canvasWidth, the same value Canvas computes). The swatch snap threshold is
  // derived from this so it feels constant on screen regardless of image res.
  useEffect(() => {
    if (displaySize && canvasLayout) {
      scaleRef.current = displaySize.width / canvasLayout.canvasWidth
    }
  }, [displaySize, canvasLayout])

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024)
  }, [])

  // Story 3.5 (AC8): Konva rasterizes label Text at render time and does NOT
  // auto-reflow when a `display: "swap"` webfont (e.g. Caveat) swaps in after the
  // first paint (FOUT). Force a one-shot stage redraw once all fonts are ready so
  // canvas labels repaint in the correct font. Cheap, idempotent, fires once.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (cancelled) return
      stageRef.current?.getLayers().forEach((l) => l.batchDraw())
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const compute = () => {
      const w = Math.max(1, Math.min(window.innerWidth - 480, window.innerHeight * (9 / 16)))
      setDisplaySize({ width: Math.round(w), height: Math.round(w * 16 / 9) })
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [])

  // Load the uploaded image once here; the decoded element is passed down to
  // <Canvas> so it is never fetched or decoded twice.
  useEffect(() => {
    const image = new window.Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      const layout = canvasTo916(image.naturalWidth, image.naturalHeight)
      canvasLayoutRef.current = layout
      setCanvasLayout(layout)
      imageHeightRef.current = image.naturalHeight
      setImageHeight(image.naturalHeight)
      setBgColor(detectBorderColor(image))
      // Populate hidden canvas for pixel sampling — never shown to user
      const offscreen = document.createElement("canvas")
      offscreen.width = image.naturalWidth
      offscreen.height = image.naturalHeight
      const ctx2d = offscreen.getContext("2d")!
      ctx2d.drawImage(image, 0, 0)
      hiddenCanvasCtxRef.current = ctx2d
      setImg(image)
    }
    image.onerror = () => setLoadError(true)
    image.src = `/api/image?id=${imageId}`
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [imageId])

  const runSuggest = useCallback(async (method: "slic" | "claude") => {
    setIsSuggestingLoading(true)
    setLoadingMethod(method)
    setSuggestError(false)
    // Re-suggest replaces all points with new ids; clear the now-dangling
    // selection so selectedPointId never references a dead point.
    setSelectedPointId(null)
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imageId, method }),
      })
      const data = res.ok ? await res.json() : null
      if (data && Array.isArray(data.points)) {
        let newPoints: EyedropperPoint[] =
          method === "slic"
            ? apiPointsToEyedroppers(data.points)
            : claudePointsToEyedroppers(data.points)

        if (hiddenCanvasCtxRef.current) {
          newPoints = newPoints.map((p) => ({
            ...p,
            color: sampleColor(hiddenCanvasCtxRef.current!, p.x, p.y),
          }))
        }

        const layout = canvasLayoutRef.current
        if (layout) {
          const laidOut = assignSwatchLayout(
            newPoints,
            layout.canvasWidth,
            layout.canvasHeight,
            layout.imageOffsetY
          )
          newPoints = seedNewLabels(
            newPoints, laidOut, styleRef.current, layout.canvasWidth, layout.canvasHeight
          )
        }

        setPoints(newPoints)
      } else {
        setSuggestError(true)
      }
    } catch {
      setSuggestError(true)
    } finally {
      setIsSuggestingLoading(false)
      setLoadingMethod(null)
    }
  }, [imageId])

  const handleMarkerDragMove = useCallback(
    (id: string, canvasX: number, canvasY: number) => {
      const layout = canvasLayoutRef.current
      if (!hiddenCanvasCtxRef.current || !layout) return
      const { x: clampedX, y: clampedY } = clampToImage(
        canvasX, canvasY - layout.imageOffsetY, layout.canvasWidth, imageHeightRef.current
      )
      const newColor = sampleColor(hiddenCanvasCtxRef.current, clampedX, clampedY)
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, x: clampedX, y: clampedY, color: newColor } : p))
      )
    },
    []
  )

  const handleMarkerDragEnd = useCallback(
    (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
      const layout = canvasLayoutRef.current
      if (!layout) return { x: canvasX, y: canvasY }
      const imageX = canvasX
      const imageY = canvasY - layout.imageOffsetY
      const { x: clampedX, y: clampedY } = clampToImage(
        imageX, imageY, layout.canvasWidth, imageHeightRef.current
      )
      const newColor = hiddenCanvasCtxRef.current
        ? sampleColor(hiddenCanvasCtxRef.current, clampedX, clampedY)
        : null

      setPoints((prev) => {
        const updated = prev.map((p) =>
          p.id === id
            ? { ...p, x: clampedX, y: clampedY, ...(newColor ? { color: newColor } : {}) }
            : p
        )
        return assignSwatchLayout(
          updated,
          layout.canvasWidth,
          layout.canvasHeight,
          layout.imageOffsetY
        )
      })

      // Return the clamped position in canvas space so the Konva node snaps to
      // the final location, not the stale pre-drag coords.
      return { x: clampedX, y: clampedY + layout.imageOffsetY }
    },
    []
  )

  // Set the swatch's absolute (swatchX, swatchY) live during the drag. The first
  // move detaches the swatch from the edge layout; the coords arrive already
  // clamped to the canvas by the swatch's dragBoundFunc. Story 5.2: apply
  // CAD-style soft snapping to the clamped coords, surface alignment guides, and
  // return the snapped position so the Konva node moves there live.
  const handleSwatchDragMove = useCallback(
    (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
      const layout = canvasLayoutRef.current
      if (!layout) {
        setPoints((prev) =>
          prev.map((p) => (p.id === id ? { ...p, swatchX: canvasX, swatchY: canvasY } : p))
        )
        return { x: canvasX, y: canvasY }
      }
      const r = styleRef.current.swatchRadius
      const current = pointsRef.current
      const dragged = current.find((p) => p.id === id)
      const marker = dragged
        ? { x: dragged.x, y: dragged.y + layout.imageOffsetY }
        : { x: canvasX, y: canvasY }
      // Rendered centers of every OTHER swatch (edge or free), as snap targets.
      // Free-floating requires BOTH coords set (matches getSwatchPos's free branch).
      const others = current
        .filter((pt) => pt.id !== id && (pt.swatchOrder !== null || (pt.swatchX !== null && pt.swatchY !== null)))
        .map((pt) => getSwatchPos(pt, layout.canvasWidth, layout.canvasHeight, r))

      const snapped = computeSwatchSnap({
        others,
        marker,
        x: canvasX,
        y: canvasY,
        swatchRadius: r,
        canvasWidth: layout.canvasWidth,
        canvasHeight: layout.canvasHeight,
        threshold: SNAP_SCREEN_PX / (scaleRef.current || 1),
      })

      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, swatchX: snapped.x, swatchY: snapped.y } : p))
      )
      setSnapGuides(snapped.guides)
      setDistribution(snapped.distribution)
      return { x: snapped.x, y: snapped.y }
    },
    []
  )

  // On drop, block overlap (AC4): settle the dragged swatch at the nearest spot
  // that doesn't overlap any other swatch, never moving a neighbour. Returns the
  // resolved canvas position so the Konva node snaps to it.
  const handleSwatchDragEnd = useCallback(
    (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
      const layout = canvasLayoutRef.current
      if (!layout) return { x: canvasX, y: canvasY }
      const r = styleRef.current.swatchRadius

      const current = pointsRef.current
      // Rendered centers of every OTHER swatch (edge or free), for overlap-blocking.
      // Free-floating requires BOTH coords set (matches getSwatchPos's free branch).
      const others = current
        .filter((pt) => pt.id !== id && (pt.swatchOrder !== null || (pt.swatchX !== null && pt.swatchY !== null)))
        .map((pt) => getSwatchPos(pt, layout.canvasWidth, layout.canvasHeight, r))

      const resolved = resolveSwatchOverlap(
        others, canvasX, canvasY, r, layout.canvasWidth, layout.canvasHeight
      )

      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, swatchX: resolved.x, swatchY: resolved.y } : p))
      )
      // Story 5.2/5.3: guides and the distribution cues are ephemeral — clear them
      // when the drag ends.
      setSnapGuides([])
      setDistribution([])
      return resolved
    },
    []
  )

  const handleAddPoint = useCallback((canvasX: number, canvasY: number) => {
    const layout = canvasLayoutRef.current
    const ctx = hiddenCanvasCtxRef.current
    if (!layout || !ctx) return

    // Canvas → image space; ignore clicks in the 9:16 letterbox padding.
    const point = canvasClickToImagePoint(canvasX, canvasY, layout, imageHeightRef.current)
    if (!point) return

    const { x, y } = point
    const color = sampleColor(ctx, x, y)
    const [newPoint] = apiPointsToEyedroppers([{ x, y, color }])

    setPoints((prev) => {
      const withNew = [...prev, newPoint]
      const laidOut = assignSwatchLayout(
        withNew,
        layout.canvasWidth,
        layout.canvasHeight,
        layout.imageOffsetY
      )
      return seedNewLabels(
        withNew, laidOut, styleRef.current, layout.canvasWidth, layout.canvasHeight
      )
    })
  }, [])

  const handleRequestRemove = useCallback((id: string, clientX: number, clientY: number) => {
    setContextMenu({ pointId: id, x: clientX, y: clientY })
  }, [])

  const handleRemovePoint = useCallback((id: string) => {
    const layout = canvasLayoutRef.current
    setPoints((prev) => {
      const remaining = prev.filter((p) => p.id !== id)
      if (!layout) return remaining
      return assignSwatchLayout(
        remaining,
        layout.canvasWidth,
        layout.canvasHeight,
        layout.imageOffsetY
      )
    })
    setSelectedPointId((cur) => (cur === id ? null : cur))
    setContextMenu(null)
  }, [])

  const handleSelectPoint = useCallback((id: string) => {
    setSelectedPointId(id)
  }, [])

  const handleToggleLabelEdit = useCallback(() => {
    if (labelEditModeRef.current) {
      setLabelEditMode(false)
      return
    }
    // OFF → ON: re-init each label's (x, y) to the "next to the swatch"
    // position derived from its swatch + the live style's labelPosition.
    // Read the live layout/style from refs (this runs outside render).
    const layout = canvasLayoutRef.current
    const style = styleRef.current
    if (layout) {
      setPoints((prev) =>
        prev.map((p) => {
          if (p.swatchOrder === null) return p
          const swatchPos = getSwatchPos(
            p, layout.canvasWidth, layout.canvasHeight, style.swatchRadius
          )
          const labelPos = getLabelPosition(
            swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
            layout.canvasWidth, layout.canvasHeight
          )
          return { ...p, label: { ...p.label, x: labelPos.x, y: labelPos.y } }
        })
      )
    }
    setLabelEditMode(true)
  }, [])

  const handleUpdateLabel = useCallback(
    (id: string, patch: Partial<EyedropperPoint["label"]>) => {
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, label: { ...p.label, ...patch } } : p))
      )
    },
    []
  )

  const handleUpdateLabelPos = useCallback(
    (id: string, x: number, y: number) => handleUpdateLabel(id, { x, y }),
    [handleUpdateLabel]
  )

  // Broadcast the selected point's font/size/color to every point (Story 3.4).
  // Reads the selected value from `prev` inside the updater (live array, not the
  // selectedPoint render closure), depending only on selectedPointId so identity
  // is stable. Pure label styling — no swatch-layout re-run (it keys on marker
  // coords + swatchSide only). See lib/apply-to-all.ts.
  const handleApplyToAll = useCallback(
    (field: "fontFamily" | "fontSize" | "color") => {
      setPoints((prev) => applyFieldToAll(prev, selectedPointId, field))
    },
    [selectedPointId]
  )

  // Capture the Konva stage as a 9:16 JPEG and download it. Reads live layout
  // from canvasLayoutRef (not the render closure) so the callback stays stable.
  const handleExport = useCallback(async () => {
    const stage = stageRef.current
    const layout = canvasLayoutRef.current
    const display = displaySize
    if (!stage || !layout || !display) return

    // pixelRatio is derived, NOT a literal 2: the stage is rendered downscaled
    // (scale = display.width / layout.canvasWidth). To make the exported bitmap
    // exactly 2× the original image width, pixelRatio = (2 * canvasWidth) / displayWidth.
    const pixelRatio = (2 * layout.canvasWidth) / display.width

    // AC7: in label-edit mode the Konva LabelLayer is unmounted and labels live
    // only in the HTML overlay, which toDataURL cannot capture. Leave edit mode
    // so the LabelLayer mounts, then wait two frames (React commit + Konva paint)
    // before capturing so the labels are present in the bitmap.
    if (labelEditModeRef.current) {
      setLabelEditMode(false)
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      )
    }

    // Story 3.5 (AC8): ensure webfonts (e.g. Caveat) have swapped in before
    // capturing, so exported labels never rasterize in the fallback font. Guard
    // for jsdom, where document.fonts may be absent.
    if (typeof document !== "undefined" && document.fonts) {
      await document.fonts.ready
    }

    const dataUrl = stage.toDataURL({ pixelRatio })
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    })
    if (!res.ok) throw new Error("Export failed")
    const blob = await res.blob()
    triggerDownload(blob, "eyedropper-export.jpg")
  }, [displaySize])

  const handleSelectStyle = useCallback((next: Style) => {
    setStyle(next)
  }, [])

  const handleDeselect = useCallback(() => {
    setSelectedPointId(null)
  }, [])

  // Close the context menu on any outside mousedown or Escape.
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null)
    }
    window.addEventListener("mousedown", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [contextMenu])

  useEffect(() => {
    runSuggest("slic")
  }, [runSuggest])

  // Re-apply swatch layout when the canvas layout becomes available (or
  // changes) after points were already fetched without a layout. This avoids
  // re-fetching SLIC just to lay out existing points. Points already laid out
  // for the current layout are returned unchanged by assignSwatchLayout, so
  // this does not loop.
  useEffect(() => {
    if (!canvasLayout) return
    setPoints((prev) => {
      if (prev.length === 0) return prev
      const laidOut = assignSwatchLayout(
        prev,
        canvasLayout.canvasWidth,
        canvasLayout.canvasHeight,
        canvasLayout.imageOffsetY
      )
      return seedNewLabels(
        prev, laidOut, styleRef.current, canvasLayout.canvasWidth, canvasLayout.canvasHeight
      )
    })
  }, [canvasLayout])

  const selectedPoint = selectedPointId ? points.find((p) => p.id === selectedPointId) : undefined
  const selectedNumber = selectedPoint ? points.findIndex((p) => p.id === selectedPoint.id) + 1 : 0

  if (isMobile === null) return null

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <p className="text-[var(--color-text-secondary)] text-center px-8">
          Please open this app on a desktop (1024px+).
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Left sidebar */}
      <aside
        style={{ width: 200 }}
        className="bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex flex-col p-4 gap-6 flex-shrink-0"
      >
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Suggest
          </h3>
          <button
            onClick={() => runSuggest("slic")}
            disabled={isSuggestingLoading}
            className="w-full text-left text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white disabled:opacity-50 disabled:cursor-wait hover:border-[var(--color-accent)] transition-colors"
          >
            {loadingMethod === "slic" ? "Suggesting…" : "SLIC (auto)"}
          </button>
          {claudeAvailable && (
            <button
              onClick={() => runSuggest("claude")}
              disabled={isSuggestingLoading}
              className="w-full text-left text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white disabled:opacity-50 disabled:cursor-wait hover:border-[var(--color-accent)] transition-colors mt-1"
            >
              {loadingMethod === "claude" ? "Suggesting…" : "Claude ✦"}
            </button>
          )}
          {suggestError && (
            <p className="mt-2 text-xs text-red-600">
              Couldn&apos;t suggest points. Try again.
            </p>
          )}
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Tools
          </h3>
          <button
            onClick={() => setInteractionMode("select")}
            className={`w-full text-left text-xs px-2 py-1.5 rounded border transition-colors ${
              interactionMode === "select"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            ↖ Select/drag
          </button>
          <button
            onClick={() => setInteractionMode("add")}
            className={`w-full text-left text-xs px-2 py-1.5 rounded border mt-1 transition-colors ${
              interactionMode === "add"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            ○ Add point
          </button>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Style
          </h3>
          <StylePicker styles={styles} activeStyleName={style.name} onSelect={handleSelectStyle} />
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Labels
          </h3>
          <button
            onClick={handleToggleLabelEdit}
            aria-pressed={labelEditMode}
            className={`w-full text-left text-xs px-2 py-1.5 rounded border transition-colors ${
              labelEditMode
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            Edit labels
          </button>
        </section>
      </aside>

      {/* Center canvas */}
      <main className="flex flex-1 items-center justify-center bg-[var(--color-bg)] overflow-hidden">
        {loadError ? (
          <p className="text-sm text-[var(--color-text-secondary)] text-center px-8">
            Couldn&apos;t load this image. It may have expired.{" "}
            <a href="/" className="underline text-[var(--color-accent)]">
              Upload another
            </a>
          </p>
        ) : img && canvasLayout && displaySize ? (
          <Canvas
            image={img}
            stageRef={stageRef}
            canvasLayout={canvasLayout}
            imageHeight={imageHeight}
            bgColor={bgColor}
            displayWidth={displaySize.width}
            displayHeight={displaySize.height}
            points={points}
            style={style}
            interactionMode={interactionMode}
            pencilTexture={pencilTexture}
            borderTexture={borderTexture}
            labelEditMode={labelEditMode}
            snapGuides={snapGuides}
            distribution={distribution}
            onMarkerDragMove={handleMarkerDragMove}
            onMarkerDragEnd={handleMarkerDragEnd}
            onSwatchDragMove={handleSwatchDragMove}
            onSwatchDragEnd={handleSwatchDragEnd}
            onAddPoint={handleAddPoint}
            onRequestRemove={handleRequestRemove}
            onSelectPoint={handleSelectPoint}
            onDeselect={handleDeselect}
            onUpdateLabelText={(id, text) => handleUpdateLabel(id, { text })}
            onUpdateLabelPos={handleUpdateLabelPos}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
        )}
      </main>

      {/* Right sidebar */}
      <aside
        style={{ width: 280 }}
        className="bg-[var(--color-sidebar)] border-l border-[var(--color-border)] flex flex-col p-4 gap-6 flex-shrink-0"
      >
        {selectedPoint && labelEditMode && (
          <LabelPanel
            label={selectedPoint.label}
            onUpdate={(patch) => handleUpdateLabel(selectedPoint.id, patch)}
            onApplyToAll={handleApplyToAll}
          />
        )}
        {selectedPoint && !labelEditMode && (
          <PointPanel
            pointNumber={selectedNumber}
            color={selectedPoint.color}
            onRemove={() => handleRemovePoint(selectedPoint.id)}
          />
        )}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
            Export
          </h3>
          <ExportButton onExport={handleExport} />
        </section>
      </aside>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRemove={() => handleRemovePoint(contextMenu.pointId)}
        />
      )}
    </div>
  )
}
