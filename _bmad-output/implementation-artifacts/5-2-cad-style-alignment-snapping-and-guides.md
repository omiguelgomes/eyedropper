---
baseline_commit: 560de0d94d02f14a50f4a6b11dce14ba696562f9
---

# Story 5.2: CAD-Style Alignment Snapping & Guides

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want swatches to snap into alignment with other swatches, the canvas, and their own markers while I drag them, with guide lines showing the alignment,
so that I can keep a freely-composed layout tidy and visually aligned without manual pixel-nudging.

## Acceptance Criteria

1. **Given** I am dragging a free-floating swatch **when** its center comes within a small pixel threshold of sharing an X or Y coordinate with another swatch's center **then** the swatch snaps to that shared coordinate, and a guide line is drawn through the aligned centers.

2. **Given** I am dragging a free-floating swatch **when** it reaches a position where the spacing between three or more swatches becomes equal **then** the swatch snaps to the equal-spacing position and a distribution guide is shown.

3. **Given** I am dragging a free-floating swatch **when** its center approaches a canvas edge or the horizontal/vertical centerline of the 9:16 frame **then** the swatch snaps to that edge/centerline and a guide line is shown.

4. **Given** I am dragging a free-floating swatch **when** its center aligns horizontally or vertically with its own marker on the image **then** the swatch snaps to that alignment and a guide line is shown.

5. **Given** a swatch has snapped to an alignment **when** I keep dragging past the snap threshold **then** the swatch pulls away freely (soft snap — no modifier key needed to escape).

6. **Given** I release a swatch after any snap **when** the drag ends **then** all guide lines disappear and the swatch stays at its final position; overlap-blocking from Story 5.1 still applies.

## Tasks / Subtasks

- [x] Task 1: Add the `computeSwatchSnap` pure helper to `lib/swatch-layout.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Define and export a `SnapGuide` type: `{ axis: "x" | "y"; pos: number }` (a full-canvas line at `x = pos` or `y = pos`).
  - [x] Implement `computeSwatchSnap(input)` returning `{ x, y, guides: SnapGuide[] }` (signature + algorithm in Dev Notes). It is given the dragged swatch's raw (already-clamped) canvas position, the rendered centers of all OTHER swatches, the dragged swatch's own marker canvas position, the canvas dimensions, and a `threshold` in canvas space. Snap the X and Y axes **independently** (a swatch can be X-snapped to one target and Y-snapped to another simultaneously).
  - [x] Snap priority per axis (highest first; first match within `threshold` wins, stop scanning that axis): (a) another swatch's center coord → AC1; (b) own marker coord → AC4; (c) canvas centerline (`canvasWidth/2` for X, `canvasHeight/2` for Y) and the swatch-clamped edges (`r` and `canvasWidth−r` for X, `r` and `canvasHeight−r` for Y) → AC3; (d) equal-spacing midpoint between the two nearest neighbours on that axis → AC2 (see Dev Notes for the exact triple rule).
  - [x] Soft snap (AC5): snapping is a pure function of the **raw** cursor position each frame — when the raw coord is within `threshold` of a target it returns the target coord; once the raw coord leaves the threshold band it returns the raw coord. No hysteresis, no modifier key, no sticky state.
  - [x] Emit one `SnapGuide` per axis that actually snapped (axis `"x"` guide for an X-snap, `"y"` for a Y-snap). No snap on an axis → no guide for that axis. Never emit duplicate guides for the same `(axis, pos)`.

- [x] Task 2: Apply live snapping in `handleSwatchDragMove` and surface guides (AC: 1, 2, 3, 4, 5)
  - [x] In `components/Editor/index.tsx`, add guide state: `const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])` and a `snapGuidesRef`-free read is fine (it's render state passed to Canvas). Import `computeSwatchSnap` and `SnapGuide` from `@/lib/swatch-layout`.
  - [x] Rewrite `handleSwatchDragMove(id, canvasX, canvasY)` to: read `canvasLayoutRef.current` (guard null → just set raw coords, no snap), `styleRef.current.swatchRadius`, and the dragged point's marker canvas position (`marker = { x: p.x, y: p.y + layout.imageOffsetY }`); build `others` = rendered centers of every OTHER swatch (same filter/`getSwatchPos` map as `handleSwatchDragEnd`); call `computeSwatchSnap`; `setPoints` to the snapped `swatchX/swatchY`; `setSnapGuides(result.guides)`. Return the snapped `{ x, y }` so the Konva node can be moved to it live.
  - [x] Compute the canvas-space `threshold` from the on-screen scale so it feels constant regardless of image resolution: `threshold = SNAP_SCREEN_PX / scale`, `SNAP_SCREEN_PX = 8`. Add a `scaleRef` (a `useRef<number>(1)`) synced wherever `displaySize`/scale is computed (mirror the `styleRef.current = style` pattern), and read `scaleRef.current` here. (Scale = `displaySize.width / layout.canvasWidth`.)

- [x] Task 3: Move the swatch node to the snapped position live during drag (AC: 1, 2, 3, 4, 5)
  - [x] In `components/Editor/EyedropperLayer.tsx`, change the swatch `onDragMove` so it snaps the node visually: `const snapped = onSwatchDragMove(p.id, e.target.x(), e.target.y()); e.target.x(snapped.x); e.target.y(snapped.y)` — the same write-back pattern already used by `onDragEnd`. This requires the `onSwatchDragMove` prop type to return `{ x: number; y: number }` (update the `Props` interface here and in `Canvas.tsx`'s `CanvasProps`).
  - [x] Leave `dragBoundFunc` (the 2D clamp) unchanged — clamping still runs first; snapping operates on the already-clamped coords.

- [x] Task 4: Clear guides on drag end; keep 5.1 overlap-blocking (AC: 6)
  - [x] In `handleSwatchDragEnd`, after resolving overlap and setting the final `swatchX/swatchY`, call `setSnapGuides([])`. Overlap resolution (`resolveSwatchOverlap`) is unchanged and runs on the final (snapped) coords — a snapped position that still overlaps is nudged apart exactly as in 5.1.
  - [x] Belt-and-suspenders: also clear guides on deselect / mode switch is NOT required (guides only exist mid-drag and are cleared on every dragEnd) — do not add extra clearing paths.

- [x] Task 5: Render the guide lines on the canvas (AC: 1, 2, 3, 4)
  - [x] Add a small `SnapGuideLayer.tsx` component in `components/Editor/`: a react-konva `<Layer listening={false}>` that maps `guides` to `<Line>` elements — vertical line `[pos, 0, pos, canvasHeight]` for `axis: "x"`, horizontal `[0, pos, canvasWidth, pos]` for `axis: "y"`. Style: `stroke` = accent `#c4956a`, `strokeWidth` ≈ `1 / scale` (so it's ~1 screen px — pass `scale` or `strokeWidth` in), `dash` ≈ `[6, 4]` scaled likewise. Guides are non-interactive (`listening={false}`).
  - [x] Render `<SnapGuideLayer>` inside `Canvas.tsx`'s `<Stage>`, after `<EyedropperLayer>` so guides sit above swatches (CAD convention). Thread a `guides: SnapGuide[]` prop (and `scale`, already computed in `Canvas`) from `index.tsx` → `Canvas` → `SnapGuideLayer`.
  - [x] Guides render only when non-empty; an empty array renders nothing (no stray Layer artifacts).

- [x] Task 6: Write tests (AC: all)
  - [x] Unit tests for `computeSwatchSnap` in `lib/swatch-layout.test.ts`:
    - AC1: within threshold of another swatch's X → returns that X + one `{axis:"x"}` guide; same for Y; X and Y can snap to two different targets in one call.
    - AC3: snaps to `canvasWidth/2` centerline and to the clamped edges (`r`, `canvasWidth−r`); emits the guide.
    - AC4: snaps to the own-marker X/Y when within threshold; emits the guide.
    - AC2: with two neighbours at X=100 and X=300, a raw X near 200 snaps to the midpoint 200 (equal spacing) + guide; outside threshold → no snap.
    - AC5: a raw position just outside threshold of every target returns the raw coords unchanged with an empty `guides` array (soft escape).
    - Priority: when a swatch-center target and a centerline are both within threshold on the same axis, the swatch-center wins (per the documented priority).
  - [x] `EyedropperLayer.test.tsx`: the swatch `onDragMove` now reads the value returned by `onSwatchDragMove` and writes it back to the node (assert `lastSetPos` reflects the mocked return, mirroring the existing `onDragEnd` snap-back test). Update `onSwatchDragMove` in `DEFAULT_PROPS` to return `{ x, y }`.
  - [x] `SnapGuideLayer.test.tsx`: given a mixed `guides` array, renders the right number of `Line`s with correct `points` for each axis; empty array renders no lines. (Reuse the react-konva `Line` mock pattern from `EyedropperLayer.test.tsx`.)
  - [x] Run `npm test` — all pass, no regressions. Record the new baseline count in Completion Notes (do not hardcode — report what the run prints; current baseline is **261 tests / 26 files**).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Context: what this story builds on (read Story 5.1 first)

Story 5.1 (`5-1-free-floating-swatch-placement.md`, status `done`) established the free-floating model this story extends:
- `EyedropperPoint` has `swatchX: number | null`, `swatchY: number | null` (absolute canvas position; `null` = still edge-laid-out).
- `getSwatchPos` (`EyedropperLayer.tsx:23`) returns the free position when both are non-null, else the edge position.
- The swatch `Circle` is draggable in 2D, clamped to the canvas by `dragBoundFunc` (`EyedropperLayer.tsx:126`).
- `handleSwatchDragMove` (`index.tsx:346`) sets `swatchX/swatchY` live during drag (this is where snapping is added).
- `handleSwatchDragEnd` (`index.tsx:358`) resolves overlap via `resolveSwatchOverlap` and snaps the node (this is where guide-clearing is added). **Do not touch the overlap logic** — only add `setSnapGuides([])`.

**This story adds only:** live alignment snapping during the move, and guide-line rendering. It does NOT change overlap-blocking, the data model, edge layout, generation (SLIC/Claude), color sampling, markers, labels, or export.

### Files to MODIFY / ADD

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/swatch-layout.ts` | Has `assignSwatchLayout`, `resolveSwatchOverlap`, edge helpers | ADD `SnapGuide` type + `computeSwatchSnap` pure helper |
| `lib/swatch-layout.test.ts` | Tests layout + overlap helpers | ADD `computeSwatchSnap` test block |
| `components/Editor/index.tsx` | `handleSwatchDragMove` sets raw coords; `handleSwatchDragEnd` resolves overlap | Snap in `handleSwatchDragMove` (return snapped pos + set guides); clear guides in `handleSwatchDragEnd`; add `snapGuides` state + `scaleRef`; pass `guides`/`scale` to `<Canvas>` |
| `components/Editor/EyedropperLayer.tsx` | swatch `onDragMove` calls `onSwatchDragMove` (void) | `onDragMove` writes back the returned snapped pos to the node; `onSwatchDragMove` prop now returns `{x,y}` |
| `components/Editor/Canvas.tsx` | Renders `EyedropperLayer` + `LabelLayer` | Thread `guides`/`scale`; render `<SnapGuideLayer>`; widen `onSwatchDragMove` return type in `CanvasProps` |
| `components/Editor/SnapGuideLayer.tsx` | — | NEW: Konva `Layer` of guide `Line`s |
| `components/Editor/SnapGuideLayer.test.tsx` | — | NEW: guide rendering tests |
| `components/Editor/EyedropperLayer.test.tsx` | swatch drag tests | Update `onSwatchDragMove` mock to return `{x,y}`; assert onDragMove snap-back |

### Files NOT to touch

- `lib/types.ts` — no data-model change. Snapping is transient drag UI; the snapped position is stored in the existing `swatchX/swatchY` (snapping just changes *what* value gets written each frame). Guides are ephemeral React state, never persisted.
- `lib/swatch-layout.ts` existing functions (`assignSwatchLayout`, `resolveSwatchOverlap`, `placeSwatchOnEdge`, `redistributeOnEdge`) — leave unchanged.
- `components/Editor/PointPanel.tsx` — the "Swatch side" control was already removed in 5.1; no panel change.
- `LabelLayer.tsx`, `LabelEditOverlay.tsx`, `app/` routes, `scripts/`, `styles.json` — unaffected.

### Coordinate system recap (same as Story 5.1 — critical)

- The Stage is rendered downscaled: `scale = displayWidth / canvasLayout.canvasWidth` (`Canvas.tsx:61`, ≈0.3). All layout math is in **canvas space** (full-res).
- Konva drag callbacks (`e.target.x()/y()`) report **canvas space** (nodes live inside the scaled Stage). `dragBoundFunc` alone receives/returns **absolute (stage-pixel) space** — but you are NOT changing `dragBoundFunc`, so snapping math stays purely in canvas space.
- Snapping operates on the canvas-space coords reported by `onDragMove`, which are already clamped to `[r, canvasWidth−r] × [r, canvasHeight−r]` by `dragBoundFunc`.
- `r = style.swatchRadius` (48 for float/float_clean/grid, 40 for minimal).
- Marker canvas position for the dragged point `p`: `{ x: p.x, y: p.y + layout.imageOffsetY }` (marker `x/y` are image space; add `imageOffsetY` for canvas space — exactly how `EyedropperLayer` computes `markerX/markerY` at lines 77–78).

### `computeSwatchSnap` — signature & algorithm

Pure, unit-testable. Each axis is resolved independently.

```typescript
export type SnapGuide = { axis: "x" | "y"; pos: number }

export function computeSwatchSnap(input: {
  others: { x: number; y: number }[] // rendered centers of all OTHER swatches
  marker: { x: number; y: number }   // dragged swatch's own marker, canvas space
  x: number                          // raw (clamped) cursor X, canvas space
  y: number                          // raw (clamped) cursor Y, canvas space
  swatchRadius: number
  canvasWidth: number
  canvasHeight: number
  threshold: number                  // canvas-space snap distance
}): { x: number; y: number; guides: SnapGuide[] }
```

Per axis (do X with the X-coords, then Y with the Y-coords — symmetric):

1. Build the ordered list of candidate target coords by priority:
   - **(a) other-swatch coords** — `others.map(o => o.x)` (or `.y`).
   - **(b) own marker coord** — `marker.x` (or `.y`).
   - **(c) frame coords** — for X: `canvasWidth/2` (centerline), `swatchRadius` (left edge), `canvasWidth − swatchRadius` (right edge); for Y: `canvasHeight/2`, `swatchRadius`, `canvasHeight − swatchRadius`.
   - **(d) equal-spacing midpoint** — see below.
2. Walk candidates in priority order; the **first** candidate with `|raw − candidate| <= threshold` wins. Set the axis result to that candidate and push `{ axis, pos: candidate }`. If none match, the axis result is the raw coord and no guide is pushed (soft escape, AC5).

**Equal-spacing midpoint (AC2), minimal triple rule:** on the X axis, take the other swatches' X-coords; find the nearest neighbour with `x < raw` (call it `lo`) and the nearest with `x > raw` (`hi`). If both exist, the equal-spacing target is `(lo + hi) / 2` (the dragged swatch sits exactly between them → three equally-spaced centers). Only consider it if within `threshold`. This satisfies "three or more swatches becomes equal" for the 3-swatch case; generalising to N>3 even distribution is **out of scope** — do not build it. Same logic on Y.

Notes:
- Returning two guides (one per axis) when both snap is correct and expected (e.g. snapping to a swatch's X and a different swatch's Y simultaneously).
- De-dupe guides by `(axis, pos)` before returning (e.g. centerline == a swatch center).
- Keep it allocation-light but clarity-first; this runs on every drag frame but the candidate lists are tiny (≤ ~15 swatches).

### `handleSwatchDragMove` rewrite (in `index.tsx`)

```typescript
const handleSwatchDragMove = useCallback(
  (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
    const layout = canvasLayoutRef.current
    if (!layout) {
      setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, swatchX: canvasX, swatchY: canvasY } : p)))
      return { x: canvasX, y: canvasY }
    }
    const r = styleRef.current.swatchRadius
    const current = pointsRef.current
    const dragged = current.find((p) => p.id === id)
    const marker = dragged
      ? { x: dragged.x, y: dragged.y + layout.imageOffsetY }
      : { x: canvasX, y: canvasY }
    const others = current
      .filter((pt) => pt.id !== id && (pt.swatchOrder !== null || pt.swatchX !== null))
      .map((pt) => getSwatchPos(pt, layout.canvasWidth, layout.canvasHeight, r))

    const snapped = computeSwatchSnap({
      others, marker, x: canvasX, y: canvasY, swatchRadius: r,
      canvasWidth: layout.canvasWidth, canvasHeight: layout.canvasHeight,
      threshold: 8 / (scaleRef.current || 1),
    })

    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, swatchX: snapped.x, swatchY: snapped.y } : p)))
    setSnapGuides(snapped.guides)
    return { x: snapped.x, y: snapped.y }
  },
  []
)
```

Keep the `useCallback([])` + `pointsRef`/`styleRef`/`canvasLayoutRef`/`scaleRef` ref-read pattern (handlers must stay referentially stable; they read live values from refs, not from closure state).

### `scaleRef` — add it

There is no existing `scaleRef`. `scale` is computed inside `Canvas` (`displayWidth/canvasWidth`) and `displaySize` is state in `index.tsx`. Add:
```typescript
const scaleRef = useRef<number>(1)
// keep synced wherever displaySize/canvasLayout are set:
useEffect(() => {
  if (displaySize && canvasLayout) scaleRef.current = displaySize.width / canvasLayout.canvasWidth
}, [displaySize, canvasLayout])
```
(Or set it inline in the existing effect that computes `displaySize` at `index.tsx:206` — match whatever is cleanest there.)

### `EyedropperLayer` `onDragMove` change

```typescript
onDragMove: (e: KonvaEventObject<DragEvent>) => {
  const snapped = onSwatchDragMove(p.id, e.target.x(), e.target.y())
  e.target.x(snapped.x)
  e.target.y(snapped.y)
},
```
Update the `Props.onSwatchDragMove` type from `(...) => void` to `(...) => { x: number; y: number }`, and the same in `Canvas.tsx`'s `CanvasProps`.

### `SnapGuideLayer.tsx`

```typescript
"use client"
import { Layer, Line } from "react-konva"
import type { SnapGuide } from "@/lib/swatch-layout"

interface Props {
  guides: SnapGuide[]
  canvasWidth: number
  canvasHeight: number
  scale: number
}

export default function SnapGuideLayer({ guides, canvasWidth, canvasHeight, scale }: Props) {
  if (guides.length === 0) return null
  const w = 1 / scale          // ~1 screen px
  const dash = [6 / scale, 4 / scale]
  return (
    <Layer listening={false}>
      {guides.map((g, i) => (
        <Line
          key={`${g.axis}-${g.pos}-${i}`}
          points={g.axis === "x" ? [g.pos, 0, g.pos, canvasHeight] : [0, g.pos, canvasWidth, g.pos]}
          stroke="#c4956a"
          strokeWidth={w}
          dash={dash}
        />
      ))}
    </Layer>
  )
}
```

### Soft snap (AC5) — why this design satisfies it without sticky state

Because `computeSwatchSnap` is a pure function of the **raw** clamped cursor each frame, the swatch only sits on a target while the raw cursor is within `threshold`. Drag the cursor past the band and the next frame returns the raw coord (no snap, no guide). No modifier key, no escape logic, no hysteresis — exactly the "soft snap" the AC asks for. Do not add stickiness; it would break AC5.

### Interaction with overlap-blocking (AC6)

`handleSwatchDragEnd` is unchanged except for `setSnapGuides([])`. The final snapped position flows into `resolveSwatchOverlap` exactly as a non-snapped position would; if the snapped spot overlaps a neighbour, 5.1's resolver nudges the dragged swatch (never a neighbour). Snapping and overlap-blocking compose cleanly — snapping picks the visual target during the move; overlap-blocking is the final safety net at drop.

### Related deferred item (optional, NOT an AC of this story)

Story 5.1's review deferred one cosmetic bug "to Story 5.2 territory": the free-swatch connector curve uses a stale `swatchSide` after detach, so a `curved` connector can bow the wrong way (`EyedropperLayer.tsx:43-56,80`, `getCurvedMidpoint`). It is **not** in this story's ACs and not required. If you choose to address it as a tidy-up, derive the curve offset direction from the swatch-vs-marker vector instead of `p.swatchSide` for free swatches, and add a focused test. Otherwise leave it for a future story — do not let it expand this story's scope.

### Regression guards

- Markers, labels, edge-laid-out (non-free) swatches, generation, and export are untouched. The only behavioural change to a non-snapping path is that `onSwatchDragMove` now returns a value — make sure every caller/mock is updated (search for `onSwatchDragMove`).
- `handleSwatchDragMove`/`End` must stay `useCallback([])` and read refs — do not add `points`/`style`/`displaySize` to a dependency array (that would re-create the handler and is the bug pattern these refs exist to avoid).
- Guides must never persist past a drag: every `dragEnd` clears them. There is no "select"/"deselect" path that shows guides, so no other clearing is needed.
- Do NOT reintroduce any no-crossing logic — Epic 5 relaxed that for manual placement (see 5.1 Dev Notes "No-crossing guarantee — explicitly relaxed").

### Testing standards (from `docs/project-context.md`)

- Vitest + React Testing Library; co-locate tests next to the file under test; run `npm test` from `eyedropper-web/`.
- Highest-value coverage is the pure helper `computeSwatchSnap` — exhaustive branch/edge tests in `lib/swatch-layout.test.ts` (the drag handlers in `EditorShell` are not exported, mirroring the 5.1 pattern of testing the extracted `lib/` core).
- Component tests use the existing react-konva mock pattern (`EyedropperLayer.test.tsx`): `Line`/`Circle`/`Layer` mocked to DOM with `data-*` attrs; the `Circle` mock fires `onDragMove` on mousedown and `onDragEnd` on mouseup and records node `x()/y()` set-calls in `lastSetPos`.
- New baseline: report what `npm test` prints (was 261/26 before this story).

### Project Structure Notes

- All edits stay within the established structure (`lib/` pure helpers, `components/Editor/` Konva). One new component file `SnapGuideLayer.tsx` + its test — consistent with the existing `LabelLayer.tsx`/`LabelLayer.test.tsx` shape. No new dependencies, no new directories.
- `SnapGuide` lives in `lib/swatch-layout.ts` alongside the helper that produces it (same module that owns `Side`), imported by `SnapGuideLayer.tsx` and `index.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — Epic 5 intent + full Story 5.2 ACs; Epic 5 relaxes the no-crossing guarantee to the generated layout only.
- [Source: _bmad-output/implementation-artifacts/5-1-free-floating-swatch-placement.md] — the free-floating model this story extends; `swatchX/swatchY`, `getSwatchPos` free-first, the 2D `dragBoundFunc`, the `pointsRef`/`styleRef`/`useCallback([])` handler conventions, and the deferred connector-curve item.
- [Source: docs/project-context.md#Testing Standards] — test framework, co-location, the per-story test task template.
- [Source: docs/SPEC.md#Non-negotiables] — constraint #2 (9:16 output) preserved; constraint #3 (no-crossing) already relaxed by Epic 5/Story 5.1.
- [Source: components/Editor/EyedropperLayer.tsx:23-41,126-152] — `getSwatchPos`, the swatch `dragBoundFunc`, and the `onDragMove`/`onDragEnd` write-back pattern to copy.
- [Source: components/Editor/index.tsx:346-380] — `handleSwatchDragMove`/`handleSwatchDragEnd` to extend; the ref-read handler pattern.
- [Source: app/globals.css:11] — accent color `#c4956a` for guide lines.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- Three `computeSwatchSnap` unit-test failures during authoring were test-fixture
  bugs (chosen `y` coords fell within threshold of the top frame edge `r=48`),
  not implementation bugs — fixed by moving the fixtures' `y` to non-snapping
  values. Implementation unchanged.

### Completion Notes List

- **Test run:** `npx vitest run` → **281 tests / 27 files, all passing** (baseline
  was 262/26 before this story — +19 tests, +1 file `SnapGuideLayer.test.tsx`).
  (Story spec quoted 261/26; the live pre-change baseline was actually 262/26.)
- `npx tsc --noEmit` → no errors. `next lint` → 0 errors / 0 warnings.
- Implemented exactly the 6 ACs: per-axis independent soft snapping to other
  swatch centers (AC1), own marker (AC4), frame centerline + clamped edges (AC3),
  equal-spacing midpoint of nearest neighbours (AC2, minimal-triple rule only);
  soft escape with no sticky state (AC5); guides cleared on every dragEnd with
  5.1 overlap-blocking preserved (AC6).
- `computeSwatchSnap` is a pure function in `lib/swatch-layout.ts`; the priority
  order (other swatch → own marker → frame → equal-spacing) is enforced by
  candidate ordering, first-within-threshold-wins. Guides naturally de-dupe since
  each axis emits at most one guide.
- Kept the `useCallback([])` + ref-read handler convention; added `scaleRef`
  synced via an effect on `displaySize`/`canvasLayout`. `SNAP_SCREEN_PX = 8` is a
  module constant. No data-model change (`lib/types.ts` untouched); guides are
  ephemeral React state.
- Out of scope (left untouched per spec): N>3 even distribution, the deferred
  connector-curve stale-side cosmetic bug, overlap logic, edge layout, generation,
  color sampling, labels, export.
- Threaded `snapGuides` through `index.tsx → Canvas → SnapGuideLayer`; `scale` was
  already computed in `Canvas`. Updated the pre-existing `Canvas.test.tsx`
  `makeProps` (new required `snapGuides` prop + `{x,y}`-returning `onSwatchDragMove`).

### File List

- `eyedropper-web/lib/swatch-layout.ts` (modified — added `SnapGuide` type + `computeSwatchSnap`)
- `eyedropper-web/lib/swatch-layout.test.ts` (modified — added `computeSwatchSnap` test block)
- `eyedropper-web/components/Editor/index.tsx` (modified — snap in `handleSwatchDragMove`, `scaleRef`, `snapGuides` state, clear guides in `handleSwatchDragEnd`, pass `snapGuides` to Canvas)
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` (modified — swatch `onDragMove` write-back; `onSwatchDragMove` returns `{x,y}`)
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx` (modified — `onSwatchDragMove` mock returns `{x,y}`; new onDragMove snap-back test; mock records `onDragMove` set-calls)
- `eyedropper-web/components/Editor/Canvas.tsx` (modified — thread `snapGuides`/`scale`; render `<SnapGuideLayer>`; widen `onSwatchDragMove` return type)
- `eyedropper-web/components/Editor/Canvas.test.tsx` (modified — `makeProps` gets `snapGuides` + `{x,y}`-returning `onSwatchDragMove`)
- `eyedropper-web/components/Editor/SnapGuideLayer.tsx` (NEW — Konva `Layer` of guide `Line`s)
- `eyedropper-web/components/Editor/SnapGuideLayer.test.tsx` (NEW — guide rendering tests)

### Review Findings

Code review 2026-06-30 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 6 ACs SATISFIED; acceptance-clean. 2 patch, 1 defer, 5 dismissed as noise/intended-behaviour.

- [x] [Review][Patch] `snapAxis` JSDoc references a non-existent `dim` parameter [lib/swatch-layout.ts:37] — the comment describes a `dim` arg ("`dim` is the canvas extent on this axis") but `snapAxis` takes only `(raw, coords, markerCoord, frame)`. Stale doc; trim the dangling clause.
- [x] [Review][Patch] `others` filter checks `swatchX` only while `getSwatchPos` free-branch requires both X and Y [components/Editor/index.tsx:386,421] — filter predicate is `pt.swatchOrder !== null || pt.swatchX !== null`, but `getSwatchPos` takes the free branch only when `swatchX !== null && swatchY !== null`, else falls to `p.swatchOrder!`. Latent only: all three writers (index.tsx:374,401,429) set swatchX/swatchY as a pair, so the half-set state is unreachable today. Harden the filter to also check `swatchY !== null` (or reuse the render-guard predicate) so `others` can never carry an `{x: undefined}` if a future change writes one coord alone.
- [x] [Review][Defer] `placeSwatchOnEdge` / `redistributeOnEdge` orphaned in production [lib/swatch-layout.ts:~139,178] — deferred, pre-existing. After `handleSetSide` was removed (Story 5.1 free-floating model), neither function has any production caller; only `swatch-layout.test.ts` references them. Not a 5.2 defect — the orphaning originates in 5.1. Retain-or-delete is a cleanup decision for whoever next touches the swatch model.

### Review Findings (2026-06-30, pass 2 — adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor)

All 6 ACs re-confirmed SATISFIED; both prior-review patches verified present and correct. 1 patch, 2 defer, 5 dismissed as noise/by-design/verified-safe.

- [x] [Review][Patch] Own-marker snap (AC4) can pull the swatch outside the `[r, dim−r]` clamp during drag [lib/swatch-layout.ts:61-70, components/Editor/index.tsx:381-383,401-405] — `marker.x = dragged.x` / `marker.y = dragged.y + imageOffsetY` are raw image-point coords with no clamp; a marker within `threshold` of the image edge (`marker.x < r` or `> canvasWidth−r`) makes `snapAxis` return that out-of-bounds coord, and `EyedropperLayer.onDragMove` writes it straight back to the node without re-clamping. The swatch visibly slides partly off-frame mid-drag. Self-corrects on drop (`resolveSwatchOverlap` re-clamps at `swatch-layout.ts:199-203`), so it's transient and never persists — hence Patch not Critical. Other-swatch/frame candidates are already in-bounds; only the AC4 marker case escapes. **FIXED 2026-06-30:** `computeSwatchSnap` now clamps `snapX`/`snapY` (and their guides) to `[r, canvasWidth−r]` / `[r, canvasHeight−r]` before returning. Added two regression tests in `swatch-layout.test.ts` (out-of-band marker X→clamps to r; marker Y→clamps to CH−r). Suite 281→283, tsc clean.
- [x] [Review][Defer] Konva `onDragMove` position write-back is the known jitter pattern [components/Editor/EyedropperLayer.tsx:142-149] — deferred, needs runtime verification. Writing `e.target.x/y()` inside `onDragMove` mutates the node mid-drag without updating Konva's drag anchor, the classic cause of snap jitter. Mirrors the existing `onDragEnd` write-back, and the test only fires a synthetic `mouseDown` so it can't catch real-drag jitter. Whether it actually jitters depends on Konva runtime behaviour — verify by manual drag before treating as a defect.
- [x] [Review][Defer] `handleToggleLabelEdit` uses stale `swatchSide` for free-swatch label offset [components/Editor/index.tsx:504,509] — deferred, pre-existing. Same class as Story 5.1's deferred connector-curve stale-side cosmetic bug; a freely-placed swatch keeps its pre-detach `swatchSide`, biasing the label offset direction. Cosmetic only. Fold into the connector-geometry cleanup already tracked in `deferred-work.md` (Story 5.1 entry).

## Change Log

- 2026-06-30: Story 5.2 implemented — CAD-style per-axis soft alignment snapping (other swatches / own marker / frame edges+centerlines / equal-spacing midpoint) with ephemeral guide lines cleared on drop; 5.1 overlap-blocking preserved. Added pure `computeSwatchSnap` + `SnapGuide` to `lib/swatch-layout.ts`, new `SnapGuideLayer` component, and snap wiring in the swatch drag handlers. Tests: 262/26 → 281/27, all passing; tsc + lint clean.
- 2026-06-30: Story 5.2 created (CAD-style alignment snapping & guides). Builds on Story 5.1's free-floating model. Scope fixed to the 6 epic ACs: per-axis soft snapping to other swatches / own marker / frame edges+centerlines / equal-spacing midpoint, with ephemeral guide lines cleared on drop; overlap-blocking from 5.1 preserved. Equal-spacing limited to the minimal-triple (nearest-neighbour midpoint) rule; N>3 even distribution explicitly out of scope. Connector-curve stale-side cleanup noted as optional, not an AC.
