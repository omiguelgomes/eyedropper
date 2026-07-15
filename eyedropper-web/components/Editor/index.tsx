"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import type Konva from "konva"
import { computeLayout, clampPan, canvasToImage, imageToCanvas, isPointInFrame } from "@/lib/canvas-layout"
import type { CanvasLayout } from "@/lib/canvas-layout"
import { DEFAULT_RATIO, ratioLabel, type Ratio } from "@/lib/aspect"
import type { EyedropperPoint } from "@/lib/types"
import { sampleColor } from "@/lib/color-sample"
import { assignSwatchLayout, resolveSwatchOverlap, computeSwatchSnap } from "@/lib/swatch-layout"
import type { SnapGuide, DistributionGuide } from "@/lib/swatch-layout"
import { clampToImage } from "@/lib/drag-utils"
import { triggerDownload } from "@/lib/download"
import { loadStyles } from "@/lib/styles"
import type { Style } from "@/lib/styles"
import { scaleStyleForDisplay } from "@/lib/style-scale"
import { getSwatchPos } from "./EyedropperLayer"
import { getLabelPosition } from "@/lib/label-layout"
import { measureLabelWidth } from "@/lib/measure-text"
import { computeLabelSnap, type LabelBox } from "@/lib/label-snap"
import Canvas from "./Canvas"
import ContextMenu from "./ContextMenu"
import PointPanel from "./PointPanel"
import LabelPanel from "./LabelPanel"
import StylePicker from "@/components/StylePicker"
import AspectPicker from "@/components/AspectPicker"
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

// Label presentation fields that a single edit broadcasts to EVERY label;
// all other label fields (text/visibility/position) stay scoped to one point.
const LABEL_BROADCAST_KEYS: readonly string[] = ["fontFamily", "fontSize", "color"]

// Convert a canvas-space click into an image-space point, or null if the click
// landed outside the drawn image (only possible when the frame is not fully
// covered, e.g. a degenerate layout). Under cover-crop the image usually fills
// the whole frame, so in-frame clicks map into the image. Exported for unit
// testing the band-guard without standing up the whole EditorShell.
export function canvasClickToImagePoint(
  canvasX: number,
  canvasY: number,
  layout: CanvasLayout,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } | null {
  const { x: imageX, y: imageY } = canvasToImage(canvasX, canvasY, layout)
  if (imageX < 0 || imageX > imageWidth || imageY < 0 || imageY > imageHeight) {
    return null
  }
  return clampToImage(imageX, imageY, imageWidth, imageHeight)
}

// Base label font size at 1× scale. New points seed at BASE_FONT_SIZE ×
// currentScale so a point added while the size slider is at 2× matches the
// existing points, which were themselves scaled up.
const BASE_FONT_SIZE = 35

export function apiPointsToEyedroppers(
  raw: { x: number; y: number; color: string }[],
  fontSize: number = BASE_FONT_SIZE
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
    connectorMid: null,
    label: {
      text: "",
      visible: true,
      x: p.x,
      y: p.y,
      fontSize,
      fontFamily: "Cormorant Garamond Italic",
      color: "#1a1a1a",
    },
  }))
}

export function claudePointsToEyedroppers(
  raw: { x: number; y: number; description: string }[],
  fontSize: number = BASE_FONT_SIZE
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
    connectorMid: null,
    label: {
      text: p.description,
      visible: true,
      x: p.x,
      y: p.y,
      fontSize,
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
    const w = measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily)
    const anchor = getLabelPosition(
      swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
      canvasWidth, canvasHeight, w, p.label.fontSize
    )
    return { ...p, label: { ...p.label, x: anchor.x, y: anchor.y } }
  })
}

// Pin each edge-laid-out swatch (and its label) to the CURRENTLY-VISIBLE frame
// edge when suggesting under an active pan. The annotation scene is rendered
// translated by `+pan`, and edge swatches are placed at pan-free edges, so a
// re-suggest while panned would render them shoved off-screen by the pan (the
// "suggested swatches fly outside the frame" bug). Detaching each edge swatch to
// its free position edgePos − pan makes the +pan render land it exactly on the
// visible edge — identical to a pan-0 suggest — and, being free-floating, it then
// travels with the image on further pans (the chosen "glued to image" behavior).
// The label is carried by the same −pan delta so it stays beside its swatch.
// No-op at pan (0,0) — the common unpanned suggest path is untouched. Only edge
// swatches (swatchOrder set, not already free) are anchored. Exported for unit tests.
export function anchorSwatchesToVisibleFrame(
  points: EyedropperPoint[],
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number,
  pan: { x: number; y: number }
): EyedropperPoint[] {
  if (pan.x === 0 && pan.y === 0) return points
  return points.map((p) => {
    if (p.swatchOrder === null || p.swatchX !== null || p.swatchY !== null) return p
    const edge = getSwatchPos(p, canvasWidth, canvasHeight, swatchRadius)
    return {
      ...p,
      swatchX: edge.x - pan.x,
      swatchY: edge.y - pan.y,
      label: { ...p.label, x: p.label.x - pan.x, y: p.label.y - pan.y },
    }
  })
}

// Apply a global size-scale change to every point: scale each label's fontSize
// by next/prev, and move every laid-out label PROPORTIONALLY with its swatch. As
// the radius grows the swatch's rendered center and outer edge shift; we keep the
// label's offset from the swatch center and scale it by the same ratio, so the
// label tracks the swatch in lockstep rather than snapping to a canonical anchor.
// This matters most at the first slider tick (ratio ≈ 1): the label barely moves
// instead of jumping. Points not yet laid out (swatchOrder null) keep their label
// position — only their fontSize scales. `baseStyle` is the unscaled style; the
// swatch center is computed at both the old and new radius. Exported for unit testing.
export function rescalePointsForSize(
  points: EyedropperPoint[],
  baseStyle: Style,
  prev: number,
  next: number,
  canvasWidth: number,
  canvasHeight: number
): EyedropperPoint[] {
  const ratio = next / prev
  const oldRadius = baseStyle.swatchRadius * prev
  const newRadius = baseStyle.swatchRadius * next
  return points.map((p) => {
    const label = { ...p.label, fontSize: p.label.fontSize * ratio }
    if (p.swatchOrder === null) return { ...p, label }
    const oldSwatch = getSwatchPos(p, canvasWidth, canvasHeight, oldRadius)
    const newSwatch = getSwatchPos(p, canvasWidth, canvasHeight, newRadius)
    const offsetX = (p.label.x - oldSwatch.x) * ratio
    const offsetY = (p.label.y - oldSwatch.y) * ratio
    const w = measureLabelWidth(label.text, label.fontSize, label.fontFamily)
    const x = Math.max(0, Math.min(canvasWidth - w, newSwatch.x + offsetX))
    const y = Math.max(0, Math.min(canvasHeight - label.fontSize, newSwatch.y + offsetY))
    return { ...p, label: { ...label, x, y } }
  })
}

export default function EditorShell({ imageId, claudeAvailable }: EditorShellProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [imageWidth, setImageWidth] = useState<number>(0)
  const [imageHeight, setImageHeight] = useState<number>(0)
  // Live aspect ratio and pan (crop offset in canvas space). Changing the ratio
  // resets the pan; the pan tool nudges pan within the covered area. canvasLayout
  // is derived from these plus the image dimensions.
  const [ratio, setRatio] = useState<Ratio>(DEFAULT_RATIO)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  // Extra magnification (1×–4×) applied on top of the cover-crop so the artist can
  // frame a tighter crop before working. Feeds computeLayout/clampPan; markers
  // follow the zoom (they're drawn via imageScale), swatches/labels/chrome don't.
  // Part of the exported image (it changes what the frame shows).
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  // The layout is PAN-FREE (centered cover-crop): pan is applied separately as a
  // uniform view translation over the whole annotation scene (image + markers +
  // connectors + swatches + labels), so the entire trio moves RIGIDLY together
  // during a pan — nothing stretches. Keeping pan out of the layout means every
  // stored coord and all the swatch/snap/label math stays in one pan-free canvas
  // space; only render-time offsets and the two absolute-space clamps see pan.
  // PAN-FREE layout (see below): pass zoom but leave pan at its default zero, so
  // zoom changes the cover scale / crop while pan stays a separate view translate.
  const canvasLayout = useMemo<CanvasLayout | null>(
    () =>
      imageWidth > 0 && imageHeight > 0
        ? computeLayout(imageWidth, imageHeight, ratio, { x: 0, y: 0 }, zoom)
        : null,
    [imageWidth, imageHeight, ratio, zoom]
  )
  // Pan clamped to the covered area for the current ratio (canvas units). Applied
  // as a Konva/DOM translate downstream. Recomputed when pan or ratio changes.
  const panOffset = useMemo(
    () =>
      imageWidth > 0 && imageHeight > 0
        ? clampPan(imageWidth, imageHeight, ratio, pan, zoom)
        : { x: 0, y: 0 },
    [imageWidth, imageHeight, ratio, pan, zoom]
  )
  // Mirror ratio/pan in refs so the pan-tool drag handlers (deps []) can read the
  // live values and clamp against the current ratio without re-creating.
  const ratioRef = useRef(ratio)
  const panRef = useRef(pan)
  useEffect(() => {
    ratioRef.current = ratio
  }, [ratio])
  useEffect(() => {
    panRef.current = pan
  }, [pan])
  // Clamped pan (canvas units) mirrored for the stable handlers (deps []): the
  // add-point click maps a stage-relative pointer back to pan-free canvas space by
  // subtracting this, and the swatch/handle dragBoundFuncs offset their absolute-
  // space clamp by it (both convert screen ↔ pan-free canvas coords).
  const panOffsetRef = useRef(panOffset)
  useEffect(() => {
    panOffsetRef.current = panOffset
  }, [panOffset])
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
  const imageWidthRef = useRef<number>(0)
  const imageHeightRef = useRef<number>(0)
  const styles = useMemo(() => loadStyles(), [])
  const [style, setStyle] = useState<Style>(() => styles[0])
  // On-screen scale (display px per canvas px). Chrome sizes (swatch, connector,
  // marker, label font) are authored as ON-SCREEN pixel references and divided by
  // this so they render at a CONSTANT on-screen size regardless of aspect ratio,
  // crop, or image resolution — a wider/cropped ratio (or a bigger window) fits
  // the canvas to a larger display box, growing stageScale, which would otherwise
  // magnify every canvas-unit-sized element. Falls back to 1 until displaySize is
  // known. canvasWidth === imageWidth for every ratio, so this varies only with
  // the viewport fit, never the ratio's canvas dimensions.
  const stageScale =
    displaySize && canvasLayout && canvasLayout.canvasWidth > 0
      ? displaySize.width / canvasLayout.canvasWidth
      : 1
  // Mirror the UNSCALED base style so handleSizeScaleChange (deps []) can derive
  // the swatch radius at the new scale when re-anchoring labels.
  const baseStyleRef = useRef<Style>(style)
  useEffect(() => {
    baseStyleRef.current = style
  }, [style])
  // Global size multiplier (1×–2.5×). Scales the swatch, connector, marker, and
  // (via handleSizeScaleChange) the label font size in lockstep. Stored on the
  // base style only implicitly — the scaled dimensions live in `scaledStyle`.
  const [sizeScale, setSizeScale] = useState(1)
  const sizeScaleRef = useRef(sizeScale)
  useEffect(() => {
    sizeScaleRef.current = sizeScale
  }, [sizeScale])
  // Color-sampling precision: the EDGE length (in IMAGE natural pixels) of the
  // square box sampleColor averages when picking a point's color. 8 = the original
  // 8×8 box; 1 reads a true single pixel; higher values average a larger patch,
  // smoothing over local texture/noise. Mirrored in a ref so the stable drag/add
  // handlers (deps []) read the live value without re-creating. A change re-samples
  // every existing point's color via the effect below.
  const [sampleSize, setSampleSize] = useState(8)
  const sampleSizeRef = useRef(sampleSize)
  useEffect(() => {
    sampleSizeRef.current = sampleSize
  }, [sampleSize])
  // Re-sample every existing point's color when precision changes — a larger box
  // averages a different area, so the picked colors should visibly shift with the
  // slider. Guarded on the hidden sampling ctx; points store x,y in image space,
  // so this reads straight from the original pixels (never mutated).
  useEffect(() => {
    const ctx = hiddenCanvasCtxRef.current
    if (!ctx) return
    setPoints((prev) =>
      prev.map((p) => ({ ...p, color: sampleColor(ctx, p.x, p.y, sampleSize) }))
    )
  }, [sampleSize])
  // True while the Precision slider is focused/being dragged; gates the on-canvas
  // dashed cue so it only appears while the artist is adjusting precision and
  // never bleeds into the export.
  const [precisionActive, setPrecisionActive] = useState(false)
  // The effective multiplier for all annotation CHROME (swatch, connector, marker,
  // label font). The style's dimensions are authored as on-screen pixel references
  // at 1×; dividing by stageScale cancels the viewport-fit magnification so chrome
  // renders at a CONSTANT on-screen size regardless of aspect ratio, crop, image
  // resolution, or window size (the "everything looks huge when cropped" fix). The
  // user-facing size slider (sizeScale, 1–2.5×) then multiplies that constant. A
  // change to annotationScale — from the slider OR a stageScale change (ratio /
  // resize) — is treated uniformly by the label rescale effect below.
  const annotationScale = sizeScale / stageScale
  const annotationScaleRef = useRef(annotationScale)
  useEffect(() => {
    annotationScaleRef.current = annotationScale
  }, [annotationScale])
  // The style actually rendered: base style with its chrome dimensions scaled for
  // display (constant on-screen size — see scaleStyleForDisplay). Texture paths,
  // colors, and layout mode carry through unchanged. Everything downstream
  // (layers, drag handlers, layout) uses this — the raw `style` is only for
  // StylePicker's active-name highlight.
  const scaledStyle = useMemo<Style>(
    () => scaleStyleForDisplay(style, sizeScale, stageScale),
    [style, sizeScale, stageScale]
  )
  const styleRef = useRef<Style>(scaledStyle)
  // Keep styleRef synced with the live SCALED style — the swatch drag handlers
  // read styleRef.current.swatchRadius (handleSwatchDragMove/End) and must see
  // the current scaled radius after a style switch or a size-slider change.
  useEffect(() => {
    styleRef.current = scaledStyle
  }, [scaledStyle])
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
  // handlers) per docs/project-context.md. Only the pastel styles use them; the
  // PNGs are tiny so loading unconditionally is fine, and the layer falls back to
  // the flat Circle until they decode. Both ring variants are keyed by their
  // public path so the active style's `borderTexture` resolves to the right one;
  // the ring-less "pastel" style has no borderTexture and renders pencil only.
  const [pencilTexture, setPencilTexture] = useState<HTMLImageElement | null>(null)
  const [borderTextures, setBorderTextures] = useState<Record<string, HTMLImageElement>>({})
  useEffect(() => {
    const pencil = new window.Image()
    pencil.onload = () => setPencilTexture(pencil)
    pencil.src = "/textures/swatch-pencil.png"
    const borderPaths = ["/textures/swatch-border.png", "/textures/swatch-border-thin.png"]
    const borders = borderPaths.map((src) => {
      const im = new window.Image()
      im.onload = () => setBorderTextures((prev) => ({ ...prev, [src]: im }))
      im.src = src
      return im
    })
    return () => {
      pencil.onload = null
      borders.forEach((im) => (im.onload = null))
    }
  }, [])
  // The decoded ring for the ACTIVE style (null for the ring-less "pastel").
  const borderTexture = style.borderTexture ? borderTextures[style.borderTexture] ?? null : null

  const [interactionMode, setInteractionMode] = useState<"select" | "add" | "pan">("select")
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

  // Keep canvasLayoutRef synced with the derived layout so the stable drag
  // handlers (deps []) always read the current transform (ratio/pan aware).
  useEffect(() => {
    canvasLayoutRef.current = canvasLayout
  }, [canvasLayout])

  // Keep scaleRef synced with the live on-screen scale (= displaySize.width /
  // canvasWidth, the same value Canvas computes). The swatch snap threshold is
  // derived from this so it feels constant on screen regardless of image res.
  useEffect(() => {
    if (displaySize && canvasLayout) {
      scaleRef.current = displaySize.width / canvasLayout.canvasWidth
    }
  }, [displaySize, canvasLayout])

  // Keep label on-screen font size CONSTANT across stageScale changes (aspect
  // ratio switch or window resize). fontSize is stored in canvas units, so
  // on-screen font = fontSize × stageScale; when stageScale changes we rescale
  // fontSize by the inverse so the rendered size is unchanged — the label-font
  // counterpart to scaledStyle normalizing swatch/marker/connector. Font-only, no
  // reposition: existing labels already keep their canvas position on a ratio
  // change (only NEW labels are seeded by the frame effect), so this preserves
  // that. lastStageScaleRef holds the value the current fontSizes are relative to.
  const lastStageScaleRef = useRef<number | null>(null)
  useEffect(() => {
    if (!(stageScale > 0)) return
    const prevSS = lastStageScaleRef.current
    lastStageScaleRef.current = stageScale
    if (prevSS === null || prevSS === stageScale) return
    const ratio = prevSS / stageScale
    setPoints((pts) =>
      pts.length === 0
        ? pts
        : pts.map((p) => ({ ...p, label: { ...p.label, fontSize: p.label.fontSize * ratio } }))
    )
  }, [stageScale])

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

  // Fit the on-screen canvas within the viewport for the CURRENT ratio: cap the
  // width by both the available horizontal space (minus the two sidebars) and by
  // what keeps the full height on screen (innerHeight × ratioW/ratioH). Recomputed
  // on resize and whenever the ratio changes so a wide ratio fits instead of
  // overflowing the viewport height.
  useEffect(() => {
    const compute = () => {
      const w = Math.max(
        1,
        Math.min(window.innerWidth - 480, window.innerHeight * (ratio.w / ratio.h))
      )
      setDisplaySize({ width: Math.round(w), height: Math.round(w * ratio.h / ratio.w) })
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [ratio])

  // Load the uploaded image once here; the decoded element is passed down to
  // <Canvas> so it is never fetched or decoded twice.
  useEffect(() => {
    const image = new window.Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      imageWidthRef.current = image.naturalWidth
      imageHeightRef.current = image.naturalHeight
      setImageWidth(image.naturalWidth)
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
        const seedFont = BASE_FONT_SIZE * annotationScaleRef.current
        let newPoints: EyedropperPoint[] =
          method === "slic"
            ? apiPointsToEyedroppers(data.points, seedFont)
            : claudePointsToEyedroppers(data.points, seedFont)

        // Keep only points on the currently-visible crop — under a cover fit +
        // zoom/pan, the API can return points on image regions cropped outside the
        // frame. Filter at suggest-time; later crop changes don't re-filter.
        const filterLayout = canvasLayoutRef.current
        if (filterLayout) {
          const pan = panOffsetRef.current
          newPoints = newPoints.filter((p) => isPointInFrame(p.x, p.y, filterLayout, pan))
        }

        if (hiddenCanvasCtxRef.current) {
          newPoints = newPoints.map((p) => ({
            ...p,
            color: sampleColor(hiddenCanvasCtxRef.current!, p.x, p.y, sampleSizeRef.current),
          }))
        }

        const layout = canvasLayoutRef.current
        if (layout) {
          const laidOut = assignSwatchLayout(
            newPoints,
            layout.canvasWidth,
            layout.canvasHeight,
            layout.imageOffsetY,
            layout.imageScale,
            layout.imageOffsetX
          )
          newPoints = seedNewLabels(
            newPoints, laidOut, styleRef.current, layout.canvasWidth, layout.canvasHeight
          )
          // Under an active pan, edge swatches are placed at pan-free edges and
          // would render shoved off-screen by the +pan translate. Pin them to the
          // currently-visible edge (edgePos − pan) so a re-suggest while panned
          // looks like an unpanned one; they then move with the image on further pans.
          newPoints = anchorSwatchesToVisibleFrame(
            newPoints, layout.canvasWidth, layout.canvasHeight,
            styleRef.current.swatchRadius, panOffsetRef.current
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
      const img = canvasToImage(canvasX, canvasY, layout)
      const { x: clampedX, y: clampedY } = clampToImage(
        img.x, img.y, imageWidthRef.current, imageHeightRef.current
      )
      const newColor = sampleColor(hiddenCanvasCtxRef.current, clampedX, clampedY, sampleSizeRef.current)
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
      const img = canvasToImage(canvasX, canvasY, layout)
      const { x: clampedX, y: clampedY } = clampToImage(
        img.x, img.y, imageWidthRef.current, imageHeightRef.current
      )
      const newColor = hiddenCanvasCtxRef.current
        ? sampleColor(hiddenCanvasCtxRef.current, clampedX, clampedY, sampleSizeRef.current)
        : null

      // Only the dragged point's position/color changes — do NOT re-run
      // assignSwatchLayout here. That would re-sort and redistribute every
      // swatch on the edge by marker position, so dropping one marker next to
      // another reshuffled the swatches (the "eyedropper switches position"
      // bug). Markers may overlap freely; swatches stay exactly where they are.
      setPoints((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, x: clampedX, y: clampedY, ...(newColor ? { color: newColor } : {}) }
            : p
        )
      )

      // Return the clamped position in canvas space so the Konva node snaps to
      // the final location, not the stale pre-drag coords.
      return imageToCanvas(clampedX, clampedY, layout)
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
        ? imageToCanvas(dragged.x, dragged.y, layout)
        : { x: canvasX, y: canvasY }
      // The swatch's rendered center BEFORE this move (edge pos on the first frame,
      // then its live free coords) — the label follows the swatch by this delta.
      const oldSwatch = dragged
        ? getSwatchPos(dragged, layout.canvasWidth, layout.canvasHeight, r)
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

      // Carry the label with the swatch: shift it by the same delta the swatch
      // moved this frame, so their relative offset (and any manual nudge) is kept.
      const dx = snapped.x - oldSwatch.x
      const dy = snapped.y - oldSwatch.y
      setPoints((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, swatchX: snapped.x, swatchY: snapped.y, label: { ...p.label, x: p.label.x + dx, y: p.label.y + dy } }
            : p
        )
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

      // The label already tracked to (canvasX, canvasY) during the last dragMove;
      // if overlap-resolution nudged the swatch, carry the label by that residual.
      const dx = resolved.x - canvasX
      const dy = resolved.y - canvasY
      setPoints((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, swatchX: resolved.x, swatchY: resolved.y, label: { ...p.label, x: p.label.x + dx, y: p.label.y + dy } }
            : p
        )
      )
      // Story 5.2/5.3: guides and the distribution cues are ephemeral — clear them
      // when the drag ends.
      setSnapGuides([])
      setDistribution([])
      return resolved
    },
    []
  )

  // Story 5.4: store the connector bend handle's absolute canvas position on the
  // point. Both handlers just write `connectorMid` from the passed (already
  // clamped by dragBoundFunc) coords — there is no snapping or overlap resolution
  // for the bend in this story. useCallback([]) + read only the args (no refs
  // needed) so the callbacks stay stable (the recurring stale-deps bug). Kept as
  // two handlers to match the swatch handler shape / EyedropperLayer prop contract.
  const handleConnectorDragMove = useCallback(
    (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, connectorMid: { x: canvasX, y: canvasY } } : p))
      )
      return { x: canvasX, y: canvasY }
    },
    []
  )

  const handleConnectorDragEnd = useCallback(
    (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, connectorMid: { x: canvasX, y: canvasY } } : p))
      )
      return { x: canvasX, y: canvasY }
    },
    []
  )

  const handleAddPoint = useCallback((canvasX: number, canvasY: number) => {
    const layout = canvasLayoutRef.current
    const ctx = hiddenCanvasCtxRef.current
    if (!layout || !ctx) return

    // The annotation scene is rendered translated by panOffset, so a stage-relative
    // click maps back to PAN-FREE canvas space by subtracting it before the canvas→
    // image conversion (which the pan-free layout expects). Ignore clicks that fall
    // outside the drawn image.
    const pan = panOffsetRef.current
    const point = canvasClickToImagePoint(
      canvasX - pan.x, canvasY - pan.y, layout, imageWidthRef.current, imageHeightRef.current
    )
    if (!point) return

    const { x, y } = point
    const color = sampleColor(ctx, x, y, sampleSizeRef.current)
    const [newPoint] = apiPointsToEyedroppers(
      [{ x, y, color }],
      BASE_FONT_SIZE * annotationScaleRef.current
    )

    setPoints((prev) => {
      const withNew = [...prev, newPoint]
      const laidOut = assignSwatchLayout(
        withNew,
        layout.canvasWidth,
        layout.canvasHeight,
        layout.imageOffsetY,
        layout.imageScale,
        layout.imageOffsetX
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
        layout.imageOffsetY,
        layout.imageScale,
        layout.imageOffsetX
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
          const w = measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily)
          const labelPos = getLabelPosition(
            swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
            layout.canvasWidth, layout.canvasHeight, w, p.label.fontSize
          )
          return { ...p, label: { ...p.label, x: labelPos.x, y: labelPos.y } }
        })
      )
    }
    setLabelEditMode(true)
  }, [])

  const handleUpdateLabel = useCallback(
    (id: string, patch: Partial<EyedropperPoint["label"]>) => {
      // Presentation fields (font/size/color) apply to EVERY label by default;
      // text/visibility/position stay scoped to the one point.
      // A right-side "beside" label is anchored by its RIGHT edge (origin =
      // swatchCenter - r - gap - textWidth), so its stored x depends on the text
      // width. Labels are seeded EMPTY on edit-mode entry, so typing text would
      // otherwise let the label grow rightward over the swatch. Re-anchor the
      // edited label as its text changes (reusing edit-mode-entry's rule) so its
      // right edge stays pinned at the gap. Scoped to text-only edits in edit mode
      // so it never clobbers a label the artist has since dragged, and so font/
      // size/color broadcasts (which can happen in display mode) leave x/y alone.
      const layout = canvasLayoutRef.current
      const style = styleRef.current
      const reanchor = labelEditModeRef.current && layout != null && "text" in patch
      setPoints((prev) =>
        prev.map((p) => {
          const isTarget = p.id === id
          const next = { ...p.label }
          for (const [k, v] of Object.entries(patch)) {
            if (LABEL_BROADCAST_KEYS.includes(k)) {
              ;(next as Record<string, unknown>)[k] = v
            } else if (isTarget) {
              ;(next as Record<string, unknown>)[k] = v
            }
          }
          if (reanchor && isTarget && p.swatchOrder !== null) {
            const swatchPos = getSwatchPos(p, layout.canvasWidth, layout.canvasHeight, style.swatchRadius)
            const w = measureLabelWidth(next.text, next.fontSize, next.fontFamily)
            const anchor = getLabelPosition(
              swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
              layout.canvasWidth, layout.canvasHeight, w, next.fontSize
            )
            next.x = anchor.x
            next.y = anchor.y
          }
          return { ...p, label: next }
        })
      )
    },
    []
  )

  // Snap a dragged label against OTHER visible labels' boxes and its own marker,
  // then write the snapped origin and surface the alignment guides. Reuses the
  // swatch snapGuides state + Konva SnapGuideLayer. Reads live layout/scale from
  // refs so the callback stays stable (deps []). Labels snap to other labels and
  // to their own marker only — never to other markers/swatches.
  const snapLabel = useCallback((id: string, x: number, y: number) => {
    const layout = canvasLayoutRef.current
    const current = pointsRef.current
    const dragged = current.find((p) => p.id === id)
    if (!layout || !dragged) return { x, y, guides: [] as SnapGuide[] }
    const width = measureLabelWidth(dragged.label.text, dragged.label.fontSize, dragged.label.fontFamily)
    const height = dragged.label.fontSize
    const others: LabelBox[] = current
      .filter(
        (p) =>
          p.id !== id &&
          p.swatchOrder !== null &&
          p.label.visible &&
          p.label.text !== ""
      )
      .map((p) => ({
        x: p.label.x,
        y: p.label.y,
        width: measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily),
        height: p.label.fontSize,
      }))
    const marker = imageToCanvas(dragged.x, dragged.y, layout)
    return computeLabelSnap({
      box: { x, y, width, height },
      others,
      marker,
      threshold: SNAP_SCREEN_PX / (scaleRef.current || 1),
    })
  }, [])

  const handleLabelDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const snapped = snapLabel(id, x, y)
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, label: { ...p.label, x: snapped.x, y: snapped.y } } : p))
      )
      setSnapGuides(snapped.guides)
    },
    [snapLabel]
  )

  const handleLabelDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const snapped = snapLabel(id, x, y)
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, label: { ...p.label, x: snapped.x, y: snapped.y } } : p))
      )
      setSnapGuides([])
    },
    [snapLabel]
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

    // Story 5.4: bend handles are interactive chrome, not part of the artwork.
    // They are only shown for the selected point, but export can fire while a
    // point is selected — so hide any handle nodes for the capture, then restore.
    const handles = stage.find(".connector-handle")
    handles.forEach((h) => h.visible(false))
    // Encode the JPEG in the browser rather than POSTing a PNG data URL to a
    // server route: a full-resolution PNG easily exceeds Vercel's 4.5MB request
    // body limit and gets rejected with 413 before our handler runs. toBlob
    // produces the final q95 JPEG directly, so there is no upload at all.
    const blob = await stage.toBlob({
      mimeType: "image/jpeg",
      quality: 0.95,
      pixelRatio,
    })
    handles.forEach((h) => h.visible(true))
    triggerDownload(blob as Blob, "eyedropper-export.jpg")
  }, [displaySize])

  const handleSelectStyle = useCallback((next: Style) => {
    setStyle(next)
  }, [])

  // Change the aspect ratio. Resets pan to centered — the crop math for the new
  // ratio is different, so a stale pan would jump. Swatches re-distribute via the
  // frame-dimension effect above; points (image space) never move.
  const handleSelectRatio = useCallback((next: Ratio) => {
    setRatio(next)
    setPan({ x: 0, y: 0 })
  }, [])

  // Change the zoom. The stored pan is re-clamped at render via panOffset (a
  // looser zoom grows the slack, a tighter one may push the current pan out of
  // bounds), so this only sets the zoom; swatches/labels/chrome are unaffected.
  const handleZoomChange = useCallback((next: number) => {
    setZoom(next)
  }, [])

  // Pan the crop by a screen-pixel delta (from the pan-tool drag). Convert to
  // canvas units via the live on-screen scale, add to the current pan, and clamp
  // against the current ratio so the image always still covers the frame. Reads
  // everything from refs so the callback stays stable (deps []).
  const handlePanBy = useCallback((screenDX: number, screenDY: number) => {
    const s = scaleRef.current || 1
    const next = {
      x: panRef.current.x + screenDX / s,
      y: panRef.current.y + screenDY / s,
    }
    setPan(clampPan(imageWidthRef.current, imageHeightRef.current, ratioRef.current, next, zoomRef.current))
  }, [])

  // Move the global size slider. Geometry (swatch/connector/marker) scales
  // automatically via scaledStyle, but each label's fontSize is per-point, so
  // rescale them all by the ratio newScale/prevScale — and re-anchor every
  // laid-out label to its swatch at the new scale, since the swatch's rendered
  // center shifts as its radius grows (rescalePointsForSize). This physically
  // moves the independent font-size slider to the new on-screen size (the artist
  // can still grab it to fine-tune afterwards). Reads the previous scale, layout,
  // and base style from refs so it doesn't nest setPoints in a setSizeScale updater.
  const handleSizeScaleChange = useCallback((next: number) => {
    const prev = sizeScaleRef.current
    if (next === prev) return
    setSizeScale(next)
    const layout = canvasLayoutRef.current
    // Rescale labels in ANNOTATION-scale terms (sizeScale/stageScale): the font
    // ratio is unchanged (next/prev), but the swatch radii rescalePointsForSize
    // uses to re-anchor labels must match the RENDERED radii (base × sizeScale ÷
    // stageScale), or the label offset would be computed against the wrong swatch
    // center. scaleRef.current is the live stageScale (synced below).
    const ss = scaleRef.current || 1
    setPoints((pts) =>
      layout
        ? rescalePointsForSize(pts, baseStyleRef.current, prev / ss, next / ss, layout.canvasWidth, layout.canvasHeight)
        : pts.map((p) => ({ ...p, label: { ...p.label, fontSize: p.label.fontSize * (next / prev) } }))
    )
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

  // Re-apply swatch layout when the FRAME dimensions change: on first load (layout
  // null → available) so points fetched before layout get placed, and on every
  // ratio change so swatches redistribute to the new edges. Keyed on canvasWidth/
  // canvasHeight (not the whole layout) so a pan-only change — which shifts the
  // image offsets but not the frame — does NOT reshuffle swatches; the image just
  // slides beneath them. Reads the full transform from the ref (synced above).
  const frameW = canvasLayout?.canvasWidth ?? 0
  const frameH = canvasLayout?.canvasHeight ?? 0
  useEffect(() => {
    const layout = canvasLayoutRef.current
    if (!layout) return
    setPoints((prev) => {
      if (prev.length === 0) return prev
      const laidOut = assignSwatchLayout(
        prev,
        layout.canvasWidth,
        layout.canvasHeight,
        layout.imageOffsetY,
        layout.imageScale,
        layout.imageOffsetX
      )
      return seedNewLabels(
        prev, laidOut, styleRef.current, layout.canvasWidth, layout.canvasHeight
      )
    })
  }, [frameW, frameH])

  // The precision cue's radius in CANVAS units: sampleSize is the sampled box's
  // EDGE in IMAGE pixels, so its half-width is sampleSize/2; the marker is drawn
  // scaled by imageScale, so multiply to match the sampled footprint on screen.
  // 0 (→ no ring) unless the slider is active.
  const precisionRadius =
    precisionActive && canvasLayout ? (sampleSize / 2) * canvasLayout.imageScale : 0

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
          <button
            onClick={() => setInteractionMode("pan")}
            className={`w-full text-left text-xs px-2 py-1.5 rounded border mt-1 transition-colors ${
              interactionMode === "pan"
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            ✋ Pan image
          </button>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Aspect
          </h3>
          <AspectPicker ratio={ratio} onSelect={handleSelectRatio} />
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Zoom
          </h3>
          <div className="flex items-center gap-2">
            {/* Zooms the image within the frame for a tighter crop (companion to
                the Pan tool). Part of the export. Markers follow the image; use
                the Pan tool to reposition the crop after zooming in. */}
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={4}
              step={0.1}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-[var(--color-text-primary)] font-mono w-10 text-right">
              {zoom.toFixed(1)}×
            </span>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Style
          </h3>
          <StylePicker styles={styles} activeStyleName={style.name} onSelect={handleSelectStyle} />
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Size
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="range"
              aria-label="Overall size"
              min={1}
              max={2.5}
              step={0.1}
              value={sizeScale}
              onChange={(e) => handleSizeScaleChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-[var(--color-text-primary)] font-mono w-10 text-right">
              {sizeScale.toFixed(1)}×
            </span>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            Precision
          </h3>
          <div className="flex items-center gap-2">
            {/* Sample-area size: the slider value is the box EDGE in image pixels
                (sampleColor's `size`) — 1 = a true single pixel — shown directly in
                the label. */}
            <input
              type="range"
              aria-label="Sample area"
              min={1}
              max={40}
              step={1}
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              onFocus={() => setPrecisionActive(true)}
              onBlur={() => setPrecisionActive(false)}
              className="flex-1"
            />
            <span className="text-xs text-[var(--color-text-primary)] font-mono w-10 text-right">
              {sampleSize}px
            </span>
          </div>
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
            style={scaledStyle}
            sizeScale={annotationScale}
            interactionMode={interactionMode}
            pencilTexture={pencilTexture}
            borderTexture={borderTexture}
            labelEditMode={labelEditMode}
            snapGuides={snapGuides}
            distribution={distribution}
            pan={panOffset}
            precisionRadius={precisionRadius}
            onPanBy={handlePanBy}
            onMarkerDragMove={handleMarkerDragMove}
            onMarkerDragEnd={handleMarkerDragEnd}
            onSwatchDragMove={handleSwatchDragMove}
            onSwatchDragEnd={handleSwatchDragEnd}
            onConnectorDragMove={handleConnectorDragMove}
            onConnectorDragEnd={handleConnectorDragEnd}
            selectedPointId={selectedPointId}
            onAddPoint={handleAddPoint}
            onRequestRemove={handleRequestRemove}
            onSelectPoint={handleSelectPoint}
            onDeselect={handleDeselect}
            onUpdateLabelText={(id, text) => handleUpdateLabel(id, { text })}
            onUpdateLabelPos={handleLabelDragMove}
            onLabelDragEnd={handleLabelDragEnd}
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
          <ExportButton onExport={handleExport} ratioLabel={ratioLabel(ratio)} />
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
