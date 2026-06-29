# Story 2.3: Eyedropper Points Rendering & Color Sampling

---
baseline_commit: d6b85a9841708d33acfc9078e5c1460e50ce150a
---

Status: done

## Story

As an **artist**,
I want to see each suggested color point rendered as a ring marker on the image connected to a swatch circle on the canvas edge,
so that I can visually associate each swatch with its source location on the drawing.

## Acceptance Criteria

1. **Given** points are loaded (from SLIC or Claude), **when** the `EyedropperLayer` renders, **then** each point shows: a ring marker (~12px radius, white, hollow) at its `(x, y + imageOffsetY)` in canvas coords, a swatch circle (~48px radius, filled with sampled color, white border) positioned on the canvas edge, and a connector line between them per the current style.

2. **Given** the editor mounts, **when** the image is loaded into the Konva stage, **then** a hidden `<canvas>` element is also populated with the original image at 1× scale for pixel sampling — this element is not visible to the user.

3. **Given** a point exists at `(x, y)`, **when** `color-sample.ts` is called, **then** it reads an 8×8 pixel area centred on `(x, y)` from the hidden canvas using `ctx.getImageData(x-4, y-4, 8, 8)` and returns the averaged RGB as a hex string.

4. **Given** `swatch-layout.ts` is invoked with the current points, **when** it runs, **then** each swatch is assigned to its nearest canvas edge (using canvas coords = image coords + `imageOffsetY` offset) and swatches on each edge are sorted in the spatial order of their source markers (no lines cross), spread evenly along the full edge; `swatchSide` and `swatchOrder` are populated.

5. **Given** suggest returns points (SLIC or Claude), **when** the hidden canvas ctx is available, **then** every point's `color` is resampled via `color-sample.ts` before being set in state (replacing SLIC's pre-supplied color and Claude's `#888888` placeholder).

## Tasks / Subtasks

- [x] Task 1: Implement `sampleColor` in `lib/color-sample.ts` (AC: 2, 3)
  - [x] Implement the sampling logic: clamp `(x, y)` to `[4, width-4] × [4, height-4]`, call `ctx.getImageData(cx-4, cy-4, 8, 8)`, average all 64 RGBA pixels (only R/G/B), return hex string
  - [x] Export: `export function sampleColor(ctx: CanvasRenderingContext2D, x: number, y: number): string`

- [x] Task 2: Implement `assignSwatchLayout` in `lib/swatch-layout.ts` (AC: 4)
  - [x] Update signature to `assignSwatchLayout(points: EyedropperPoint[], canvasWidth: number, canvasHeight: number, imageOffsetY?: number): EyedropperPoint[]`  
  - [x] Step 1 — Assign sides: for each point where `swatchSide === "auto"`, compute canvas coords `(cx = p.x, cy = p.y + imageOffsetY)`, find minimum distance to each of the 4 edges, assign that edge as `swatchSide`
  - [x] Step 2 — Group by effective side (after overrides applied)
  - [x] Step 3 — Sort each group by coordinate along the edge: left/right groups sorted by `(p.y + imageOffsetY)` ascending; top/bottom groups sorted by `p.x` ascending
  - [x] Step 4 — Evenly distribute: for group of `n` points on edge of length `L`, point at index `i` (0-based) gets `swatchOrder = Math.round(L * (i + 1) / (n + 1))`; `L = canvasHeight` for left/right, `L = canvasWidth` for top/bottom
  - [x] Return new `EyedropperPoint[]` with updated `swatchSide` and `swatchOrder` on every point (preserve all other fields)

- [x] Task 3: Set up hidden canvas and re-sample colors in `EditorShell` (`components/Editor/index.tsx`) (AC: 2, 5)
  - [x] Add `import { sampleColor } from "@/lib/color-sample"` and `import { assignSwatchLayout } from "@/lib/swatch-layout"`
  - [x] Add `import { loadStyles } from "@/lib/styles"` and `import type { Style } from "@/lib/styles"`
  - [x] Add `const hiddenCanvasCtxRef = useRef<CanvasRenderingContext2D | null>(null)` (no lint warning — intentionally stable ref)
  - [x] Add `const [style, setStyle] = useState<Style>(() => loadStyles()[0])` — initialized to `float_clean`; setter reserved for Story 3.1 style picker
  - [x] In the image load `useEffect`, after all existing state setters and **before** `setImg(image)`: create an offscreen canvas at `image.naturalWidth × image.naturalHeight`, draw the image, store the 2D context in `hiddenCanvasCtxRef.current`
  - [x] Refactor `runSuggest` to process points in a pipeline before `setPoints`:
    - [x] Get raw points: `let newPoints = method === "slic" ? apiPointsToEyedroppers(data.points) : claudePointsToEyedroppers(data.points)`
    - [x] Re-sample colors if ctx available: `if (hiddenCanvasCtxRef.current) newPoints = newPoints.map(p => ({ ...p, color: sampleColor(hiddenCanvasCtxRef.current!, p.x, p.y) }))`
    - [x] Apply layout if canvasLayout available: `if (canvasLayout) newPoints = assignSwatchLayout(newPoints, canvasLayout.canvasWidth, canvasLayout.canvasHeight, canvasLayout.imageOffsetY)`
    - [x] `setPoints(newPoints)`
  - [x] Add `canvasLayout` to `runSuggest`'s `useCallback` dependency array
  - [x] Pass `style` and `imageOffsetY` (from `canvasLayout`) as new props to `<Canvas>` (see Task 4)

- [x] Task 4: Update `Canvas.tsx` to forward new props to `EyedropperLayer` (AC: 1)
  - [x] Add `style: Style` to `CanvasProps`; import `Style` from `@/lib/styles`
  - [x] Pass `imageOffsetY={canvasLayout.imageOffsetY}`, `canvasWidth={canvasLayout.canvasWidth}`, `canvasHeight={canvasLayout.canvasHeight}`, `style={style}` to `<EyedropperLayer>`
  - [x] In `components/Editor/index.tsx`, pass `style={style}` to `<Canvas>` (update the Canvas JSX call)

- [x] Task 5: Rewrite `EyedropperLayer.tsx` to render ring + swatch + connector (AC: 1)
  - [x] Update props interface: add `imageOffsetY: number`, `canvasWidth: number`, `canvasHeight: number`, `style: Style`; import `Style` from `@/lib/styles`; import `Line` from `react-konva`
  - [x] Add `getSwatchPos(p, canvasWidth, canvasHeight, swatchRadius)` helper — see Dev Notes for coords
  - [x] Render order per point (so connector is drawn first, underneath shapes): `(1)` connector `Line` (if `style.connectorType !== "none"`), `(2)` swatch `Circle`, `(3)` ring marker `Circle`
  - [x] Ring marker: `<Circle x={p.x} y={p.y + imageOffsetY} radius={12} stroke={style.markerColor} strokeWidth={2} fill="" />` — render only if `style.markerStyle !== "none"`
  - [x] Swatch circle: `<Circle x={swatchPos.x} y={swatchPos.y} radius={style.swatchRadius} fill={p.color} stroke={style.swatchBorderColor} strokeWidth={style.swatchBorderWidth} />`
  - [x] Straight connector: `<Line points={[swatchPos.x, swatchPos.y, p.x, p.y + imageOffsetY]} stroke={style.connectorColor} strokeWidth={style.connectorWidth} />`
  - [x] Curved connector: `<Line points={[swatchPos.x, swatchPos.y, midCtrlX, midCtrlY, p.x, p.y + imageOffsetY]} tension={0.5} stroke={style.connectorColor} strokeWidth={style.connectorWidth} />` — see Dev Notes for `midCtrl` formula
  - [x] Guard: if `p.swatchOrder === null`, skip rendering that point (layout not yet computed)

- [x] Task 6: Write tests (AC: all)
  - [x] `lib/color-sample.test.ts`:
    - [x] Returns correct hex average for a solid-color 8×8 pixel block
    - [x] Clamps x/y at canvas edges (coordinate 2 on a 10×10 canvas → reads from `[0, 0, 8, 8]`, not `[-2, -2, 8, 8]`)
    - [x] Handles edge pixel: x = canvasWidth - 2 (clamps to width - 4)
    - [x] Returns valid 7-character hex string in all cases (`#rrggbb`)
  - [x] `lib/swatch-layout.test.ts`:
    - [x] Empty array → returns empty array
    - [x] Single point: assigned to nearest edge; `swatchOrder = Math.round(L / 2)` (only point on that edge)
    - [x] Two points on the same edge (by proximity): sorted by coordinate along edge; orders = `round(L/3)` and `round(2L/3)`
    - [x] Points equidistant between two edges: deterministic (left wins over right when `distLeft === distRight`, top wins over bottom when `distTop === distBottom` — pick a convention and document it)
    - [x] Manual `swatchSide !== "auto"` is respected: point stays on specified side even if a different edge is nearer
    - [x] `imageOffsetY` shifts canvas-y correctly (a point at `y=0` in image space with `imageOffsetY=200` assigns to top edge even though it's near top of canvas, not image)
    - [x] Points order preserved: output array length and point ids match input
  - [x] `components/Editor/EyedropperLayer.test.tsx` — update and expand (the current 3 tests mock `Circle` only; extend the mock to include `Line`):
    - [x] Update `vi.mock("react-konva")` to also mock `Line: ({ points, stroke, ... }) => <div data-testid="line" data-points={JSON.stringify(points)} />`
    - [x] Update `makePoint` helper to include non-null `swatchOrder` and concrete `swatchSide` (e.g. `"left"`)
    - [x] Add `style` and layout props to all render calls (use `loadStyles()[0]` as default)
    - [x] Existing test "renders one circle per point" → still passes (now 2 circles per point: ring + swatch); update assertion to `2 * points.length`
    - [x] New test: ring marker renders at `p.x, p.y + imageOffsetY`
    - [x] New test: swatch renders at swatch edge position (`x = swatchRadius` for left edge)
    - [x] New test: connector Line rendered when `connectorType !== "none"`
    - [x] New test: no connector Line when `style.connectorType === "none"`
    - [x] New test: point with `swatchOrder === null` → nothing rendered for that point
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 75 tests)

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Files to MODIFY (not create)

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/color-sample.ts` | Stub returning `"#000000"` | Real 8×8 pixel averaging implementation |
| `lib/swatch-layout.ts` | Stub returning `points` unchanged | Port of Python `_assign_sides` + `_place_swatches_aligned` |
| `components/Editor/EyedropperLayer.tsx` | Placeholder `Circle` per point | Full ring + swatch + connector rendering |
| `components/Editor/Canvas.tsx` | Passes only `points` to EyedropperLayer | Also passes `imageOffsetY`, `canvasWidth`, `canvasHeight`, `style` |
| `components/Editor/index.tsx` | `runSuggest` only calls `setPoints`; no hidden canvas | Adds hidden canvas, color resampling, swatch layout, `style` state |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint` interface is correct as-is
- `lib/canvas-to-916.ts` — `imageOffsetY` already correct
- `app/api/suggest/route.ts` — no server changes
- `app/editor/page.tsx` — no changes

### `sampleColor` implementation

```typescript
export function sampleColor(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const cx = Math.max(4, Math.min(ctx.canvas.width - 4, Math.round(x)))
  const cy = Math.max(4, Math.min(ctx.canvas.height - 4, Math.round(y)))
  const data = ctx.getImageData(cx - 4, cy - 4, 8, 8).data
  let r = 0, g = 0, b = 0
  const n = 64 // 8×8 = 64 pixels
  for (let i = 0; i < n; i++) {
    r += data[i * 4]
    g += data[i * 4 + 1]
    b += data[i * 4 + 2]
  }
  return `#${Math.round(r / n).toString(16).padStart(2, "0")}${Math.round(g / n).toString(16).padStart(2, "0")}${Math.round(b / n).toString(16).padStart(2, "0")}`
}
```

### `assignSwatchLayout` implementation

Full implementation to replace the stub — note the signature adds `imageOffsetY`:

```typescript
import type { EyedropperPoint } from "./types"

type Side = "left" | "right" | "top" | "bottom"

export function assignSwatchLayout(
  points: EyedropperPoint[],
  canvasWidth: number,
  canvasHeight: number,
  imageOffsetY: number = 0
): EyedropperPoint[] {
  if (points.length === 0) return []

  // Step 1: Assign sides for "auto" points
  const withSides = points.map((p): EyedropperPoint => {
    if (p.swatchSide !== "auto") return p
    const cx = p.x
    const cy = p.y + imageOffsetY
    const dLeft = cx
    const dRight = canvasWidth - cx
    const dTop = cy
    const dBottom = canvasHeight - cy
    const min = Math.min(dLeft, dRight, dTop, dBottom)
    let side: Side
    if (min === dLeft) side = "left"
    else if (min === dRight) side = "right"
    else if (min === dTop) side = "top"
    else side = "bottom"
    return { ...p, swatchSide: side }
  })

  // Step 2: Group by side
  const groups: Record<Side, EyedropperPoint[]> = { left: [], right: [], top: [], bottom: [] }
  for (const p of withSides) {
    groups[p.swatchSide as Side].push(p)
  }

  // Step 3: Sort each group by coordinate along the edge (no-crossing guarantee)
  const byCanvasY = (a: EyedropperPoint, b: EyedropperPoint) =>
    (a.y + imageOffsetY) - (b.y + imageOffsetY)
  const byX = (a: EyedropperPoint, b: EyedropperPoint) => a.x - b.x
  groups.left.sort(byCanvasY)
  groups.right.sort(byCanvasY)
  groups.top.sort(byX)
  groups.bottom.sort(byX)

  // Step 4: Evenly distribute along full edge
  const result = new Map<string, EyedropperPoint>()
  for (const [side, group] of Object.entries(groups) as [Side, EyedropperPoint[]][]) {
    const n = group.length
    const L = (side === "left" || side === "right") ? canvasHeight : canvasWidth
    group.forEach((p, i) => {
      result.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
    })
  }

  return points.map(p => result.get(p.id) ?? p)
}
```

### Hidden canvas setup in EditorShell

In the image load `useEffect`, add after `setBgColor(detectBorderColor(image))`:

```typescript
// Populate hidden canvas for pixel sampling — never shown to user
const offscreen = document.createElement("canvas")
offscreen.width = image.naturalWidth
offscreen.height = image.naturalHeight
const ctx2d = offscreen.getContext("2d")!
ctx2d.drawImage(image, 0, 0)
hiddenCanvasCtxRef.current = ctx2d
```

**Race condition note:** `runSuggest` is triggered by a `useEffect` that fires immediately after mount (before the image loads). The SLIC call takes ~200ms, so the hidden canvas is usually ready when the response arrives. But if not (fast network / slow image decode), the color sampling step is silently skipped (`hiddenCanvasCtxRef.current` is null → the `if` guard in the pipeline is falsy). SLIC points already carry their colors; Claude points keep `#888888`. A follow-up story (2.4) re-samples on every drag, so colors correct themselves on first interaction. This is acceptable for Story 2.3.

### `runSuggest` pipeline in EditorShell

Replace the current `setPoints(...)` call with:

```typescript
if (data && Array.isArray(data.points)) {
  let newPoints: EyedropperPoint[] =
    method === "slic"
      ? apiPointsToEyedroppers(data.points)
      : claudePointsToEyedroppers(data.points)

  // Re-sample colors from hidden canvas (applies to both SLIC and Claude)
  if (hiddenCanvasCtxRef.current) {
    newPoints = newPoints.map((p) => ({
      ...p,
      color: sampleColor(hiddenCanvasCtxRef.current!, p.x, p.y),
    }))
  }

  // Assign swatch layout
  if (canvasLayout) {
    newPoints = assignSwatchLayout(
      newPoints,
      canvasLayout.canvasWidth,
      canvasLayout.canvasHeight,
      canvasLayout.imageOffsetY
    )
  }

  setPoints(newPoints)
}
```

Also update the `useCallback` dependency array: `[imageId, canvasLayout]`.

### `style` state and Canvas prop threading

In `EditorShell`:
```typescript
const [style, setStyle] = useState<Style>(() => loadStyles()[0])
// setStyle is reserved for Story 3.1 style picker — no setter call in this story
```

In `<Canvas>` JSX:
```tsx
<Canvas
  image={img}
  canvasLayout={canvasLayout}
  imageHeight={imageHeight}
  bgColor={bgColor}
  displayWidth={displaySize.width}
  displayHeight={displaySize.height}
  points={points}
  style={style}   // ← new
/>
```

In `Canvas.tsx` add to `CanvasProps`:
```typescript
import type { Style } from "@/lib/styles"
// ...
interface CanvasProps {
  // ... existing props ...
  style: Style
}
```

And update `<EyedropperLayer>` call:
```tsx
<EyedropperLayer
  points={points}
  imageOffsetY={canvasLayout.imageOffsetY}
  canvasWidth={canvasLayout.canvasWidth}
  canvasHeight={canvasLayout.canvasHeight}
  style={style}
/>
```

### `EyedropperLayer.tsx` full rewrite

```tsx
"use client"

import { Layer, Circle, Line } from "react-konva"
import type { EyedropperPoint } from "@/lib/types"
import type { Style } from "@/lib/styles"

interface Props {
  points: EyedropperPoint[]
  imageOffsetY: number
  canvasWidth: number
  canvasHeight: number
  style: Style
}

function getSwatchPos(
  p: EyedropperPoint,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): { x: number; y: number } {
  const r = swatchRadius
  switch (p.swatchSide) {
    case "left":   return { x: r, y: p.swatchOrder! }
    case "right":  return { x: canvasWidth - r, y: p.swatchOrder! }
    case "top":    return { x: p.swatchOrder!, y: r }
    case "bottom": return { x: p.swatchOrder!, y: canvasHeight - r }
    default:       return { x: r, y: p.swatchOrder ?? canvasHeight / 2 }
  }
}

function getCurvedMidpoint(
  sx: number, sy: number,
  mx: number, my: number,
  side: string
): [number, number] {
  const cx = (sx + mx) / 2
  const cy = (sy + my) / 2
  // Pull midpoint outward (away from image center) for a natural arc
  const offset = 40
  if (side === "left")   return [cx - offset, cy]
  if (side === "right")  return [cx + offset, cy]
  if (side === "top")    return [cx, cy - offset]
  if (side === "bottom") return [cx, cy + offset]
  return [cx, cy]
}

export default function EyedropperLayer({
  points,
  imageOffsetY,
  canvasWidth,
  canvasHeight,
  style,
}: Props) {
  return (
    <Layer>
      {points.map((p) => {
        if (p.swatchOrder === null) return null

        const markerX = p.x
        const markerY = p.y + imageOffsetY
        const swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)
        const [midCx, midCy] = getCurvedMidpoint(
          swatchPos.x, swatchPos.y,
          markerX, markerY,
          p.swatchSide
        )

        return (
          <Layer key={p.id}>
            {/* Connector — drawn first (underneath) */}
            {style.connectorType !== "none" && (
              <Line
                points={
                  style.connectorType === "curved"
                    ? [swatchPos.x, swatchPos.y, midCx, midCy, markerX, markerY]
                    : [swatchPos.x, swatchPos.y, markerX, markerY]
                }
                tension={style.connectorType === "curved" ? 0.5 : 0}
                stroke={style.connectorColor}
                strokeWidth={style.connectorWidth}
                listening={false}
              />
            )}

            {/* Swatch circle */}
            <Circle
              x={swatchPos.x}
              y={swatchPos.y}
              radius={style.swatchRadius}
              fill={p.color}
              stroke={style.swatchBorderColor}
              strokeWidth={style.swatchBorderWidth}
            />

            {/* Ring marker */}
            {style.markerStyle !== "none" && (
              <Circle
                x={markerX}
                y={markerY}
                radius={12}
                fill=""
                stroke={style.markerColor}
                strokeWidth={2}
              />
            )}
          </Layer>
        )
      })}
    </Layer>
  )
}
```

**Note on nested `<Layer>` inside `<Layer>`**: Konva supports nesting layers for grouping — or use a Konva `Group` instead if needed. If nesting layers causes issues, replace inner `<Layer key={p.id}>` with `<Group key={p.id}>` (import `Group` from `react-konva`).

### Coordinate system summary

- `EyedropperPoint.x` = image pixel X (same as canvas X — no horizontal offset)
- `EyedropperPoint.y` = image pixel Y (add `imageOffsetY` to get canvas Y)
- Hidden canvas: drawn at natural image size; sample at `(p.x, p.y)` — **no offset needed** (sampling from image space, not canvas space)
- Swatch position: `swatchOrder` = pixel position along the edge (Y for left/right, X for top/bottom), ranging 0–canvasHeight or 0–canvasWidth
- Swatch center: `x = swatchRadius` for left, `x = canvasWidth - swatchRadius` for right, `y = swatchRadius` for top, `y = canvasHeight - swatchRadius` for bottom

### Deferred fix applied: imageOffsetY on markers

The `deferred-work.md` entry "Suggested points render imageOffsetY px too high" is FIXED by this story. `EyedropperLayer` now adds `imageOffsetY` to all marker Y positions. The fix applies to both SLIC and Claude points.

### Testing `swatch-layout.ts` — determinism note

When `distLeft === distRight` (point at `x = canvasWidth / 2`), the tie-breaking rule must be documented and tested. Recommended: left wins over right (first `if` in the chain), top wins over bottom. Tests must assert the specific side assignment for tie cases so they don't become flaky.

Mock for `ctx.getImageData` in `color-sample.test.ts`:
```typescript
function makeCtx(pixelData: Uint8ClampedArray, width = 100, height = 100) {
  return {
    canvas: { width, height },
    getImageData: (x: number, y: number, w: number, h: number) => ({
      data: pixelData,
    }),
  } as unknown as CanvasRenderingContext2D
}
```

### Tailwind v4 reminder

No `tailwind.config.ts`, no `theme.extend`. Use `bg-[var(--color-*)]`, `border-[var(--color-border)]`, etc.

### Previous story learnings

- `vi.hoisted` required for mock references used in `vi.mock` factory
- `process.env` mutations must be restored in `afterEach`
- Tailwind v4: no config file, CSS variables only
- `pointIdCounter` at module scope (pre-existing, from Story 2.1) — still no issue for 2.3; defer to 2.4+
- React Testing Library cannot inspect Konva canvas directly — mock `react-konva` components to render DOM elements with `data-*` attrs

### Current test baseline

75 tests passing (from Story 2.2 completion). New tests this story: ~18–24.

## Review Findings

_Code review 2026-06-14 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). `npm test` → 102 tests pass._

- [x] [Review][Patch] `runSuggest` fires twice per load + stale-response race — `canvasLayout` is in `runSuggest`'s `useCallback` deps `[imageId, canvasLayout]` (index.tsx:194) and the auto-run effect depends on `[runSuggest]` (index.tsx:196-198). On mount `canvasLayout` is `null`, so SLIC runs once with no layout (points get `swatchOrder: null` → invisible) and again after `image.onload` sets `canvasLayout`. Two SLIC fetches per load; whichever resolves last wins `setPoints` (no AbortController / stale guard), so the layout-less run can overwrite the good one and render nothing. **Resolved approach (option 1, chosen 2026-06-14):** remove `canvasLayout` from `runSuggest` (it only fetches + samples + `setPoints` of raw points); add a separate effect that applies `assignSwatchLayout` whenever `canvasLayout` or `points` change (guarded against re-layout loops). No duplicate fetch, no race. [index.tsx:194,196-198]

- [x] [Review][Patch] Stale `eslint-disable` on `hiddenCanvasCtxRef` — the ref IS used (lines 140,168,171), so the `@typescript-eslint/no-unused-vars` disable above it is dead and misleading; remove it. [index.tsx:107]
- [x] [Review][Patch] Ring marker uses `fill=""` (invalid color value) — empty string is not a valid Konva fill; canvas ignores it rather than treating it as "no fill". Use `fill={undefined}` (or omit) for a hollow ring. [EyedropperLayer.tsx:100]
- [x] [Review][Patch] Clamp tests don't actually verify the read region — the `makeCtx` mock ignores its x/y args (color-sample.test.ts:7), so the "clamps to (0,0,8,8)" tests assert only the averaged color, not the clamped `getImageData` coords that Task 6 wanted verified. Capture the call args in the mock and assert the region. [color-sample.test.ts:7,37-49]

- [x] [Review][Defer] `markerStyle: "dot"` renders identically to `"ring"` — EyedropperLayer.tsx:95 only checks `!== "none"` and always draws a hollow ring; the `grid` style (styles.json) uses `"dot"` but is unreachable until the Story 3.1 style picker. Matches the spec's own Task 5 code sample, so not a regression. Deferred to Story 3.1. [EyedropperLayer.tsx:95-104]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (eu.anthropic.claude-sonnet-4-6)

### Debug Log References

- Canvas.test.tsx needed `style` prop added after Canvas.tsx became typed — 4 TS errors, fixed by importing `loadStyles` and adding `style: loadStyles()[0]` to `makeProps`.
- Used `Group` (not nested `Layer`) for per-point grouping in EyedropperLayer per the Dev Notes recommendation.
- Tie-breaking convention: left > right > top > bottom (first `if` in chain wins). Documented in `swatch-layout.test.ts`.

### Completion Notes List

- Implemented `sampleColor` in `lib/color-sample.ts`: 8×8 pixel averaging with edge clamping, returns 7-char hex string.
- Implemented `assignSwatchLayout` in `lib/swatch-layout.ts`: full port of Python `_assign_sides` + `_place_swatches_aligned`, with `imageOffsetY` parameter, manual `swatchSide` override support, and no-crossing sort.
- Added hidden canvas setup in `EditorShell.useEffect` (image load); populates `hiddenCanvasCtxRef.current` before `setImg`.
- Refactored `runSuggest` to pipeline: raw points → color resample → swatch layout → `setPoints`. Added `canvasLayout` to dependency array.
- Added `style` state (initialized to `loadStyles()[0]`; setter reserved for Story 3.1).
- Updated `Canvas.tsx` to accept `style: Style` and forward all new props to `EyedropperLayer`.
- Rewrote `EyedropperLayer.tsx`: ring marker + swatch circle + connector line per point, using `Group` for per-point grouping, skipping points with `swatchOrder === null`.
- Fixed deferred work: markers now render at `p.y + imageOffsetY` (previously rendered too high).
- 102 tests total (was 75); all pass, no regressions, no TypeScript errors.

### File List

- `eyedropper-web/lib/color-sample.ts` — modified (stub → real implementation)
- `eyedropper-web/lib/swatch-layout.ts` — modified (stub → full port)
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` — modified (placeholder → ring+swatch+connector)
- `eyedropper-web/components/Editor/Canvas.tsx` — modified (added `style` prop, forwarded layout props)
- `eyedropper-web/components/Editor/index.tsx` — modified (hidden canvas, color resampling, swatch layout, style state)
- `eyedropper-web/lib/color-sample.test.ts` — created
- `eyedropper-web/lib/swatch-layout.test.ts` — created
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx` — modified (expanded mock, new tests)
- `eyedropper-web/components/Editor/Canvas.test.tsx` — modified (added `style` to makeProps)

### Change Log

- 2026-06-14: Implemented Story 2.3 — eyedropper points rendering & color sampling. Added `sampleColor`, `assignSwatchLayout`, hidden canvas setup, color resampling pipeline, style threading, full EyedropperLayer ring+swatch+connector render. 27 new tests added (75→102).
