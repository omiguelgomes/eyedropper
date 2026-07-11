---
baseline_commit: dc0a8dd97cf192c0e9d1b7a807f7d9cbb903dd7d
---

# Story 5.4: Draggable Connector Lines

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to grab the line that connects a colour swatch to its dot on the drawing and bend it into a curve by dragging a handle,
so that I can route the connectors around my composition and make them look the way I want, instead of being stuck with the auto-generated straight/curved line.

## Context & scope decision (READ FIRST)

The connector line today is **fully derived** — the artist cannot influence its shape. In `EyedropperLayer.tsx` (lines 252–265) each connector is a Konva `<Line>` whose points are computed every render:
- `connectorType: "straight"` → `[swatchPos, marker]` (a straight segment).
- `connectorType: "curved"` → `[swatchPos, midpoint, marker]` with `tension: 0.5`, where the midpoint comes from `getCurvedMidpoint()` (a fixed 40px offset perpendicular to `swatchSide`).
- `connectorType: "none"` → no line.

This story adds **one draggable bend handle per connector**: the artist drags the handle, the line bows smoothly through that point, and the bend position is **stored as an absolute canvas-space coordinate** on the point (`connectorMid: {x, y} | null`). This mirrors, deliberately and exactly, the free-floating-swatch model from Story 5.1 (`swatchX/swatchY` absolute, `null` = "not yet touched, use the derived default").

**Interaction model chosen (single bend handle, absolute position).** This is the simplest design that satisfies "move them freely so they look better," is directly testable as a pure helper, and reuses the Story 5.1/5.2 drag-handler patterns. Two alternatives were considered and NOT chosen for this story:
- *Grab-the-line-anywhere* (control point created where you grab) — more fluid, but needs point-to-segment projection math and a larger hit area on the line; deferred.
- *Two control points / full bezier S-curves* — most control, most complexity; deferred as almost certainly more than needed.

If the artist later wants grab-anywhere or full bezier, those are follow-on stories; the data model here (`connectorMid`) extends cleanly to them. **Do not build them now.**

## Acceptance Criteria

1. **Given** I am in Select/drag mode and a point's connector is visible (its style's `connectorType` is not `"none"`) **when** I look at the connector **then** a draggable bend handle is shown at the connector's current midpoint (its default derived position until I move it, or its stored `connectorMid` once I have).

2. **Given** I drag a connector's bend handle **when** the drag updates **then** the connector line bows smoothly so that it passes through (curves toward) the handle's current position, updating live during the drag.

3. **Given** I drag a bend handle and release it **when** the drag ends **then** the bend position is stored on that point as an absolute canvas-space coordinate (`connectorMid`), and the curved connector persists at that shape across re-renders.

4. **Given** I have bent a connector **when** I later drag its swatch or its marker (dot) to a new position **then** the connector's two endpoints follow the swatch/marker as before, and the bend point stays at its stored absolute canvas position (it does not move with the endpoints — the artist re-tweaks if desired). The curve continues to pass through the stored bend point.

5. **Given** a point whose connector I have never bent **when** it renders **then** its connector looks exactly as it does today (straight for `"straight"` styles, the `getCurvedMidpoint` auto-curve for `"curved"` styles) and the bend handle sits at that same default midpoint — i.e. this story introduces no visual change until a handle is actually dragged.

6. **Given** the active style's `connectorType` is `"none"` **when** the point renders **then** no connector line and no bend handle are shown (nothing to bend).

7. **Given** I am NOT in Select/drag mode (i.e. Add mode) OR I am in label-edit mode **when** the canvas renders **then** the bend handles are not interactive/draggable (consistent with how swatch/marker dragging is gated to Select mode); the connector line itself still renders.

8. **Given** I have bent one or more connectors **when** I export the image (Download 9:16 JPEG) **then** the exported bitmap shows the bent connectors exactly as displayed (the bend is part of the Konva scene, so `stage.toDataURL` captures it with no extra work).

9. **Given** I re-run a suggestion (SLIC/Claude) **when** all points are replaced **then** the new points have no bend (`connectorMid: null`) and their connectors render at the default derived shape — consistent with Story 5.1's rule that re-suggest is a full fresh layout.

10. **Given** I remove a point, add a point, or switch style **when** the canvas re-renders **then** any existing bends on OTHER points are preserved (removing/adding/style-switch must not clear `connectorMid` on untouched points) — mirroring Story 5.1's "manual positions survive style-switch / remove-other-point."

## Tasks / Subtasks

- [x] **Task 1: Add the `connectorMid` field to the data model (AC: 3, 5, 9)**
  - [x] In `lib/types.ts`, add to `EyedropperPoint` (right after `swatchX`/`swatchY`, same nullable pattern):
    ```typescript
    // Absolute canvas-space position of the connector's bend handle. null = not
    // yet bent; the connector uses its derived default midpoint (getCurvedMidpoint
    // for curved styles, or the straight-line midpoint for the handle position).
    connectorMid: { x: number; y: number } | null
    ```
  - [x] Initialise `connectorMid: null` in BOTH factory functions in `components/Editor/index.tsx`: `apiPointsToEyedroppers` (line ~86) and `claudePointsToEyedroppers` (line ~110). This alone satisfies AC9 (re-suggest builds fresh points via these factories) and the "add point" default (AC5/AC10 — `handleAddPoint` also uses `apiPointsToEyedroppers`).
  - [x] Do NOT touch `assignSwatchLayout` / `resolveSwatchOverlap` / any layout function — they operate on marker coords + swatch position only and must not reference `connectorMid`. This guarantees AC10 (layout re-runs on add/remove/style-switch preserve `connectorMid` because they spread `...p` and never overwrite it — VERIFY the spreads: `assignSwatchLayout` must return points with all existing fields intact).

- [x] **Task 2: Compute the handle's default position + the curved line points as a pure helper (AC: 1, 2, 4, 5)**
  - [x] In `lib/swatch-layout.ts` (alongside the other pure geometry helpers), add and export a pure function that returns the connector's rendered geometry. Suggested signature:
    ```typescript
    // Returns the bend-handle position and the Konva Line `points` array for a
    // connector. If `connectorMid` is null, the handle sits at the derived default
    // midpoint (straight midpoint, or the perpendicular-offset curve midpoint for
    // curved styles — matching today's getCurvedMidpoint) and the line is the
    // current straight/curved default. If `connectorMid` is set, the line bows
    // through it (a 3-point curve: swatch → mid → marker, tension 0.5) and the
    // handle sits at connectorMid.
    export function computeConnectorGeometry(input: {
      swatch: { x: number; y: number }   // canvas-space swatch centre
      marker: { x: number; y: number }   // canvas-space marker centre (already +imageOffsetY)
      connectorMid: { x: number; y: number } | null
      connectorType: "curved" | "straight" | "none"
      swatchSide: EyedropperPoint["swatchSide"]  // only used for the derived default of curved styles
    }): { handle: { x: number; y: number }; linePoints: number[]; curved: boolean }
    ```
  - [x] Behaviour:
    - `connectorType === "none"` → callers must not render, but return a sensible value (e.g. `handle` at the straight midpoint, `linePoints: []`, `curved: false`). The renderer gates on `connectorType !== "none"`, so this branch is defensive only.
    - `connectorMid !== null` → `handle = connectorMid`; `linePoints = [swatch.x, swatch.y, connectorMid.x, connectorMid.y, marker.x, marker.y]`; `curved: true`. (A bent connector is ALWAYS drawn as a smooth 3-point curve regardless of the style's `connectorType`, because the artist explicitly shaped it.)
    - `connectorMid === null && connectorType === "curved"` → reproduce today's behaviour: `mid = getCurvedMidpoint(swatch, marker, swatchSide)` (the fixed 40px perpendicular offset); `handle = mid`; `linePoints = [swatch.x, swatch.y, mid.x, mid.y, marker.x, marker.y]`; `curved: true`.
    - `connectorMid === null && connectorType === "straight"` → `mid = midpoint(swatch, marker)`; `handle = mid`; `linePoints = [swatch.x, swatch.y, marker.x, marker.y]` (straight, NO mid point in the line array so it stays a straight segment — the handle is at the geometric midpoint but the line is not yet curved); `curved: false`.
  - [x] `getCurvedMidpoint` currently lives *inside* `EyedropperLayer.tsx` (lines 147–160) and takes positional scalar args. **Move it into `lib/swatch-layout.ts`** (or re-implement the identical math there) so `computeConnectorGeometry` can call it and it becomes unit-testable. Update `EyedropperLayer.tsx` to import from lib. Keep the math byte-for-byte identical (offset 40, same per-side sign) so AC5 (no visual change for un-bent curved connectors) holds. If you move it, delete the in-component copy (clean up your own orphan).
  - [x] Keep the helper allocation-light and clarity-first; it runs once per point per render.

- [x] **Task 3: Render the connector via the helper + add the draggable handle (AC: 1, 2, 3, 4, 6, 7)**
  - [x] In `EyedropperLayer.tsx`, replace the inline `getCurvedMidpoint` call + the hand-built `points={...}` ternary (lines 191–195, 253–265) with a single call to `computeConnectorGeometry(...)` per point, using the already-computed `swatchPos`, `{ x: markerX, y: markerY }`, `p.connectorMid`, `style.connectorType`, `p.swatchSide`. Feed `linePoints` into the `<Line points>` and set `tension={geom.curved ? 0.5 : 0}`. This preserves the existing straight/curved rendering exactly when `connectorMid` is null (AC5).
  - [x] Render a bend **handle** — a small draggable `<Circle>` at `geom.handle` — only when `style.connectorType !== "none"` (AC6) AND `interactionMode === "select"` AND NOT label-edit mode (AC7). The layer already receives `interactionMode`; you will need to also pass a `labelEditMode` boolean prop OR gate handle interactivity another way. NOTE: the Konva `EyedropperLayer` is only mounted when NOT in label-edit mode? — VERIFY in `Canvas.tsx`: `EyedropperLayer` is always mounted; only `LabelLayer` is conditional (`!labelEditMode`) and `LabelEditOverlay` is the edit-mode surface (Canvas.tsx:161–179). So in label-edit mode the EyedropperLayer (swatches, markers, connectors) is STILL rendered underneath the HTML overlay. Therefore you MUST gate the handle's `draggable`/handlers on a `labelEditMode` prop threaded down (see Task 4), so handles aren't grabbable while editing labels (AC7). When not draggable, either render the handle non-interactively or don't render it at all — pick "don't render the handle in add/label-edit mode" (cleaner; the connector line still shows). Document the choice in a comment.
  - [x] Handle appearance: small, subtle, and visually distinct from swatch/marker so it reads as "grab to bend." Suggested: radius ~6 canvas px, semi-transparent fill of the accent colour `#c4956a` (or a thin ring), `hitStrokeWidth` widened for easy grabbing. Keep it small so it doesn't clutter; it only shows in Select mode. It is NOT part of the export concern (handles are only interactive chrome) — BUT note the handle IS in the Konva scene, so if it's visible at export time it would be captured. Since export happens from the right-panel button in Select mode, the handle would appear in the JPEG. **Decide and implement:** the handle must NOT appear in the exported image. Options: (a) render handles in a separate concern that's hidden during export, or (b) simplest — the export already leaves label-edit mode; instead, make the handle `listening`-only visual that we can suppress. RECOMMENDED: give the bend handles their own `<Group name="connector-handles">` (or a dedicated layer) and, in `handleExport` (index.tsx), hide it before `toDataURL` and restore after — mirror the pattern, OR simpler: only render handles when a point is *selected*. **Simplest correct choice: render the bend handle only for the SELECTED point** (thread `selectedPointId`/a per-point `selected` flag into the layer). That way at most one small handle is ever visible, and you can additionally hide it during export. Confirm with AC1 wording ("a draggable bend handle is shown at the connector's current midpoint") — showing it for the selected point satisfies "I can grab and bend a connector" while keeping the canvas uncluttered and export clean. If you instead show handles for all points, you MUST hide them during export. **Pick one, implement it, and document it in a comment and in Completion Notes.**
  - [x] Wire drag handlers on the handle mirroring the swatch pattern (EyedropperLayer.tsx:235–247): `onDragMove` calls a new `onConnectorDragMove(id, x, y)` prop; `onDragEnd` calls `onConnectorDragEnd(id, x, y)`. Both receive canvas-space coords from `e.target.x()/y()`. Add a `dragBoundFunc` that clamps the handle to stay within the canvas (`[0, canvasWidth] × [0, canvasHeight]`, scaled by stage scale like the swatch's — see EyedropperLayer.tsx:217–226). The handle may sit anywhere on the canvas (over image or letterbox), unlike swatches it has no radius-inset requirement, so clamp to `[0, w] × [0, h]`.
  - [x] The handle write-back on drag: follow the same `e.target.x(snapped.x); e.target.y(snapped.y)` pattern used for swatches so the node tracks the stored value (here there's no snapping, so it just echoes the clamped coord — still return `{x, y}` from the handler for consistency and so the node position stays authoritative).

- [x] **Task 4: State + handlers in the Editor shell (AC: 3, 4, 7, 10)**
  - [x] In `components/Editor/index.tsx`, add two `useCallback([])` handlers mirroring `handleSwatchDragMove`/`handleSwatchDragEnd` (the ref-read, empty-deps pattern — do NOT add `points`/`style` to deps):
    ```typescript
    const handleConnectorDragMove = useCallback((id, canvasX, canvasY) => {
      setPoints(prev => prev.map(p => p.id === id ? { ...p, connectorMid: { x: canvasX, y: canvasY } } : p))
      return { x: canvasX, y: canvasY }
    }, [])
    const handleConnectorDragEnd = useCallback((id, canvasX, canvasY) => {
      setPoints(prev => prev.map(p => p.id === id ? { ...p, connectorMid: { x: canvasX, y: canvasY } } : p))
      return { x: canvasX, y: canvasY }
    }, [])
    ```
    (dragMove and dragEnd are near-identical here — no overlap/snap resolution for the bend — but keep both to match the swatch handler shape and the `EyedropperLayer` prop contract. If you prefer one handler wired to both, that's acceptable; document it.)
  - [x] Thread `onConnectorDragMove`/`onConnectorDragEnd` through `Canvas` → `EyedropperLayer` exactly the way `onSwatchDragMove`/`onSwatchDragEnd` are threaded (add to `CanvasProps`, the `EyedropperLayer` `Props`, and the render call sites in `Canvas.tsx:134-149` and `index.tsx:798-808`).
  - [x] Thread `labelEditMode` (and `selectedPointId` if you chose the "handle on selected point only" approach) into `EyedropperLayer` so the handle can be gated per AC7 (and Task 3's export-clean decision). `labelEditMode` and `selectedPointId` already exist in `index.tsx` state; add them to `CanvasProps`/`EyedropperLayer` `Props` and thread them.
  - [x] AC10 verification: `handleRemovePoint`, `handleAddPoint`, and `handleSelectStyle` must NOT clear `connectorMid` on other points. `handleRemovePoint`/`handleAddPoint` call `assignSwatchLayout` which spreads existing points (VERIFY it returns `{...p, swatchSide, swatchOrder}` and never strips `connectorMid`). `handleSelectStyle` only calls `setStyle` (no point mutation) so bends survive trivially. Add a test asserting `connectorMid` survives an add + a remove-other + a style switch.
  - [x] If export hides handles (Task 3 option b): in `handleExport`, before `toDataURL`, hide the handle group/nodes and restore after (mirror the label-edit-mode exit already there at index.tsx:602-607). If you chose "handle only on selected point," export can additionally deselect or hide — keep it simple and DOCUMENT the approach.

- [x] **Task 5: Write tests (AC: all)**
  - [x] Unit tests for `computeConnectorGeometry` in `lib/swatch-layout.test.ts`:
    - AC5: `connectorMid: null`, `connectorType: "straight"` → `linePoints` is the 4-number straight array, `curved: false`, `handle` = geometric midpoint.
    - AC5: `connectorMid: null`, `connectorType: "curved"` → `linePoints` is the 6-number array with the `getCurvedMidpoint` offset for the given `swatchSide`, `curved: true`, `handle` = that offset midpoint. Assert the offset matches the pre-move `getCurvedMidpoint` output (regression guard for "no visual change").
    - AC2/AC3: `connectorMid: {x,y}` set → `linePoints` = `[swatch, mid, marker]` through the given mid, `curved: true`, `handle` = `connectorMid`. Assert this holds for BOTH `connectorType: "straight"` and `"curved"` (a bent connector is always curved).
    - `connectorType: "none"` → `linePoints: []` (defensive).
    - AC4: with a fixed `connectorMid`, changing `swatch`/`marker` moves only endpoints; `handle` stays at `connectorMid` (the mid in `linePoints[2],[3]` is unchanged).
  - [x] If `getCurvedMidpoint` is moved to lib and exported, add/keep its direct unit tests (all four sides + default) — port any existing coverage.
  - [x] Component tests in `EyedropperLayer.test.tsx` (reuse the existing react-konva `Circle`/`Line`/`Group` DOM-mock pattern):
    - A bend handle `<Circle>` renders for a connector when in Select mode (and, per your chosen gating, when selected); NOT in Add mode; NOT in label-edit mode (AC7); NOT when `connectorType: "none"` (AC6).
    - Dragging the handle (synthetic drag event as in the swatch tests) calls `onConnectorDragMove`/`onConnectorDragEnd` with the node coords.
  - [x] Editor/state test (mirror how Story 5.1/5.3 tested state where feasible, or the pure-helper level if the shell isn't exported): assert `connectorMid` survives add-point, remove-OTHER-point, and style-switch (AC10), and is reset to `null` by re-suggest (AC9 — via the factory functions, which are exported: `apiPointsToEyedroppers`/`claudePointsToEyedroppers` set `connectorMid: null`).
  - [x] Update any existing test that constructs an `EyedropperPoint` literal or mocks `computeSwatchSnap`/factory return shapes to include `connectorMid: null` (the type is now required). Search `lib/*.test.ts` and `components/**/*.test.tsx` for `EyedropperPoint` fixtures and add the field. Update `Canvas.test.tsx` `makeProps` if `<Canvas>` gains required props (`onConnectorDragMove`, `onConnectorDragEnd`, `labelEditMode` already exists, maybe `selectedPointId`).
  - [x] Run `npx vitest run` — all pass, no regressions. Record the new baseline count in Completion Notes (current baseline is **303 tests / 28 files** per Story 5.3; report exactly what the run prints, do not hardcode).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### What this story builds on

- **Story 5.1 (`5-1-free-floating-swatch-placement.md`, done)** established the exact pattern this story copies: an absolute-canvas-space nullable field on `EyedropperPoint` (`swatchX/swatchY`, null = "use derived default"), a `getSwatchPos` helper that branches free-vs-derived, `useCallback([])` ref-read drag handlers that `setPoints(prev => prev.map(...))`, and the rule that manual positions survive style-switch/remove-other but reset on re-suggest. **`connectorMid` is the connector-bend analogue of `swatchX/swatchY`.** Read 5.1 for the field-lifecycle conventions.
- **Story 5.2/5.3** added the swatch drag handlers (`handleSwatchDragMove/End`) with the `dragBoundFunc` clamp and the `e.target.x(snapped.x)` write-back — the bend-handle drag handlers copy this shape (minus snapping/overlap; the bend has neither in this story).
- This story does NOT add snapping to the bend handle. Snapping the bend (e.g. to the swatch↔marker line, or to a symmetric arc) would be a follow-on to Story 5.2's snap system; explicitly out of scope here.

### The connector today (what you are changing)

`EyedropperLayer.tsx`:
- `getCurvedMidpoint(sx, sy, mx, my, side)` (lines 147–160): fixed 40px perpendicular offset keyed on `swatchSide` (`left`→−x, `right`→+x, `top`→−y, `bottom`→+y, else no offset). MOVE this to `lib/swatch-layout.ts` and keep the math identical.
- Per-point render (lines 185–336): computes `swatchPos = getSwatchPos(...)`, `[midCx, midCy] = getCurvedMidpoint(...)`, then draws the connector `<Line>` (253–265) with a straight-vs-curved `points` ternary and `tension`. Replace the midpoint call + ternary with `computeConnectorGeometry`.
- The connector `<Line>` is `listening={false}` (line 263) — it is NOT itself grabbable, which is why we add a separate handle node rather than making the line draggable. Keep the line `listening={false}`.

### Known related deferred bug (fold in ONLY the cosmetic connector-curve fix if trivial; otherwise leave)

`deferred-work.md` records: *"Free swatch connector curve direction uses stale `swatchSide` after detach [EyedropperLayer.tsx] — `getCurvedMidpoint` bends based on `p.swatchSide`, but a detached free swatch keeps its pre-detach side, so the auto-curve may bow the wrong way."* This story makes that mostly moot for bent connectors (once the artist drags the handle, `connectorMid` overrides `swatchSide` entirely). For the *un-bent* default of a free-floating swatch, the stale-side curve still applies. **Do not expand scope to fix the stale-side default here** unless it falls out for free; the derived default's exact bow direction is AC5 "unchanged from today." Note in Completion Notes that bending a connector supersedes the stale-side issue for that point.

### Coordinate system recap (same as Story 5.1/5.2/5.3 — critical)

- Stage is rendered downscaled: `scale = displayWidth / canvasLayout.canvasWidth` (`Canvas.tsx:72`, ≈0.3). All geometry math is in **canvas space** (full-res).
- Konva drag callbacks report **canvas space** (via `e.target.x()/y()` inside the scaled stage). The handle's `dragBoundFunc` receives ABSOLUTE stage-pixel coords and must scale canvas bounds by stage scale — copy the swatch `dragBoundFunc` (EyedropperLayer.tsx:217–226), but clamp to `[0, w] × [0, h]` (no radius inset for the bend handle).
- Marker canvas position is `p.y + imageOffsetY` (markers store image-space y). The helper takes the already-offset marker coords — pass `{ x: markerX, y: markerY }` where `markerY = p.y + imageOffsetY` (already computed at EyedropperLayer.tsx:189).
- `connectorMid` is stored in canvas space directly (like `swatchX/swatchY`), so no offset conversion on read/write.

### Data-model note (types.ts)

Adding a required `connectorMid` field to `EyedropperPoint` is a breaking change to every `EyedropperPoint` literal in the codebase and tests. The two production factories (`apiPointsToEyedroppers`, `claudePointsToEyedroppers`) cover all runtime creation. For tests, grep for object literals typed as `EyedropperPoint` and add `connectorMid: null`. `tsc --noEmit` will flag every miss — run it and fix until clean before considering the story done.

### Files to MODIFY / ADD

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/types.ts` | `EyedropperPoint` with `swatchX/swatchY` nullable | ADD `connectorMid: { x: number; y: number } \| null` |
| `lib/swatch-layout.ts` | pure geometry helpers; `SnapGuide`/`DistributionGuide` | ADD `computeConnectorGeometry`; move `getCurvedMidpoint` here (export it) |
| `lib/swatch-layout.test.ts` | existing helper tests | ADD `computeConnectorGeometry` + `getCurvedMidpoint` tests |
| `components/Editor/EyedropperLayer.tsx` | inline `getCurvedMidpoint`, hand-built connector `<Line>` ternary | Import `computeConnectorGeometry`; render via it; ADD draggable bend-handle `<Circle>` gated on Select mode (+ selected/label-edit gating); ADD `onConnectorDragMove/End`, `labelEditMode`, (maybe `selectedPointId`) props |
| `components/Editor/EyedropperLayer.test.tsx` | swatch/marker render+drag tests | ADD bend-handle render + drag + gating tests |
| `components/Editor/index.tsx` | swatch/marker drag handlers; factories | ADD `connectorMid: null` to both factories; ADD `handleConnectorDragMove/End`; thread new props + `labelEditMode`/`selectedPointId` to `<Canvas>`; (maybe) hide handles in `handleExport` |
| `components/Editor/Canvas.tsx` | threads swatch/marker handlers to `EyedropperLayer` | Thread `onConnectorDragMove/End`, `labelEditMode`, (maybe) `selectedPointId` |
| `components/Editor/Canvas.test.tsx` | `makeProps` | ADD new required props to `makeProps` |

### Files NOT to touch

- `lib/swatch-layout.ts` layout functions (`assignSwatchLayout`, `resolveSwatchOverlap`, `computeSwatchSnap`, `placeSwatchOnEdge`, `redistributeOnEdge`) — connector bend is independent of swatch layout/snapping. They must NOT read or write `connectorMid`.
- `LabelLayer.tsx`, `LabelEditOverlay.tsx`, `label-layout.ts` — labels are unaffected.
- `app/` routes, `scripts/`, `styles.json`, `styles.ts` — NO new Style field is needed (bend is per-point data, not per-style). Export route is unchanged (bend is captured by `toDataURL` automatically; only handle-visibility is a client concern).
- `SnapGuideLayer.tsx`, `DistributionGuideLayer.tsx` — unrelated.
- Generation (SLIC/Claude), color sampling, marker drag, swatch drag/overlap/snap — all unchanged in behaviour.

### Export cleanliness (AC8) — the one subtle gotcha

The bent connector line is part of the Konva scene, so `stage.toDataURL` captures it automatically (AC8 needs no work). BUT the **bend handle `<Circle>` is also in the scene** and would be captured too. This is the single most likely thing to get wrong. Pick ONE approach and implement it fully:
- **RECOMMENDED — render the handle only for the currently-selected point.** At most one small handle ever shows; it reads as "the point you're editing." Combined with the fact that export can be triggered while a point is selected, either (a) also hide it during export, or (b) accept that a single small handle showing is still wrong for export → so ALSO gate the handle off during the `toDataURL` call. Cleanest: give handles a named group and toggle its `visible(false)` around `toDataURL` in `handleExport`, then `visible(true)`.
- Whatever you choose, add a test or explicit Completion Note documenting that exported images do not contain bend handles.

### Regression guards

- Un-bent connectors (`connectorMid: null`) must render byte-for-byte as today (AC5) — the `computeConnectorGeometry` null branches reproduce the exact `getCurvedMidpoint`/straight-line output. The existing connector rendering tests must stay green.
- `handleConnectorDragMove/End` must be `useCallback([])` + read only their args (no refs even needed here since they only set `connectorMid` from the passed coords) — do NOT add `points`/`style` deps (the recurring bug pattern).
- Bends must survive add/remove-other/style-switch (AC10) and reset on re-suggest (AC9).
- Do NOT add snapping, grab-anywhere, or bezier — single absolute bend handle only.
- Keep the connector `<Line>` `listening={false}`; grabbing is via the separate handle node.
- Marker/label/swatch/export/generation behaviour untouched.

### Testing standards (from `docs/project-context.md`)

- Vitest + React Testing Library; co-locate tests next to the file under test; run `npm test` (or `npx vitest run`) from `eyedropper-web/`.
- Highest-value coverage is the pure helper `computeConnectorGeometry` (all four branches × the `swatchSide` variants) in `lib/swatch-layout.test.ts` — the drag handlers in the Editor shell are not exported; mirror the 5.1/5.2/5.3 pattern of testing the extracted `lib/` core plus the react-konva DOM-mock component tests.
- Component tests use the existing react-konva mock pattern (`EyedropperLayer.test.tsx`, `SnapGuideLayer.test.tsx`): `Line`/`Circle`/`Group`/`Layer` mocked to DOM with `data-*` attrs.
- Report what `npx vitest run` prints for the new baseline (was **303 tests / 28 files** after Story 5.3).

### Project Structure Notes

- All edits stay within the established structure (`lib/` pure helpers, `components/Editor/` Konva). No new component file is required (the bend handle is a `<Circle>` inside the existing `EyedropperLayer`), no new dependencies, no new directories.
- `computeConnectorGeometry` and the moved `getCurvedMidpoint` live in `lib/swatch-layout.ts` alongside the other pure canvas-geometry helpers — consistent with `getSwatchPos` living in `EyedropperLayer.tsx` today (note: `getSwatchPos` is exported from the component and imported by `index.tsx`; you may keep `getCurvedMidpoint` in the component and export it instead of moving it to lib IF that's less churn — but lib is the cleaner home for a pure function with no React. Pick one and be consistent; the tests must import it from wherever it ends up).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — Epic 5 intent (free composition of swatches; no-crossing relaxed for manual placement). This story extends the same "let the artist move things freely" theme to connectors.
- [Source: _bmad-output/implementation-artifacts/5-1-free-floating-swatch-placement.md] — the absolute-nullable-field model (`swatchX/swatchY`), `getSwatchPos` free-vs-derived branch, `useCallback([])` ref-read drag handlers, the survive-style-switch/reset-on-resuggest rules. `connectorMid` copies this exactly.
- [Source: _bmad-output/implementation-artifacts/5-2-cad-style-alignment-snapping-and-guides.md] — swatch drag handler shape (`dragBoundFunc` scale-by-stage-scale, `e.target.x(snapped.x)` write-back) that the bend-handle handlers mirror.
- [Source: components/Editor/EyedropperLayer.tsx:147-160] — `getCurvedMidpoint` to move/reuse.
- [Source: components/Editor/EyedropperLayer.tsx:185-265] — per-point render; the connector `<Line>` and `swatchPos`/midpoint computation to replace with `computeConnectorGeometry`.
- [Source: components/Editor/EyedropperLayer.tsx:217-247] — swatch `dragBoundFunc` + `onDragMove/End` write-back pattern to copy for the bend handle.
- [Source: components/Editor/index.tsx:83-129] — `apiPointsToEyedroppers`/`claudePointsToEyedroppers` factories to add `connectorMid: null`.
- [Source: components/Editor/index.tsx:406-478] — `handleSwatchDragMove/End` (the `useCallback([])` ref-read handler pattern) to mirror for the bend handlers.
- [Source: components/Editor/index.tsx:587-625] — `handleExport`; the label-edit-mode-exit-before-toDataURL pattern to mirror if you hide handles during export.
- [Source: components/Editor/Canvas.tsx:134-179] — how props/layers are threaded to `EyedropperLayer` and the label-edit conditional mounting (EyedropperLayer is ALWAYS mounted — relevant to AC7 handle gating).
- [Source: lib/types.ts:10-30] — `EyedropperPoint`; add `connectorMid` beside `swatchX/swatchY`.
- [Source: deferred-work.md — "Free swatch connector curve direction uses stale swatchSide"] — related cosmetic bug; bending supersedes it per-point but do not expand scope to fix the un-bent default.
- [Source: docs/project-context.md#Testing Standards] — test framework, co-location, per-story test task template.
- [Source: app/globals.css] — accent color `#c4956a` for the bend handle fill/ring.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `npx tsc --noEmit` — clean before and after.
- `npx vitest run` — printed summary **Test Files 29 passed (29), Tests 345 passed (345)**. Baseline immediately before this story was 29 files / 324 tests (the tree had grown past the 303/28 recorded in Story 5.3). This story added 21 tests into existing files (no new test file), so the file count is unchanged at 29.
- Pre-existing (NOT introduced by this story) unhandled error in `EyedropperLayer.test.tsx` "onDragMove on swatch circle calls onSwatchDragMove with (id, x, y)": that test's `onSwatchDragMove` mock returns `undefined` and the unchanged swatch `onDragMove` does `e.target.x(snapped.x)`. Confirmed present on the baseline commit via `git stash`. All tests still pass; out of scope to fix here.
- `npm run build` fails in this environment on an unrelated Turbopack error (`Symlink scripts/.venv/bin/python3 is invalid, it points out of the filesystem root`) — confirmed pre-existing via `git stash`. `tsc --noEmit` is the authoritative type gate and is clean.

### Completion Notes List

Implemented a single draggable bend handle per connector, storing the bend as an absolute canvas-space `connectorMid: {x,y} | null` on `EyedropperPoint` — the connector-bend analogue of Story 5.1's `swatchX/swatchY`.

Key decisions (as the story asked me to pick and document):
- **Handle visibility:** the bend handle renders ONLY for the currently-SELECTED point (in select mode, not label-edit mode). At most one small handle is ever on the canvas — uncluttered, and it reads as "the point you're editing." Implemented via a new `selectedPointId` prop threaded to `EyedropperLayer`.
- **Export cleanliness (AC8):** belt-and-suspenders. The handle is named `"connector-handle"`; `handleExport` calls `stage.find(".connector-handle")`, sets `visible(false)` before `toDataURL`, and restores `visible(true)` after. So even though export can fire with a point selected, the JPEG never contains a handle. The bent connector LINE is part of the scene and is captured automatically.
- **Handle z-order:** rendered LAST in each point's group (on top of swatch/marker) so it is easy to grab.
- **`getCurvedMidpoint` moved to `lib/swatch-layout.ts`** (exported) and reused by `computeConnectorGeometry`; the in-component copy was deleted (orphan cleanup). Math is byte-for-byte identical (offset 40, same per-side sign) so un-bent curved connectors are visually unchanged (AC5).
- **New `EyedropperLayer` props are optional** (`onConnectorDragMove/End`, `labelEditMode`, `selectedPointId`) so the ~30 existing component tests compile without churn; they are REQUIRED on `CanvasProps` (mirroring the swatch handlers).
- **Bend handlers are `useCallback([])`** reading only their args (no refs, no `points`/`style` deps) — avoids the recurring stale-deps bug. dragMove and dragEnd are kept as two near-identical handlers to match the swatch handler shape / prop contract.
- A bent connector is ALWAYS drawn as a smooth 3-point curve through `connectorMid`, regardless of the style's `connectorType` (the artist explicitly shaped it).

Deferred-bug note: `deferred-work.md`'s "free swatch connector curve direction uses stale `swatchSide` after detach" is superseded per-point once a connector is bent (`connectorMid` overrides `swatchSide` entirely). The un-bent default's bow direction is unchanged (AC5), so I did NOT expand scope to fix the stale-side default.

Verified in the running app (Konva stage inspection + real export round-trip): selecting a point shows exactly one handle at the derived midpoint (AC1); firing the drag handlers moves the bend and, after React reconciles, the handle re-renders at the new `connectorMid` and the connector line passes through it — `linePoints [252,89, 332,235, 151,260]` (AC2/AC3); the export hide/restore leaves handles invisible during capture and visible after, and `/api/export` returned 200 `image/jpeg` (AC8); after clicking SLIC re-suggest, re-selecting the first point showed its handle back at the default midpoint (242,175), NOT the old dragged (332,235) — bends reset on re-suggest (AC9).

### File List

- `eyedropper-web/lib/types.ts` — added `connectorMid: { x: number; y: number } | null` to `EyedropperPoint`.
- `eyedropper-web/lib/swatch-layout.ts` — added exported `computeConnectorGeometry`; moved/exported `getCurvedMidpoint` here from `EyedropperLayer.tsx`.
- `eyedropper-web/lib/swatch-layout.test.ts` — added `getCurvedMidpoint`, `computeConnectorGeometry`, and `connectorMid`-survives-layout tests; added `connectorMid: null` to the `makePoint` fixture.
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` — import `computeConnectorGeometry`; deleted in-component `getCurvedMidpoint`; render connector via the helper; added draggable bend-handle `<Circle name="connector-handle">` gated on selected+select-mode+not-label-edit; added optional `onConnectorDragMove/End`, `labelEditMode`, `selectedPointId` props.
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx` — added `connectorMid: null` to fixture, `data-name` to the Circle mock, and a "connector bend handle" describe block (render gating, position, drag, clamp).
- `eyedropper-web/components/Editor/index.tsx` — `connectorMid: null` in both factories; added `handleConnectorDragMove/End`; threaded `onConnectorDragMove/End` + `selectedPointId` to `<Canvas>`; hide `.connector-handle` nodes around `toDataURL` in `handleExport`.
- `eyedropper-web/components/Editor/Canvas.tsx` — added `onConnectorDragMove/End` + `selectedPointId` to `CanvasProps`; threaded them plus `labelEditMode` to `EyedropperLayer`.
- `eyedropper-web/components/Editor/Canvas.test.tsx` — added `onConnectorDragMove/End` + `selectedPointId` to `makeProps`.
- `eyedropper-web/components/Editor/apiPointsToEyedroppers.test.ts` — asserted `connectorMid: null` in both factory outputs (AC9).
- `eyedropper-web/lib/apply-to-all.test.ts` — added `connectorMid: null` to fixture.
- `eyedropper-web/components/Editor/LabelEditOverlay.test.tsx` — added `connectorMid: null` to fixture.
- `eyedropper-web/components/Editor/LabelLayer.test.tsx` — added `connectorMid: null` to fixture.

## Change Log

- 2026-07-02: Implemented draggable connector bend handle (`connectorMid` field, `computeConnectorGeometry` helper, `EyedropperLayer` handle, Editor drag handlers, export handle-hiding). 21 tests added; suite 345/345 passing; tsc clean. Status → review.
