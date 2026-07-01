---
baseline_commit: 560de0d94d02f14a50f4a6b11dce14ba696562f9
---

# Story 5.1: Free-Floating Swatch Placement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to drag a swatch to any position on the 9:16 canvas instead of only along its edge,
so that I can compose the layout freely rather than being constrained to the four edges.

## Acceptance Criteria

1. **Given** I am in Select/drag mode **when** I drag a swatch circle **then** the swatch moves freely in two dimensions and can be dropped at any position within the 9:16 canvas (including over the image and in the letterbox padding), clamped so the swatch stays fully inside the canvas.

2. **Given** I have not yet dragged a swatch **when** points are generated (SLIC/Claude) or a new point is added **then** the swatch is placed by the existing auto edge-layout exactly as before this story (no visible change to initial placement).

3. **Given** I drag a swatch for the first time **when** the drag ends **then** the swatch is stored as a free-floating swatch with an absolute canvas `(x, y)` and no longer participates in edge redistribution; its connector line from the marker follows the new position.

4. **Given** I drop a swatch where it would overlap another swatch **when** the drag ends **then** the drop is blocked — the swatch settles at the nearest position that does not overlap any other swatch, and **no other swatch is moved**.

5. **Given** I have manually placed one or more swatches **when** I switch style, or remove a *different* point **then** the manually-placed swatches keep their positions (no auto re-layout moves them).

6. **Given** I have manually placed one or more swatches **when** I re-run a suggestion (SLIC/Claude) **then** all points are replaced and laid out fresh by the auto edge-layout (manual positions are not preserved — the point set is entirely new).

7. **Given** a swatch is selected in Select/drag mode **when** I view the right panel **then** the "Swatch side" (auto/left/right/top/bottom) control is no longer shown.

8. **Given** swatches have been freely placed such that connector lines cross **when** I view or export the canvas **then** the crossing lines are allowed (the no-crossing guarantee applies only to the generated initial layout, not to manual placement).

## Tasks / Subtasks

- [x] Task 1: Extend the data model with free-floating swatch coordinates (AC: 1, 3, 5)
  - [x] Add `swatchX: number | null` and `swatchY: number | null` to `EyedropperPoint` in `lib/types.ts` (canvas-space absolute position; `null` = not yet detached, use edge layout)
  - [x] Update `apiPointsToEyedroppers` and `claudePointsToEyedroppers` in `components/Editor/index.tsx` to seed `swatchX: null, swatchY: null` (new points start edge-laid-out per AC2)
  - [x] Update the `EditorState.points` consumers as needed — no other field changes

- [x] Task 2: Make `getSwatchPos` return the free position when set (AC: 1, 3, 8)
  - [x] In `components/Editor/EyedropperLayer.tsx`, at the top of `getSwatchPos`, return `{ x: p.swatchX, y: p.swatchY }` when **both** are non-null; otherwise fall through to the existing edge `switch` (see Dev Notes). This single change makes the connector, the swatch circle, label seeding, and `LabelLayer` all follow the free position automatically.

- [x] Task 3: Make the swatch draggable in 2D and clamp to the canvas (AC: 1)
  - [x] In `EyedropperLayer.tsx`, replace the swatch `Circle`'s edge-locked `dragBoundFunc` with a full-canvas 2D clamp `[r, canvasWidth − r] × [r, canvasHeight − r]`, scaled by the live stage scale (keep the verified absolute-space pattern from Story 2.5 — see Dev Notes)
  - [x] Update the render guard so a detached swatch still renders: change `if (p.swatchOrder === null) return null` to `if (p.swatchOrder === null && p.swatchX === null) return null`
  - [x] Keep `draggable={interactionMode === "select"}`, the cursor (`grab`/`default`), `onContextMenu`, and `onClick`/select handlers unchanged

- [x] Task 4: Rewrite the swatch drag handlers in `EditorShell` to set absolute `(x, y)` with overlap-blocking (AC: 1, 3, 4)
  - [x] `handleSwatchDragMove(id, canvasX, canvasY)`: set the point's `swatchX/swatchY` live to the (already-clamped) drag position — this detaches it on the first move. No edge math.
  - [x] `handleSwatchDragEnd(id, canvasX, canvasY)`: resolve overlap via the new `resolveSwatchOverlap` helper (Task 5), set the final `swatchX/swatchY`, and return the resolved canvas position so the Konva node snaps to it (same `e.target.x/y(snapped)` pattern as today)
  - [x] Both read `styleRef.current.swatchRadius` and `canvasLayoutRef.current` (already present); keep `useCallback([])` + `pointsRef` ref-read pattern

- [x] Task 5: Add `resolveSwatchOverlap` pure helper and exclude free swatches from auto-layout (AC: 4, 2, 5)
  - [x] Add `resolveSwatchOverlap(others, x, y, r, canvasWidth, canvasHeight)` to `lib/swatch-layout.ts` — returns the nearest non-overlapping `{ x, y }` for the dragged swatch given the rendered centers of all other swatches (see Dev Notes for algorithm)
  - [x] Update `assignSwatchLayout` in `lib/swatch-layout.ts` to **skip** points that are free-floating (`swatchX !== null && swatchY !== null`): they pass through unchanged AND are excluded from the per-edge groups so they do not affect the even-distribution of the remaining edge swatches (see Dev Notes)

- [x] Task 6: Remove the "Swatch side" control from the right panel (AC: 7)
  - [x] In `components/Editor/PointPanel.tsx`, remove the `SIDES` array, the "Swatch side" heading, and the side `<button>` row; drop the `swatchSide` and `onSetSide` props
  - [x] In `components/Editor/index.tsx`, remove the `handleSetSide` callback and stop passing `swatchSide`/`onSetSide` to `<PointPanel>`
  - [x] Update `PointPanel.test.tsx` to drop the side-control assertions and the removed props

- [x] Task 7: Tests (AC: all)
  - [x] Unit tests for `resolveSwatchOverlap` in `lib/swatch-layout.test.ts`: no-overlap returns input unchanged; single overlap pushes to exactly `2r` separation along the connecting axis; clamps within canvas; multiple-neighbour relaxation converges; unresolvable-cluster fallback returns the clamped input (documented behaviour)
  - [x] Unit tests for `assignSwatchLayout` free-skip in `lib/swatch-layout.test.ts`: a free-floating point keeps its `swatchX/swatchY` and is not assigned a `swatchOrder`; remaining edge points distribute as if the free point were absent
  - [x] Unit test for `getSwatchPos` free branch in `EyedropperLayer.test.tsx`: returns `(swatchX, swatchY)` when both set, edge position when null
  - [x] `EyedropperLayer.test.tsx`: swatch `dragBoundFunc` clamps to 2D canvas bounds in absolute (scaled) space (adapt the existing scaled-stage bound-fn test); `onDragMove` calls `onSwatchDragMove`, `onDragEnd` snaps to the value returned by `onSwatchDragEnd`
  - [x] `PointPanel.test.tsx`: side control is gone; color + remove still render
  - [x] Run `npm test` — all pass, no regressions (note the new baseline count in the Completion Notes)

### Review Findings

Code review 2026-06-30 (adversarial 3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 8 ACs satisfied; 261/261 tests pass. 2 patch, 1 defer, 6 dismissed as noise/by-design.

- [x] [Review][Patch] Render guard checks only `swatchX`, but `getSwatchPos` requires both `swatchX` & `swatchY` non-null — asymmetric null semantics. FIXED: guard now `swatchOrder === null && (swatchX === null || swatchY === null)` [components/Editor/EyedropperLayer.tsx:75]
- [x] [Review][Patch] "unresolvable corner cluster" test asserts only in-bounds, never non-overlap — vacuous about the documented best-effort behavior. FIXED: split into a genuine "separates in open canvas" case and a boxed-in cramped-canvas case that asserts residual overlap + that no neighbour moved (AC4) [lib/swatch-layout.test.ts:312]
- [x] [Review][Defer] Free swatch connector curve direction uses stale `swatchSide` after detach — connector may bend the wrong way once a swatch is dragged across the canvas [components/Editor/EyedropperLayer.tsx:80] — deferred, cosmetic, fits Story 5.2 (snapping/guides) territory

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Context: what changes and what does NOT

This story reworks **only how an already-generated swatch moves**. It does **not** touch SLIC/Claude generation, color sampling, the marker (the ring/dot on the image stays exactly as today — already freely draggable within the image), labels, or export.

The current model positions a swatch with two fields: `swatchSide` (`left|right|top|bottom`) + `swatchOrder` (1-D pixel position along that edge). `getSwatchPos` (`EyedropperLayer.tsx:23`) converts those into a canvas `(x, y)`. We are **adding** an absolute `(swatchX, swatchY)` that, when set, overrides the edge computation. Edge layout stays as the *initial* placement (AC2); the first drag detaches the swatch (AC3).

### Files to MODIFY

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/types.ts` | `EyedropperPoint` has `swatchSide` + `swatchOrder` | Add `swatchX: number \| null`, `swatchY: number \| null` |
| `lib/swatch-layout.ts` | `assignSwatchLayout` lays out ALL points on edges | Skip free points in `assignSwatchLayout`; add `resolveSwatchOverlap` |
| `lib/swatch-layout.test.ts` | tests edge layout helpers | Add free-skip + `resolveSwatchOverlap` tests |
| `components/Editor/EyedropperLayer.tsx` | `getSwatchPos` edge-only; swatch `dragBoundFunc` edge-locked; render guard on `swatchOrder` | `getSwatchPos` free-first; 2D canvas-clamp `dragBoundFunc`; render guard also allows free swatches |
| `components/Editor/EyedropperLayer.test.tsx` | edge dragBound test | Add 2D-clamp + `getSwatchPos` free tests |
| `components/Editor/index.tsx` | `handleSwatchDragMove/End` set `swatchOrder`; seeds points without `swatchX/Y`; has `handleSetSide` | Set `swatchX/swatchY` + overlap-block on drag; seed `swatchX/Y: null`; remove `handleSetSide` |
| `components/Editor/PointPanel.tsx` | Renders "Swatch side" buttons | Remove side control + its props |
| `components/Editor/PointPanel.test.tsx` | Asserts side buttons | Drop side assertions/props |

### Files NOT to touch

- `lib/color-sample.ts`, `lib/canvas-to-916.ts`, `lib/label-layout.ts` — unaffected.
- `components/Editor/LabelLayer.tsx`, `LabelEditOverlay.tsx` — they consume `getSwatchPos`/label coords; the Task-2 change flows through automatically. No edits needed.
- `app/` routes, `scripts/`, `styles.json` — no server/style changes.
- `lib/drag-utils.ts` (`clampToImage`) — marker-only; swatch clamping is inline in `dragBoundFunc`.

### Coordinate System Recap (critical — same as Story 2.5)

- The Stage is rendered downscaled: `scale = displayWidth / canvasLayout.canvasWidth` (`Canvas.tsx:61`, ≈0.3). All layout math is in **canvas space** (full-res); Konva drag callbacks (`e.target.x()/y()`) report canvas-space because the nodes live inside the scaled Stage, BUT `dragBoundFunc` receives/returns **absolute (stage-pixel) space**. This is why the Story 2.5 `dragBoundFunc` multiplies bounds by `this.getStage().scaleX()`. Keep that pattern.
- Swatch render center today: left `(r, order)`, right `(W−r, order)`, top `(order, r)`, bottom `(order, H−r)`. After this story, a detached swatch renders at `(swatchX, swatchY)` directly.
- `r = style.swatchRadius` (48 for float/float_clean/grid, 40 for minimal).

### Task 2 — `getSwatchPos` free-first

```typescript
export function getSwatchPos(
  p: EyedropperPoint,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): { x: number; y: number } {
  // Free-floating: absolute canvas position overrides edge layout.
  if (p.swatchX !== null && p.swatchY !== null) {
    return { x: p.swatchX, y: p.swatchY }
  }
  const r = swatchRadius
  switch (p.swatchSide) {
    case "left":   return { x: r, y: p.swatchOrder! }
    case "right":  return { x: canvasWidth - r, y: p.swatchOrder! }
    case "top":    return { x: p.swatchOrder!, y: r }
    case "bottom": return { x: p.swatchOrder!, y: canvasHeight - r }
    default:       return { x: r, y: p.swatchOrder ?? canvasHeight / 2 }
  }
}
```

### Task 3 — swatch `dragBoundFunc` (2D canvas clamp, absolute space)

Replace the edge-locked `dragBoundFunc` on the swatch `Circle` with:

```typescript
dragBoundFunc: function (pos) {
  const s = this.getStage()?.scaleX() ?? 1
  const r = style.swatchRadius * s
  const w = canvasWidth * s
  const h = canvasHeight * s
  return {
    x: Math.max(r, Math.min(w - r, pos.x)),
    y: Math.max(r, Math.min(h - r, pos.y)),
  }
}
```

This satisfies AC1 (anywhere in the 9:16 canvas, incl. padding, clamped to bounds). Note the swatch may now be dragged over the image — that is intended.

Render guard (so a detached free swatch still draws even if it never got a `swatchOrder`):

```typescript
if (p.swatchOrder === null && p.swatchX === null) return null
```

### Task 4 — `handleSwatchDragMove` / `handleSwatchDragEnd` in `EditorShell`

`onDragMove`/`onDragEnd` already pass `e.target.x()/y()` (canvas space, clamped by `dragBoundFunc`). Rewrite the handlers to set absolute coords:

```typescript
const handleSwatchDragMove = useCallback(
  (id: string, canvasX: number, canvasY: number) => {
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, swatchX: canvasX, swatchY: canvasY } : p
      )
    )
  },
  []
)

const handleSwatchDragEnd = useCallback(
  (id: string, canvasX: number, canvasY: number): { x: number; y: number } => {
    const layout = canvasLayoutRef.current
    if (!layout) return { x: canvasX, y: canvasY }
    const r = styleRef.current.swatchRadius

    const current = pointsRef.current
    // Rendered centers of every OTHER swatch (edge or free), for overlap-blocking.
    const others = current
      .filter((pt) => pt.id !== id && (pt.swatchOrder !== null || pt.swatchX !== null))
      .map((pt) => getSwatchPos(pt, layout.canvasWidth, layout.canvasHeight, r))

    const resolved = resolveSwatchOverlap(
      others, canvasX, canvasY, r, layout.canvasWidth, layout.canvasHeight
    )

    setPoints((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, swatchX: resolved.x, swatchY: resolved.y } : p
      )
    )
    return resolved
  },
  []
)
```

> `getSwatchPos` is already imported into `index.tsx` (`import { getSwatchPos } from "./EyedropperLayer"`). `resolveSwatchOverlap` must be added to the existing `@/lib/swatch-layout` import.

### Task 5a — `resolveSwatchOverlap` in `lib/swatch-layout.ts`

Pure, unit-testable. Moves **only** the dragged swatch to the nearest spot where no two centers are closer than `2 * swatchRadius` (AC4 — block the drop, never move neighbours). Relaxation: repeatedly push directly away from each overlapping neighbour by its penetration depth, clamp to canvas, cap iterations.

```typescript
export function resolveSwatchOverlap(
  others: { x: number; y: number }[],
  x: number,
  y: number,
  swatchRadius: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const minDist = 2 * swatchRadius
  const clampX = (v: number) => Math.max(swatchRadius, Math.min(canvasWidth - swatchRadius, v))
  const clampY = (v: number) => Math.max(swatchRadius, Math.min(canvasHeight - swatchRadius, v))

  let px = clampX(x)
  let py = clampY(y)

  for (let iter = 0; iter < 20; iter++) {
    let moved = false
    for (const o of others) {
      const dx = px - o.x
      const dy = py - o.y
      let dist = Math.hypot(dx, dy)
      if (dist < minDist) {
        // Degenerate exact-overlap: pick a deterministic push direction.
        const ux = dist === 0 ? 1 : dx / dist
        const uy = dist === 0 ? 0 : dy / dist
        const push = minDist - (dist === 0 ? 0 : dist)
        px = clampX(px + ux * push)
        py = clampY(py + uy * push)
        moved = true
      }
    }
    if (!moved) return { x: px, y: py }
  }
  // Could not fully separate within the iteration cap (dense cluster against a
  // corner). Return the clamped best-effort position — never moves a neighbour.
  return { x: px, y: py }
}
```

**Design note for the dev:** clamping after each push can re-introduce a small overlap against a neighbour pinned at a wall; the iteration cap bounds this. The AC says "settles at the nearest position that does not overlap" — in the common case (open canvas) this converges in 1–2 iterations to exactly `2r`. The corner-cluster fallback is an accepted edge; do NOT add neighbour-pushing to fix it (that would violate AC4's "no other swatch is moved"). If you prefer, an alternative is to snap back to the pre-drag position on unresolvable overlap — but the best-effort clamp is simpler and visually fine. Either is acceptable; document which you chose.

### Task 5b — exclude free swatches from `assignSwatchLayout`

`assignSwatchLayout` (called on suggest, add-point, remove-point, and the layout-ready effect) must leave free swatches untouched **and** exclude them from edge groups so they don't skew the even-distribution of the remaining edge swatches.

```typescript
export function assignSwatchLayout(
  points: EyedropperPoint[],
  canvasWidth: number,
  canvasHeight: number,
  imageOffsetY: number = 0
): EyedropperPoint[] {
  if (points.length === 0) return []

  // Free-floating swatches (manually placed) are excluded from edge layout:
  // they keep their absolute (swatchX, swatchY) and do not participate in the
  // per-edge even distribution.
  const isFree = (p: EyedropperPoint) => p.swatchX !== null && p.swatchY !== null

  // Step 1: assign sides for "auto" points — ONLY for non-free points.
  const withSides = points.map((p): EyedropperPoint => {
    if (isFree(p) || p.swatchSide !== "auto") return p
    // ...existing nearest-edge logic unchanged...
  })

  // Step 2: group by side — skip free points.
  const groups: Record<Side, EyedropperPoint[]> = { left: [], right: [], top: [], bottom: [] }
  for (const p of withSides) {
    if (isFree(p)) continue
    groups[p.swatchSide as Side].push(p)
  }

  // Steps 3–4 unchanged (sort + even distribute each group).
  // Final map: free points fall through result.get(p.id) ?? p  → returned unchanged.
  return points.map(p => result.get(p.id) ?? p)
}
```

This single guard makes AC2/AC5/AC6 fall out naturally:
- **AC6 (re-suggest)**: fresh points have `swatchX/Y = null` → all edge-laid-out. ✓
- **AC2 (add point)**: the new point is `null` → joins the edge layout; existing free points are skipped (kept) — and excluded from the group so they don't shift other edge swatches. ✓
- **AC5 (remove a different point)**: `handleRemovePoint` calls `assignSwatchLayout` on the survivors; free ones are skipped (kept). ✓
- **AC5 (switch style)**: `handleSelectStyle` already only calls `setStyle` (no layout) — free positions are inherently preserved. No change needed there. ✓

### Task 6 — remove "Swatch side" control

`PointPanel` keeps only: point number, color swatch + hex, and the Remove button. New props:

```typescript
interface Props {
  pointNumber: number
  color: string
  onRemove: () => void
}
```

In `index.tsx`, delete `handleSetSide` and update the `<PointPanel>` usage to drop `swatchSide`/`onSetSide`. `swatchSide` remains in the data model and is still used by the auto edge-layout for non-free swatches — only the manual UI control is removed.

### No-crossing guarantee — explicitly relaxed (AC8)

CLAUDE constraint #3, SPEC.md non-negotiable #3, and ARCHITECTURE "No-crossing guarantee" all assert swatch lines never cross. Epic 5 relaxes this: the guarantee now covers **only the generated initial layout** (`assignSwatchLayout`, untouched here). Once the artist drags a swatch free, crossings are their responsibility and must be allowed (no blocking, no reordering). Do not add any crossing-prevention logic. (A SPEC/CLAUDE doc update is a separate concern — out of scope for the dev task; the relaxation is recorded in `epics.md` Epic 5 and `deferred-work.md`.)

### Regression guards

- **Marker drag still calls `assignSwatchLayout`** (`handleMarkerDragEnd`) — correct and unchanged. With the free-skip, dragging a marker no longer reshuffles a swatch the user manually placed (its `swatchX/Y` are set → skipped). This is the desired behaviour.
- The **layout-ready `useEffect`** (`index.tsx:580`) and `seedNewLabels` must keep working: both key off `swatchOrder`/`getSwatchPos`; free points pass through `assignSwatchLayout` unchanged and `getSwatchPos` returns their free coords.
- `placeSwatchOnEdge` / `redistributeOnEdge` in `lib/swatch-layout.ts` are **no longer on the swatch-drag path** after this story. Leave them and their tests in place (valid pure functions; a future "reset to edge" or Story 5.2 may reuse them). Note in Completion Notes that they are now unused by the drag flow — do not delete pre-existing tested helpers as part of this story.
- Keep `swatchSide` defaulting to `"auto"` and `swatchOrder` to `null` in the point seeders; add `swatchX/swatchY: null` alongside.

### Story 5.2 boundary (do NOT build here)

CAD-style alignment **snapping** (snap to other swatches' X/Y, even spacing, canvas edges/centerlines, own marker) and **guide lines** are Story 5.2. This story is free 2D drag + overlap-blocking only. Do not add snapping or guides.

### Testing standards

- Vitest + React Testing Library; Konva mocked (see existing `EyedropperLayer.test.tsx` mock that exposes `onDragMove`/`onDragEnd` via mouseDown/mouseUp and records `e.target.x/y` snap-backs in a shared `lastSetPos`).
- Pure helpers (`resolveSwatchOverlap`, `assignSwatchLayout` free-skip) get plain unit tests in `lib/swatch-layout.test.ts` — the highest-value coverage since the drag handlers in `EditorShell` are not exported (mirror the Story 2.5 pattern of extracting the testable core into `lib/`).
- Run `npm test` and record the new baseline count in Completion Notes (current count ≈ prior baseline; do not hardcode — report what `npm test` prints).

### Project Structure Notes

- All edits stay within the established structure (`lib/` pure helpers, `components/Editor/` Konva + panels). No new directories, no new dependencies.
- `EyedropperPoint` gaining `swatchX/swatchY` aligns with the existing pattern of canvas-space coords already living on the point (the `label.x/label.y` fields are likewise absolute canvas coords). Keep the `| null` convention used by `swatchOrder`.

### References

- [Source: docs/SPEC.md#Non-negotiables] — constraint #3 (no-crossing) relaxed by Epic 5; constraint #2 (9:16 output) preserved.
- [Source: docs/DECISIONS.md#No-crossing guarantee approach] and [#Swatch placement algorithm: ported from Python] — context for why the edge model exists; this story layers free placement on top, leaving the port intact for initial layout.
- [Source: docs/ARCHITECTURE.md#State shape] — `EyedropperPoint` interface being extended.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "Free-floating, push-aside swatches" deferred item (Story 3.1). NOTE divergence: that note proposed *push-aside* on collision; the grilled decision for this story is **block-the-drop** (no neighbour movement). Push-aside was explicitly rejected.
- [Source: _bmad-output/implementation-artifacts/2-5-drag-swatches-along-edge.md] — the edge-drag story this supersedes; reuse its verified `dragBoundFunc` absolute-space scaling pattern and its `pointsRef`/`styleRef`/`useCallback([])` handler conventions.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — full decided design and AC for 5.1 + 5.2.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, BMAD dev-story workflow)

### Debug Log References

None — no blockers. `tsc --noEmit` clean, `next lint` 0 errors/0 warnings.

### Completion Notes List

- **Test baseline**: 252 tests / 26 files before this story → **261 tests / 26 files** after (+9 net: 6 new `resolveSwatchOverlap` cases, 2 `assignSwatchLayout` free-skip cases, 1 `getSwatchPos` free-branch + 1 detached-render + the rewritten 2D `dragBoundFunc` test; 2 removed side-button `PointPanel` tests replaced by 1 "side control gone" test; new `swatchX/swatchY` null assertions added to existing seeder tests). All pass, no regressions.
- **Overlap-blocking strategy chosen**: best-effort clamp on unresolvable corner clusters (the simpler of the two documented options in Dev Notes). Never moves a neighbour (AC4). In the common open-canvas case relaxation converges in 1–2 iterations to exactly `2r` separation.
- **Orphaned `placeSwatchOnEdge`**: as predicted in the story's Regression guards, `placeSwatchOnEdge` is no longer on the swatch-drag path (its only caller, `handleSwatchDragEnd`, was rewritten). Left in place with its tests intact (valid pure helper; possible reuse by a future "reset to edge" or Story 5.2). Removed only the now-unused `placeSwatchOnEdge` import from `index.tsx` and added `resolveSwatchOverlap` to that import. `redistributeOnEdge` likewise remains, still used by `placeSwatchOnEdge`.
- **No-crossing guarantee relaxed (AC8)**: no crossing-prevention logic added; manual placement allows crossings by construction. Doc updates to SPEC/CLAUDE are out of scope per the story (recorded in epics.md / deferred-work.md).
- **Test-helper churn**: `makePoint`/point-literal helpers in `swatch-layout.test.ts`, `EyedropperLayer.test.tsx`, `LabelLayer.test.tsx`, `LabelEditOverlay.test.tsx`, and `apply-to-all.test.ts` gained the two new required `swatchX/swatchY` fields (default `null`) so the `EyedropperPoint` type stays satisfied.

### File List

- `lib/types.ts` — added `swatchX`/`swatchY` to `EyedropperPoint`
- `lib/swatch-layout.ts` — free-skip in `assignSwatchLayout`; added `resolveSwatchOverlap`
- `lib/swatch-layout.test.ts` — extended `makePoint`; added free-skip + `resolveSwatchOverlap` test blocks
- `components/Editor/EyedropperLayer.tsx` — `getSwatchPos` free-first; 2D-clamp `dragBoundFunc`; render guard allows free swatches
- `components/Editor/EyedropperLayer.test.tsx` — extended `makePoint`; rewrote dragBound test for 2D; added `getSwatchPos` free + detached-render tests
- `components/Editor/index.tsx` — seed `swatchX/swatchY: null`; rewrote `handleSwatchDragMove/End` to set absolute coords with overlap-blocking; removed `handleSetSide`; updated import; dropped side props from `<PointPanel>`
- `components/Editor/PointPanel.tsx` — removed "Swatch side" control + `swatchSide`/`onSetSide` props
- `components/Editor/PointPanel.test.tsx` — dropped side props/assertions; added "side control gone" test
- `components/Editor/apiPointsToEyedroppers.test.ts` — assert seeded `swatchX/swatchY` are null
- `components/Editor/LabelLayer.test.tsx` — added `swatchX/swatchY` to `makePoint`
- `components/Editor/LabelEditOverlay.test.tsx` — added `swatchX/swatchY` to `makePoint`
- `lib/apply-to-all.test.ts` — added `swatchX/swatchY` to `makePoint`

## Change Log

- 2026-06-30: Story 5.1 created (free-floating swatch placement). Epic 5 added to `epics.md` and `sprint-status.yaml`. Design fixed via grilling: edges = initial layout only; first drag detaches to absolute `(swatchX, swatchY)`; overlap handled by block-the-drop (not push-aside); "Swatch side" control removed; no-crossing guarantee relaxed to the generated layout only. CAD snapping + guides split out to Story 5.2.
- 2026-06-30: Story 5.1 implemented. All 7 tasks complete; 261/261 tests pass (baseline 252); tsc + lint clean. Status → review.
