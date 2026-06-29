# Story 2.5: Drag Swatches Along Edge

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want to drag a swatch circle to reposition it along its canvas edge,
so that I can fine-tune the layout before exporting.

## Acceptance Criteria

1. **Given** I am in Select/drag mode **when** I drag a swatch circle **then** the swatch moves along its assigned canvas edge only — it cannot be dragged to a different edge or off the edge.

2. **Given** I drag a swatch **when** the drag ends **then** the swatch's `swatchOrder` is updated to reflect its new position; the connector line from the marker updates accordingly.

3. **Given** I drag a swatch that would overlap another swatch on the same edge **when** the drag ends **then** the other swatches on that edge are redistributed to avoid overlap while maintaining their relative order.

## Tasks / Subtasks

- [x] Task 1: Add `redistributeOnEdge` helper and update `handleSwatchDragEnd` / `handleSwatchDragMove` in `EditorShell` (AC: 1, 2, 3)
  - [x] Export `redistributeOnEdge(points, side, canvasWidth, canvasHeight, swatchRadius)` from `lib/swatch-layout.ts` — sorts existing swatches on the given edge by current `swatchOrder` (not marker position), then redistributes them evenly using the same `L * (i+1) / (n+1)` formula (see Dev Notes)
  - [x] Add `styleRef = useRef<Style>(style)` at top of EditorShell so drag callbacks can read `swatchRadius` without deps
  - [x] Add `handleSwatchDragMove` as a `useCallback` with `[]` deps: reads point's `swatchSide` from `setPoints` functional update, extracts the along-edge coordinate from `(canvasX, canvasY)`, clamps to `[swatchRadius, edgeLength - swatchRadius]`, updates `swatchOrder` on that point only (see Dev Notes)
  - [x] Add `handleSwatchDragEnd` as a `useCallback` with `[]` deps: clamps the final position, calls `redistributeOnEdge` for that edge, returns `{ x: number, y: number }` in canvas coords so the Konva node can be snapped (see Dev Notes)
  - [x] Pass `onSwatchDragMove={handleSwatchDragMove}` and `onSwatchDragEnd={handleSwatchDragEnd}` to `<Canvas>`

- [x] Task 2: Thread new props through `Canvas.tsx` to `EyedropperLayer` (AC: 1, 2, 3)
  - [x] Add `onSwatchDragMove: (id: string, canvasX: number, canvasY: number) => void` to `CanvasProps`
  - [x] Add `onSwatchDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }` to `CanvasProps`
  - [x] Pass both through to `<EyedropperLayer>`

- [x] Task 3: Make swatch circles draggable in `EyedropperLayer.tsx` (AC: 1, 2, 3)
  - [x] Add `onSwatchDragMove` and `onSwatchDragEnd` to the `Props` interface (same signatures as Canvas)
  - [x] Set `draggable={interactionMode === "select"}` on the swatch `Circle`
  - [x] Add `dragBoundFunc` to constrain the swatch to its assigned edge (see Dev Notes for per-side logic)
  - [x] Add `onMouseEnter`/`onMouseLeave` cursor handlers to the swatch `Circle` in select mode (cursor: `"grab"` / `"default"`) — same conditional-spread pattern as ring marker
  - [x] Add `onDragMove`: reads `e.target.x()` / `e.target.y()` (already constrained by `dragBoundFunc`) and calls `onSwatchDragMove(p.id, x, y)`
  - [x] Add `onDragEnd`: reads final position, calls `onSwatchDragEnd(p.id, x, y)`, then snaps node: `e.target.x(snapped.x); e.target.y(snapped.y)` — same snap-back pattern as ring marker

- [x] Task 4: Write tests (AC: all)
  - [x] Update `EyedropperLayer.test.tsx` — update the Circle mock to expose `onDragMove`/`onDragEnd`/`onMouseEnter`/`onMouseLeave` on the swatch circle (the mock already does this via mouseDown/mouseUp — ensure swatch and ring marker are distinguishable by index)
  - [x] New test: swatch Circle has `data-draggable="true"` in select mode
  - [x] New test: swatch Circle has `data-draggable="false"` in add mode
  - [x] New test: `onDragMove` on swatch circle calls `onSwatchDragMove` with `(id, x, y)`
  - [x] New test: `onDragEnd` on swatch circle calls `onSwatchDragEnd` with `(id, x, y)`
  - [x] New test: swatch `onDragEnd` snaps the Konva node to the position returned by `onSwatchDragEnd`
  - [x] Unit tests for `redistributeOnEdge` in `lib/swatch-layout.test.ts` (see Dev Notes)
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 117 tests)

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Files to MODIFY

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/swatch-layout.ts` | Exports only `assignSwatchLayout` | Add export `redistributeOnEdge` |
| `lib/swatch-layout.test.ts` | 10 tests for `assignSwatchLayout` | Add tests for `redistributeOnEdge` |
| `components/Editor/index.tsx` | Has marker drag handlers; no swatch drag | Add `styleRef`, `handleSwatchDragMove`, `handleSwatchDragEnd`; pass to Canvas |
| `components/Editor/Canvas.tsx` | Passes `onMarkerDragMove`/`onMarkerDragEnd` to EyedropperLayer | Also pass `onSwatchDragMove`/`onSwatchDragEnd` |
| `components/Editor/EyedropperLayer.tsx` | Swatch Circle is static (no drag) | Make swatch draggable in select mode with dragBoundFunc + handlers |
| `components/Editor/EyedropperLayer.test.tsx` | Swatch tested as non-draggable | Update test + add swatch drag tests |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint.swatchOrder` and `swatchSide` are correct as-is
- `lib/drag-utils.ts` — `clampToImage` is for marker drag only; swatch clamping is inline
- `app/` routes — no server changes
- `lib/color-sample.ts` — not needed; swatch drag doesn't re-sample color

### Coordinate System Recap (critical)

- `EyedropperPoint.swatchSide` after `assignSwatchLayout` is always one of `"left"|"right"|"top"|"bottom"` (never `"auto"`)
- `EyedropperPoint.swatchOrder` is the pixel position along the edge: **Y** for left/right, **X** for top/bottom
- Swatch renders at:
  - left:   `{ x: swatchRadius, y: swatchOrder }`
  - right:  `{ x: canvasWidth - swatchRadius, y: swatchOrder }`
  - top:    `{ x: swatchOrder, y: swatchRadius }`
  - bottom: `{ x: swatchOrder, y: canvasHeight - swatchRadius }`
- Valid swatchOrder range: `[swatchRadius, edgeLength - swatchRadius]`
  where `edgeLength = canvasHeight` for left/right, `canvasWidth` for top/bottom
- During drag, Konva reports canvas-space `x`/`y` — same coordinate space as `swatchPos`

### `redistributeOnEdge` in `lib/swatch-layout.ts`

```typescript
type Side = "left" | "right" | "top" | "bottom"

export function redistributeOnEdge(
  points: EyedropperPoint[],
  side: Side,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): EyedropperPoint[] {
  const L = side === "left" || side === "right" ? canvasHeight : canvasWidth
  const onEdge = points.filter(p => p.swatchSide === side && p.swatchOrder !== null)
  // Sort by current visual position (swatchOrder), not marker coordinates
  const sorted = [...onEdge].sort((a, b) => a.swatchOrder! - b.swatchOrder!)
  const n = sorted.length
  const updated = new Map<string, EyedropperPoint>()
  sorted.forEach((p, i) => {
    updated.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
  })
  return points.map(p => updated.get(p.id) ?? p)
}
```

**Why `redistributeOnEdge` and NOT `assignSwatchLayout` on swatch drag end:**
`assignSwatchLayout` re-sorts by MARKER canvas coordinates, which would undo any manual swatch repositioning. `redistributeOnEdge` sorts by CURRENT `swatchOrder` (visual order), then re-spreads evenly — it "maintains their relative order" per AC3 while guaranteeing minimum spacing.

**Note:** When a marker is later dragged (calling `assignSwatchLayout`), it will re-sort all swatches by marker positions, overriding manual swatch positions. This is expected and correct.

### `handleSwatchDragMove` and `handleSwatchDragEnd` in EditorShell

First, add a style ref so callbacks are stable:

```typescript
const styleRef = useRef<Style>(style) // style never changes (no setter), ref is for consistency
```

```typescript
const handleSwatchDragMove = useCallback(
  (id: string, canvasX: number, canvasY: number) => {
    const layout = canvasLayoutRef.current
    if (!layout) return
    const r = styleRef.current.swatchRadius
    setPoints((prev) => {
      const p = prev.find((pt) => pt.id === id)
      if (!p || p.swatchOrder === null) return prev
      const side = p.swatchSide as "left" | "right" | "top" | "bottom"
      const isVertical = side === "left" || side === "right"
      const edgeLength = isVertical ? layout.canvasHeight : layout.canvasWidth
      const raw = isVertical ? canvasY : canvasX
      const newOrder = Math.max(r, Math.min(edgeLength - r, Math.round(raw)))
      return prev.map((pt) => pt.id === id ? { ...pt, swatchOrder: newOrder } : pt)
    })
  },
  []
)

const handleSwatchDragEnd = useCallback(
  (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
    const layout = canvasLayoutRef.current
    if (!layout) return { x: canvasX, y: canvasY }
    const r = styleRef.current.swatchRadius
    let finalCanvasX = canvasX
    let finalCanvasY = canvasY
    setPoints((prev) => {
      const p = prev.find((pt) => pt.id === id)
      if (!p || p.swatchOrder === null) return prev
      const side = p.swatchSide as "left" | "right" | "top" | "bottom"
      const isVertical = side === "left" || side === "right"
      const edgeLength = isVertical ? layout.canvasHeight : layout.canvasWidth
      const raw = isVertical ? canvasY : canvasX
      const newOrder = Math.max(r, Math.min(edgeLength - r, Math.round(raw)))
      // Update the moved point's swatchOrder first, then redistribute
      const withMoved = prev.map((pt) => pt.id === id ? { ...pt, swatchOrder: newOrder } : pt)
      const redistributed = redistributeOnEdge(
        withMoved, side, layout.canvasWidth, layout.canvasHeight, r
      )
      // Compute the final canvas position for snap-back
      const final = redistributed.find((pt) => pt.id === id)!
      if (isVertical) {
        finalCanvasX = side === "left" ? r : layout.canvasWidth - r
        finalCanvasY = final.swatchOrder!
      } else {
        finalCanvasX = final.swatchOrder!
        finalCanvasY = side === "top" ? r : layout.canvasHeight - r
      }
      return redistributed
    })
    return { x: finalCanvasX, y: finalCanvasY }
  },
  []
)
```

**Caveat on `setPoints` + return**: `setPoints` with a functional updater is asynchronous. The `finalCanvasX`/`finalCanvasY` variables are set inside the updater using closure mutation — this works in practice because the updater runs synchronously before `setPoints` returns in React 18 batching, but is technically relying on a synchronous-by-convention detail. An alternative is to compute position outside of `setPoints` and call it separately (see alternative below).

**Alternative — compute then set** (cleaner, avoids the closure-mutation pattern):

```typescript
const handleSwatchDragEnd = useCallback(
  (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
    const layout = canvasLayoutRef.current
    if (!layout) return { x: canvasX, y: canvasY }
    const r = styleRef.current.swatchRadius

    // Read current points from a ref to avoid state closure
    // ⚠️ Requires adding a pointsRef (see below)
    const current = pointsRef.current
    const p = current.find((pt) => pt.id === id)
    if (!p || p.swatchOrder === null) return { x: canvasX, y: canvasY }

    const side = p.swatchSide as "left" | "right" | "top" | "bottom"
    const isVertical = side === "left" || side === "right"
    const edgeLength = isVertical ? layout.canvasHeight : layout.canvasWidth
    const raw = isVertical ? canvasY : canvasX
    const newOrder = Math.max(r, Math.min(edgeLength - r, Math.round(raw)))
    const withMoved = current.map((pt) => pt.id === id ? { ...pt, swatchOrder: newOrder } : pt)
    const redistributed = redistributeOnEdge(
      withMoved, side, layout.canvasWidth, layout.canvasHeight, r
    )

    setPoints(redistributed)

    const final = redistributed.find((pt) => pt.id === id)!
    return {
      x: isVertical ? (side === "left" ? r : layout.canvasWidth - r) : final.swatchOrder!,
      y: isVertical ? final.swatchOrder! : (side === "top" ? r : layout.canvasHeight - r),
    }
  },
  []
)
```

This second approach requires mirroring `points` into a `pointsRef` (add `const pointsRef = useRef<EyedropperPoint[]>([]); useEffect(() => { pointsRef.current = points }, [points])`). **Use the second approach** — it's cleaner and follows the same ref-based pattern already established for `canvasLayoutRef` and `imageHeightRef`.

Add near the other refs:
```typescript
const pointsRef = useRef<EyedropperPoint[]>([])
```

Add a sync effect after the points state declaration:
```typescript
useEffect(() => {
  pointsRef.current = points
}, [points])
```

### `dragBoundFunc` in `EyedropperLayer.tsx`

Add to the swatch `Circle` when `interactionMode === "select"`:

```typescript
dragBoundFunc={(pos) => {
  const r = style.swatchRadius
  if (p.swatchSide === "left")   return { x: r,                   y: Math.max(r, Math.min(canvasHeight - r, pos.y)) }
  if (p.swatchSide === "right")  return { x: canvasWidth - r,     y: Math.max(r, Math.min(canvasHeight - r, pos.y)) }
  if (p.swatchSide === "top")    return { x: Math.max(r, Math.min(canvasWidth - r, pos.x)), y: r }
  if (p.swatchSide === "bottom") return { x: Math.max(r, Math.min(canvasWidth - r, pos.x)), y: canvasHeight - r }
  return pos
}}
```

Note: `dragBoundFunc` receives and returns canvas-space coordinates. `r = style.swatchRadius` is read from the prop, which is available in EyedropperLayer.

### Full swatch Circle in EyedropperLayer

```tsx
<Circle
  x={swatchPos.x}
  y={swatchPos.y}
  radius={style.swatchRadius}
  fill={p.color}
  stroke={style.swatchBorderColor}
  strokeWidth={style.swatchBorderWidth}
  draggable={interactionMode === "select"}
  {...(interactionMode === "select" && {
    dragBoundFunc: (pos) => {
      const r = style.swatchRadius
      if (p.swatchSide === "left")   return { x: r,               y: Math.max(r, Math.min(canvasHeight - r, pos.y)) }
      if (p.swatchSide === "right")  return { x: canvasWidth - r, y: Math.max(r, Math.min(canvasHeight - r, pos.y)) }
      if (p.swatchSide === "top")    return { x: Math.max(r, Math.min(canvasWidth - r, pos.x)), y: r }
      if (p.swatchSide === "bottom") return { x: Math.max(r, Math.min(canvasWidth - r, pos.x)), y: canvasHeight - r }
      return pos
    },
    onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
      const c = e.target.getStage()?.container()
      if (c) c.style.cursor = "grab"
    },
    onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
      const c = e.target.getStage()?.container()
      if (c) c.style.cursor = "default"
    },
    onDragMove: (e: KonvaEventObject<DragEvent>) => {
      onSwatchDragMove(p.id, e.target.x(), e.target.y())
    },
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      const snapped = onSwatchDragEnd(p.id, e.target.x(), e.target.y())
      e.target.x(snapped.x)
      e.target.y(snapped.y)
    },
  })}
/>
```

### Updated `EyedropperLayer` Props Interface

```typescript
interface Props {
  points: EyedropperPoint[]
  imageOffsetY: number
  canvasWidth: number
  canvasHeight: number
  style: Style
  interactionMode: "select" | "add"
  onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
  onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
  onSwatchDragMove: (id: string, canvasX: number, canvasY: number) => void
  onSwatchDragEnd: (id: string, canvasX: number, canvasY: number) => { x: number; y: number }
}
```

### Test Updates for `EyedropperLayer.test.tsx`

The existing Circle mock (see story 2.4) fires `onDragMove` via `mouseDown` and `onDragEnd` via `mouseUp` on ANY circle. Currently tests distinguish ring marker (last circle) from swatch (first circle) by index.

For swatch drag tests, use the **first** circle in the group (`circles[0]`). For ring marker tests, use the **last** circle (`circles[circles.length - 1]`). This convention already exists in the test file.

Update `DEFAULT_PROPS` to include the new props:
```typescript
const DEFAULT_PROPS = {
  ...existing props...,
  onSwatchDragMove: vi.fn(),
  onSwatchDragEnd: vi.fn(() => ({ x: 0, y: 0 })),
}
```

The mock's `lastSetPos` shared object already records snap-back positions — it records the LAST `e.target.x(v)` / `e.target.y(v)` call in any drag end, which may be from swatch or ring. For the snap-back test, reset `lastSetPos` before each test.

### Unit Tests for `redistributeOnEdge`

Add to `lib/swatch-layout.test.ts`:

```typescript
import { redistributeOnEdge } from "./swatch-layout"

describe("redistributeOnEdge", () => {
  const canvasWidth = 400, canvasHeight = 800, swatchRadius = 20

  it("redistributes 2 swatches on left edge evenly", () => {
    const points = [
      makePoint("a", "left", 600),   // near bottom
      makePoint("b", "left", 100),   // near top
    ]
    const result = redistributeOnEdge(points, "left", canvasWidth, canvasHeight, swatchRadius)
    // sorted by swatchOrder: b(100), a(600) → indices 0, 1 of 2
    // L=800, n=2: positions = 800*1/3=267, 800*2/3=533
    const b = result.find(p => p.id === "b")!
    const a = result.find(p => p.id === "a")!
    expect(b.swatchOrder).toBe(Math.round(800 / 3))
    expect(a.swatchOrder).toBe(Math.round(800 * 2 / 3))
  })

  it("does not modify points on other edges", () => {
    const points = [
      makePoint("a", "left", 400),
      makePoint("b", "right", 400),
    ]
    const result = redistributeOnEdge(points, "left", canvasWidth, canvasHeight, swatchRadius)
    const b = result.find(p => p.id === "b")!
    expect(b.swatchOrder).toBe(400)  // unchanged
  })

  it("single swatch on edge → centered", () => {
    const points = [makePoint("a", "top", 100)]
    const result = redistributeOnEdge(points, "top", canvasWidth, canvasHeight, swatchRadius)
    expect(result[0].swatchOrder).toBe(Math.round(400 / 2))  // 200
  })
})
```

(`makePoint` helper for swatch-layout tests already exists in that file; adapt as needed.)

### Import to add in `components/Editor/index.tsx`

```typescript
import { assignSwatchLayout, redistributeOnEdge } from "@/lib/swatch-layout"
```

### Regression Guard

- The existing `useEffect` that calls `assignSwatchLayout` on `canvasLayout` change must NOT be removed.
- `handleMarkerDragEnd` still calls `assignSwatchLayout` (not `redistributeOnEdge`) — this is correct and intentional: marker drag recomputes full layout from marker positions.
- The new `handleSwatchDragEnd` calls `redistributeOnEdge` — this is intentional: swatch drag preserves the manually-set visual order.
- After a swatch drag, if the user then drags a marker, `assignSwatchLayout` runs and re-sorts by marker positions — this is correct and expected.

### Deferred Items (still deferred)

- `pointIdCounter` at module scope — deferred to Story 2.6
- No AbortController on `runSuggest` — deferred
- Ring marker `fill={undefined}` narrow hit area — deferred
- `null-swatchOrder` null rendering guard — still relevant for Story 2.6 (add-point)

### Current Test Baseline

117 tests passing. New tests this story: ~9 (5 component + ~4 unit for `redistributeOnEdge`).

### Tailwind v4 Reminder

No `tailwind.config.ts`. Use `bg-[var(--color-accent)]` pattern. No changes to CSS expected for this story.

## Review Findings

_Code review 2026-06-14 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). 3 patch, 2 deferred, 5 dismissed as noise. (1 decision-needed resolved 2026-06-15 → patch: redistribute-only-on-overlap.)_

- [x] [Review][Patch] Drag-end should redistribute ONLY when the drop overlaps a neighbor; otherwise preserve the dropped position [components/Editor/index.tsx:279-308; lib/swatch-layout.ts] — FIXED 2026-06-15: added pure `placeSwatchOnEdge(points, id, side, w, h, r)` to `lib/swatch-layout.ts` — keeps the clamped dropped `swatchOrder` unless another swatch on the same edge is within `2*swatchRadius` (then redistributes via `redistributeOnEdge`, preserving order). `handleSwatchDragEnd` now calls it instead of unconditional `redistributeOnEdge`. (Resolved from decision-needed per Miguel: redistribute-only-on-overlap, aligning AC1 fine-tune + AC3 "would overlap".)

- [x] [Review][Patch] `dragBoundFunc` clamps absolute coords against canvas-space bounds — edge constraint is wrong-space whenever the Stage is scaled (always, scale≈0.3) [components/Editor/EyedropperLayer.tsx:105-117] — FIXED 2026-06-15: VERIFIED against Konva 10.3.0 (`Node.js:1363 _setDragPosition` → `dragBoundFunc` gets ABSOLUTE pos, result applied via `setAbsolutePosition`). Converted to a non-arrow `function`, read `const s = this.getStage()?.scaleX() ?? 1`, and scaled bounds (`r*s`, `canvasWidth*s`, `canvasHeight*s`) into absolute space so the swatch stays flush to its edge live during the drag.

- [x] [Review][Patch] No test exercises the real swatch coordinate logic [components/Editor/index.tsx:260-308] — FIXED 2026-06-15: added 4 unit tests for `placeSwatchOnEdge` (keep-position / redistribute-on-overlap / other-edge-ignored / single-swatch) in `lib/swatch-layout.test.ts`, and a `dragBoundFunc` absolute-space test in `EyedropperLayer.test.tsx` (invokes the captured bound fn against a scaled fake stage, asserts `x === r*scale`) — directly guards the coordinate-space fix. 130 tests pass (was 125). Note: the clamp/snap math still living inline in EditorShell handlers is not directly unit-tested (handlers are not exported); the testable core was extracted to `placeSwatchOnEdge`.

- [x] [Review][Patch] `Canvas.test.tsx` `makeProps` missing the new required `onSwatchDrag*` props — `tsc`/CI break (runtime tests passed since vitest skips typecheck) [components/Editor/Canvas.test.tsx:49-64] — FIXED 2026-06-15: collateral from story 2.5 adding required props to `Canvas` without updating its test (file not in story File List). Added `onSwatchDragMove`/`onSwatchDragEnd` stubs. `tsc --noEmit` now clean.

- [x] [Review][Defer] `redistributeOnEdge` accepts `swatchRadius` but never uses it; even spacing doesn't guarantee ≥2r when many swatches share one edge (overlap at ~20/edge at full canvas res) [lib/swatch-layout.ts:64,71-73] — deferred, spec-conformant (spec reference code also omits it; matches existing `assignSwatchLayout`). Revisit if true min-spacing is wanted (relates to the Decision above).

- [x] [Review][Defer] `Math.max(r, Math.min(edgeLength-r, …))` inverts when `edgeLength < 2r` (degenerate tiny canvas) [index.tsx:272,293] — deferred, pre-existing/theoretical; real uploads on a desktop-only editor won't produce sub-96px edges.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `redistributeOnEdge` export to `lib/swatch-layout.ts` — sorts by current `swatchOrder` (visual order), redistributes evenly using `L*(i+1)/(n+1)` formula
- Added `styleRef`, `pointsRef`, and `pointsRef` sync effect to `EditorShell`; used ref-read pattern in `handleSwatchDragEnd` (same approach as `canvasLayoutRef`) to avoid stale closure
- `handleSwatchDragMove` clamps along-edge coordinate and updates `swatchOrder` live via `setPoints` functional updater
- `handleSwatchDragEnd` reads from `pointsRef`, calls `redistributeOnEdge`, calls `setPoints` once, returns snapped canvas position
- Swatch `Circle` in `EyedropperLayer` made draggable in select mode with `dragBoundFunc` constraining to assigned edge, cursor handlers (grab/default), `onDragMove`/`onDragEnd` wired to props
- 8 new tests added (5 component + 4 unit); 125 total (baseline 117)

### File List

- `eyedropper-web/lib/swatch-layout.ts`
- `eyedropper-web/lib/swatch-layout.test.ts`
- `eyedropper-web/components/Editor/index.tsx`
- `eyedropper-web/components/Editor/Canvas.tsx`
- `eyedropper-web/components/Editor/EyedropperLayer.tsx`
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx`
- `eyedropper-web/components/Editor/Canvas.test.tsx` (review fix: missing required props)

## Change Log

- 2026-06-14: Implemented Story 2.5 — swatch drag along edge. Added `redistributeOnEdge` to `lib/swatch-layout.ts`; wired `handleSwatchDragMove`/`handleSwatchDragEnd` in `EditorShell`; threaded props through `Canvas`; made swatch `Circle` draggable in `EyedropperLayer` with `dragBoundFunc` edge constraint. 8 new tests, 125 total.
- 2026-06-15: Code review (3 layers) + fixes. Resolved decision → redistribute-only-on-overlap (`placeSwatchOnEdge`); fixed `dragBoundFunc` coordinate-space bug (scale bounds by stage scale, verified vs Konva 10.3.0); added `placeSwatchOnEdge` unit tests + `dragBoundFunc` absolute-space test; fixed `Canvas.test.tsx` tsc break. 130 tests pass, tsc + lint clean. Status → done.
