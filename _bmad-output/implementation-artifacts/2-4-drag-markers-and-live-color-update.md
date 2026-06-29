# Story 2.4: Drag Markers & Live Color Update

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want to drag a ring marker to a new position on the image,
so that I can precisely choose which pixel area a swatch represents.

## Acceptance Criteria

1. **Given** I am in Select/drag mode **when** I hover over a ring marker **then** the cursor changes to `move`.

2. **Given** I drag a ring marker to a new position **when** the drag updates **then** the marker moves to the new position, `color-sample.ts` re-samples the color at the new coordinates, and the connected swatch fill color updates live during the drag.

3. **Given** I drag a marker to a new position **when** the drag ends **then** `swatch-layout.ts` is re-run to recalculate all swatch edge assignments and positions, maintaining the no-crossing guarantee.

4. **Given** I drag a marker outside the image bounds **when** the drag ends **then** the marker snaps back to the nearest valid point within the image area.

## Tasks / Subtasks

- [x] Task 1: Add `interactionMode` state and Tools section buttons in `EditorShell` (`components/Editor/index.tsx`) (AC: 1, 2, 3, 4)
  - [x] Add `import { clampToImage } from "@/lib/drag-utils"` at the top (create the file first — see `lib/drag-utils.ts` in Dev Notes)
  - [x] Add `const imageHeightRef = useRef<number>(0)` near the other refs
  - [x] In image load `useEffect`, add `imageHeightRef.current = image.naturalHeight` alongside the existing `setImageHeight(image.naturalHeight)` call
  - [x] Add `const [interactionMode, setInteractionMode] = useState<"select" | "add">("select")` after the `style` state line
  - [x] Replace the "Coming soon" placeholder in the Tools section with two mode-toggle buttons: "↖ Select/drag" (default) and "○ Add point"
  - [x] Apply active-state styling to the active mode button (filled accent background) vs inactive (white background with border hover)
  - [x] Add `handleMarkerDragMove` callback (see Dev Notes for full implementation)
  - [x] Add `handleMarkerDragEnd` callback (see Dev Notes for full implementation)
  - [x] Pass `interactionMode`, `onMarkerDragMove`, `onMarkerDragEnd` to `<Canvas>`

- [x] Task 2: Thread new props through `Canvas.tsx` to `EyedropperLayer` (AC: 1, 2, 3, 4)
  - [x] Add `interactionMode: "select" | "add"`, `onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void`, `onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => void` to `CanvasProps`
  - [x] Pass all three new props through to `<EyedropperLayer>`

- [x] Task 3: Make ring markers draggable in `EyedropperLayer.tsx` (AC: 1, 2, 3, 4)
  - [x] Add `interactionMode`, `onMarkerDragMove`, `onMarkerDragEnd` to the `Props` interface
  - [x] Set `draggable={interactionMode === "select"}` on the ring marker `Circle` (the second circle, after the swatch)
  - [x] Add `onMouseEnter` / `onMouseLeave` cursor handlers to the ring marker `Circle` (see Dev Notes for pattern)
  - [x] Add `onDragMove` handler: reads `e.target.x()` / `e.target.y()` (canvas coords) and calls `onMarkerDragMove(p.id, e.target.x(), e.target.y())` (see Dev Notes for re-sampling and live update)
  - [x] Add `onDragEnd` handler: reads final position, calls `onMarkerDragEnd(p.id, e.target.x(), e.target.y())` then resets Konva position to match state (`e.target.x(newX); e.target.y(newY)` where `newX`/`newY` are from the updated point — see Dev Notes)

- [x] Task 4: Write tests (AC: all)
  - [x] Update `components/Editor/EyedropperLayer.test.tsx` — extend the `Circle` mock to capture drag props (see Dev Notes for mock pattern)
  - [x] New test: ring marker has `data-draggable="true"` in select mode
  - [x] New test: ring marker has `data-draggable="false"` in add mode
  - [x] New test: `onDragMove` on ring marker calls `onMarkerDragMove` with `(id, x, y)`
  - [x] New test: `onDragEnd` on ring marker calls `onMarkerDragEnd` with `(id, x, y)`
  - [x] New test: swatch `Circle` is never draggable (it doesn't have `draggable` prop)
  - [x] Unit tests for clamping logic in `handleMarkerDragEnd` (export a pure `clampToImage(x, y, canvasWidth, imageHeight)` helper from `lib/drag-utils.ts` and test it there — see Dev Notes)
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 102 tests)

### Review Findings

_Code review 2026-06-14 — 3 adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 4 ACs functionally implemented; no Critical/High correctness defects confirmed. 1 decision, 3 patches, 2 deferred, 9 dismissed (incl. 2 Blind-Hunter false positives refuted by source: `canvasWidth = imageWidth` and `sampleColor`'s internal `[4, dim-4]` clamp)._

- [x] [Review][Patch] Live drag-move samples & stores UNCLAMPED coords — FIXED: `handleMarkerDragMove` now applies `clampToImage` (position + color) to match dragEnd, so the marker can't roam the padding and the live swatch always reflects a real in-image pixel [components/Editor/index.tsx:205-218]
- [x] [Review][Patch] dragEnd resets Konva node to STALE pre-drag closure position — FIXED: `handleMarkerDragEnd` now returns the clamped canvas-space position and `onDragEnd` writes that back onto the node (`e.target.x(snapped.x)`), eliminating the one-frame backwards jump [components/Editor/index.tsx:219, EyedropperLayer.tsx:123-129]
- [x] [Review][Patch] Snap-back setter path has zero test coverage — FIXED: Circle mock now records `e.target.x(v)/y(v)` setter calls into `lastSetPos`; new test asserts the node snaps to the returned clamped position [components/Editor/EyedropperLayer.test.tsx]
- [x] [Review][Patch] AC-bearing logic undertested — PARTIAL: added AC1 cursor-toggle test (hover → "move", leave → "default") and select-vs-add hover-handler-attachment test in EyedropperLayer, plus an exact-boundary `clampToImage` test. `handleMarkerDragEnd`'s internal offset-subtraction + `assignSwatchLayout` re-run (AC3) remain covered only indirectly via the tested helpers (clampToImage, sampleColor, assignSwatchLayout) — a full EditorShell render test was judged too brittle for the marginal coverage [components/Editor/EyedropperLayer.test.tsx, lib/drag-utils.test.ts]
- [x] [Review][Defer] null-`swatchOrder` points render nothing, so they have no draggable marker — latent trap for the Story 2.6 add-point tool if it creates points before running `assignSwatchLayout` [components/Editor/EyedropperLayer.tsx:63] — deferred, not triggered by this change
- [x] [Review][Defer] Ring marker `fill={undefined}` makes only the 2px stroke annulus hittable — clicking the marker's empty center won't grab it; consider `hitStrokeWidth` [components/Editor/EyedropperLayer.tsx:107] — deferred, minor UX polish

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Files to MODIFY

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/Editor/index.tsx` | No interaction mode; Tools section shows "Coming soon" | Add `interactionMode` state, `handleMarkerDragMove`, `handleMarkerDragEnd`, Tools buttons, thread props to Canvas |
| `components/Editor/Canvas.tsx` | Passes `points`, layout props, `style` to EyedropperLayer | Also pass `interactionMode`, `onMarkerDragMove`, `onMarkerDragEnd` |
| `components/Editor/EyedropperLayer.tsx` | Ring markers rendered statically, no drag | Ring markers draggable in select mode, cursor/drag handlers |
| `components/Editor/EyedropperLayer.test.tsx` | 7 tests; Circle mock has `onMouseEnter`/`onMouseLeave` not captured | Extend mock to capture drag props; add 5 new tests |

### Files to CREATE

| File | Purpose |
|------|---------|
| `lib/drag-utils.ts` | Pure `clampToImage` helper — testable without Konva |
| `lib/drag-utils.test.ts` | Unit tests for `clampToImage` |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint` is correct as-is; no `isDragging` field needed
- `lib/color-sample.ts` — already fully implemented
- `lib/swatch-layout.ts` — already fully implemented; Story 2.4 just calls it again on dragEnd
- `app/` routes — no server changes
- `app/editor/page.tsx` — no changes

---

### `lib/drag-utils.ts` — pure helper

Extract the bounds clamping into a pure function so it can be tested without Konva:

```typescript
export function clampToImage(
  imageX: number,
  imageY: number,
  canvasWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(canvasWidth, imageX)),
    y: Math.max(0, Math.min(imageHeight, imageY)),
  }
}
```

### `handleMarkerDragMove` in EditorShell

```typescript
const handleMarkerDragMove = useCallback(
  (id: string, canvasX: number, canvasY: number) => {
    if (!hiddenCanvasCtxRef.current || !canvasLayoutRef.current) return
    const { imageOffsetY } = canvasLayoutRef.current
    const imageX = canvasX
    const imageY = canvasY - imageOffsetY
    const newColor = sampleColor(hiddenCanvasCtxRef.current, imageX, imageY)
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x: imageX, y: imageY, color: newColor } : p))
    )
  },
  [] // no deps — reads everything via refs
)
```

**Why refs only:** `canvasLayoutRef` and `hiddenCanvasCtxRef` are already ref-mirrored from state to avoid stale closures. Using no deps keeps `handleMarkerDragMove` stable across renders — important because it's passed as a prop and a new reference would re-render EyedropperLayer on every point state update (i.e., on every drag frame). Same applies to `handleMarkerDragEnd`.

### `handleMarkerDragEnd` in EditorShell

```typescript
const imageHeightRef = useRef<number>(0)
// Keep ref in sync with state (add this line alongside the existing imageHeight setter):
// setImageHeight(n) → imageHeightRef.current = n
// OR: keep imageHeight in a ref and also in state for re-renders:
```

Actually, to keep `handleMarkerDragEnd` dependency-free, mirror `imageHeight` into a ref too:

```typescript
const imageHeightRef = useRef<number>(0)
```

In the image load `useEffect`, replace `setImageHeight(image.naturalHeight)` with:
```typescript
imageHeightRef.current = image.naturalHeight
setImageHeight(image.naturalHeight)
```

Then:

```typescript
const handleMarkerDragEnd = useCallback(
  (id: string, canvasX: number, canvasY: number) => {
    const layout = canvasLayoutRef.current
    if (!layout) return
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
  },
  [] // no deps — reads everything via refs
)
```

### Snapping Konva position back after dragEnd

When `clampToImage` changes the position (snap), you must also update the Konva node's position so the ring marker visually snaps to the clamped coords. In EyedropperLayer's `onDragEnd`:

```typescript
onDragEnd={(e) => {
  const cX = e.target.x()
  const cY = e.target.y()
  onMarkerDragEnd(p.id, cX, cY)
  // Konva position will be reconciled on next React render via x/y props,
  // but force it synchronously to avoid a frame of the marker at the drag position:
  e.target.x(p.x)          // will be overwritten by state update
  e.target.y(p.y + imageOffsetY)
}}
```

**Important:** After `onMarkerDragEnd` calls `setPoints`, React re-renders and Konva reconciles `x`/`y` props on the `Circle`. The `e.target.x(p.x)` line is just for immediate visual snap before the next render. Use the `p.x` / `p.y + imageOffsetY` from closure (pre-drag values) — the real clamped position comes through state.

### Cursor handler pattern for Konva

```typescript
onMouseEnter={(e) => {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = "move"
}}
onMouseLeave={(e) => {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = "default"
}}
```

These handlers should only be on the ring marker Circle. Only set them when `interactionMode === "select"` (otherwise cursor change on hover would confuse add mode). Use conditional spread:

```typescript
...(interactionMode === "select" && {
  onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => { /* cursor = move */ },
  onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => { /* cursor = default */ },
})
```

### Full ring marker Circle in EyedropperLayer

```tsx
{style.markerStyle !== "none" && (
  <Circle
    x={markerX}
    y={markerY}
    radius={12}
    fill={undefined}
    stroke={style.markerColor}
    strokeWidth={2}
    draggable={interactionMode === "select"}
    {...(interactionMode === "select" && {
      onMouseEnter: (e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = "move"
      },
      onMouseLeave: (e) => {
        const c = e.target.getStage()?.container()
        if (c) c.style.cursor = "default"
      },
      onDragMove: (e) => onMarkerDragMove(p.id, e.target.x(), e.target.y()),
      onDragEnd: (e) => {
        const cX = e.target.x()
        const cY = e.target.y()
        onMarkerDragEnd(p.id, cX, cY)
        e.target.x(p.x)
        e.target.y(p.y + imageOffsetY)
      },
    })}
  />
)}
```

### Tools section UI in EditorShell

```tsx
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
```

Note: "Add point" mode button is shown and togglable in this story — but clicking the canvas in add mode does nothing yet (Story 2.6 wires that up). It's fine to show the toggle now; UX is coherent because select mode is default and add mode just disables dragging.

### Updated EyedropperLayer Props interface

```typescript
interface Props {
  points: EyedropperPoint[]
  imageOffsetY: number
  canvasWidth: number
  canvasHeight: number
  style: Style
  interactionMode: "select" | "add"
  onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
  onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => void
}
```

### Updated Canvas CanvasProps interface

Add to existing `CanvasProps` (import not needed — already imported Style, EyedropperPoint):

```typescript
interactionMode: "select" | "add"
onMarkerDragMove: (id: string, canvasX: number, canvasY: number) => void
onMarkerDragEnd: (id: string, canvasX: number, canvasY: number) => void
```

Pass all three to `<EyedropperLayer>`.

### Coordinate system recap (critical for correctness)

- `EyedropperPoint.x` = image-space X = canvas-space X (no horizontal offset)
- `EyedropperPoint.y` = image-space Y (add `imageOffsetY` to get canvas-space Y)
- Ring marker renders at `(p.x, p.y + imageOffsetY)` in canvas space
- On drag: Konva reports `e.target.x()` / `e.target.y()` in canvas space
- Convert back: `imageX = canvasX`, `imageY = canvasY - imageOffsetY`
- Clamp image-space coords to `[0, canvasWidth] × [0, imageHeight]` before storing
- Hidden canvas sampling: call `sampleColor(ctx, imageX, imageY)` — **no offset** (sampling from image pixels, not canvas)

### Test mock update for EyedropperLayer.test.tsx

Update the `Circle` mock to expose drag props as data attributes and as callable functions via a captured ref map:

```typescript
// At the top of the test file, before vi.mock:
const circleHandlers = new Map<string, {
  onDragMove?: (e: { target: { x: () => number; y: () => number } }) => void
  onDragEnd?: (e: { target: { x: () => number; y: () => number; x: (v: number) => void; y: (v: number) => void } }) => void
}>()

vi.mock("react-konva", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-konva")>()
  return {
    ...actual,
    Layer: ({ children }: { children?: React.ReactNode }) => <div data-testid="layer">{children}</div>,
    Group: ({ children }: { children?: React.ReactNode }) => <div data-testid="group">{children}</div>,
    Circle: ({
      x, y, fill, stroke, draggable,
      onDragMove, onDragEnd,
      "data-handler-key": handlerKey,
      ...rest
    }: {
      x: number; y: number; fill?: string; stroke?: string
      draggable?: boolean
      onDragMove?: Function; onDragEnd?: Function
      "data-handler-key"?: string
    }) => {
      if (handlerKey && (onDragMove || onDragEnd)) {
        circleHandlers.set(handlerKey, { onDragMove, onDragEnd })
      }
      return (
        <div
          data-testid="circle"
          data-x={x} data-y={y} data-fill={fill} data-stroke={stroke}
          data-draggable={String(!!draggable)}
        />
      )
    },
    Line: ({ points, stroke }: { points: number[]; stroke?: string }) => (
      <div data-testid="line" data-points={JSON.stringify(points)} data-stroke={stroke} />
    ),
  }
})
```

Then pass `data-handler-key={p.id}` on the ring marker Circle in `EyedropperLayer.tsx` (only in the real component, not mock — actually this approach is fragile). 

**Simpler alternative test approach:** Don't test drag callbacks through Konva event simulation. Instead:

1. **EyedropperLayer drag-prop tests**: pass spy functions as `onMarkerDragMove` and `onMarkerDragEnd` props; update the Circle mock to immediately invoke `onDragMove`/`onDragEnd` on render if provided; assert the spy was called with correct shape.

```typescript
// In test:
Circle: ({ x, y, fill, stroke, draggable, onDragMove, onDragEnd, onMouseEnter, onMouseLeave }) => {
  // Immediately invoke drag handlers if present (allows synchronous testing)
  // Expose via data attrs for assertion
  return (
    <div
      data-testid="circle"
      data-x={x} data-y={y} data-fill={fill} data-stroke={stroke}
      data-draggable={draggable === true ? "true" : "false"}
      onMouseDown={() => {
        onDragMove?.({ target: { x: () => x + 10, y: () => y + 10 } })
      }}
      onMouseUp={() => {
        const target = { 
          x: (v?: number) => v !== undefined ? undefined : x + 10,
          y: (v?: number) => v !== undefined ? undefined : y + 10,
        }
        onDragEnd?.({ target })
      }}
    />
  )
}
```

Then use `fireEvent.mouseDown` / `fireEvent.mouseUp` on the ring marker div to trigger the drag handlers.

### `lib/drag-utils.test.ts` — unit tests for `clampToImage`

```typescript
import { describe, it, expect } from "vitest"
import { clampToImage } from "./drag-utils"

describe("clampToImage", () => {
  it("returns same coords when within bounds", () => {
    expect(clampToImage(100, 200, 400, 600)).toEqual({ x: 100, y: 200 })
  })
  it("clamps x to 0 when negative", () => {
    expect(clampToImage(-10, 200, 400, 600)).toEqual({ x: 0, y: 200 })
  })
  it("clamps x to canvasWidth at right edge", () => {
    expect(clampToImage(500, 200, 400, 600)).toEqual({ x: 400, y: 200 })
  })
  it("clamps y to 0 when negative", () => {
    expect(clampToImage(100, -5, 400, 600)).toEqual({ x: 100, y: 0 })
  })
  it("clamps y to imageHeight at bottom", () => {
    expect(clampToImage(100, 700, 400, 600)).toEqual({ x: 100, y: 600 })
  })
  it("clamps corner (negative x and y)", () => {
    expect(clampToImage(-10, -10, 400, 600)).toEqual({ x: 0, y: 0 })
  })
})
```

### Regression guard: layout-on-canvasLayout effect still applies

The existing `useEffect` in `EditorShell` that calls `assignSwatchLayout` when `canvasLayout` changes (added in Story 2.3 review) must NOT be removed. It is still needed for initial layout after image load.

### Deferred items from earlier stories (still deferred)

- `pointIdCounter` at module scope (2.2 review) — still no issue for drag; defer to Story 2.6+ when add-point creates new points
- No AbortController on `runSuggest` — drag does not trigger API calls; still deferred

### Current test baseline

102 tests passing (from Story 2.3 completion). New tests this story: ~10.

### Tailwind v4 reminder

No `tailwind.config.ts`. Use `bg-[var(--color-accent)]`, `text-white`, `border-[var(--color-accent)]`, etc.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward. One TS error pass was needed: Canvas.test.tsx `makeProps` helper had to be updated with the three new required props (`interactionMode`, `onMarkerDragMove`, `onMarkerDragEnd`).

### Completion Notes List

- Created `lib/drag-utils.ts` with pure `clampToImage` helper (tested in isolation)
- Added `interactionMode` state ("select" | "add") and `imageHeightRef` to `EditorShell`
- Replaced "Coming soon" Tools section with two mode-toggle buttons with active-state Tailwind styling
- Implemented `handleMarkerDragMove` and `handleMarkerDragEnd` as stable `useCallback` with no deps (reads all mutable values via refs)
- Threaded `interactionMode`, `onMarkerDragMove`, `onMarkerDragEnd` through `Canvas.tsx` → `EyedropperLayer.tsx`
- Ring markers in `EyedropperLayer` are now `draggable={interactionMode === "select"}` with cursor, dragMove, and dragEnd handlers spread conditionally (only in select mode)
- `onDragEnd` synchronously resets Konva node position to pre-drag coords for immediate visual snap before React re-render
- 11 new tests: 6 unit tests for `clampToImage`, 5 component tests for drag behavior in `EyedropperLayer`
- All 113 tests pass (102 baseline + 11 new), TypeScript clean

### File List

- `lib/drag-utils.ts` (created)
- `lib/drag-utils.test.ts` (created)
- `components/Editor/index.tsx` (modified)
- `components/Editor/Canvas.tsx` (modified)
- `components/Editor/EyedropperLayer.tsx` (modified)
- `components/Editor/EyedropperLayer.test.tsx` (modified)
- `components/Editor/Canvas.test.tsx` (modified)

## Change Log

- 2026-06-14: Implemented drag markers and live color update. Created `lib/drag-utils.ts` with pure `clampToImage`, added `interactionMode` state and mode-toggle Tools buttons to `EditorShell`, wired `handleMarkerDragMove` and `handleMarkerDragEnd` callbacks, threaded new props through `Canvas` to `EyedropperLayer`, made ring markers draggable in select mode with cursor + live color sampling. Added 11 new tests (6 unit + 5 component); all 113 tests pass.
