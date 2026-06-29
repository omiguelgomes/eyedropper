# Story 2.6: Add & Remove Points

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to add new color points by clicking on the image and remove any point via right-click,
so that I can fully customise which colors are annotated.

## Acceptance Criteria

1. **Given** I click "Add point" in the left sidebar Tools section **when** the mode changes **then** the cursor shows a crosshair when hovering over the image area.

2. **Given** I am in Add mode and click on the image **when** the click is registered **then** a new `EyedropperPoint` is created at the clicked coordinates, its color is sampled immediately via `color-sample.ts`, a swatch is added, and `swatch-layout.ts` is re-run.

3. **Given** I right-click on a ring marker **when** the context menu appears **then** it shows a single option: "Remove point".

4. **Given** I right-click on a swatch circle **when** the context menu appears **then** it shows a single option: "Remove point".

5. **Given** I select "Remove point" from the context menu **when** the action is confirmed **then** the point (marker, swatch, connector) is removed and `swatch-layout.ts` is re-run for the remaining points.

## Tasks / Subtasks

- [x] Task 1: Add `ContextMenu` HTML overlay component (AC: 3, 4, 5)
  - [x] Create `components/Editor/ContextMenu.tsx` — a presentational, fixed-position HTML menu (NOT Konva). Props: `{ x: number; y: number; onRemove: () => void; onClose: () => void }`. Renders a single "Remove point" button. See Dev Notes for the exact markup and Tailwind tokens.
  - [x] The button calls `onRemove` on click; clicking it should not also bubble to the document close-listener in an order that reopens/immediately closes incorrectly (see Dev Notes "Close behavior").

- [x] Task 2: Wire context-menu (right-click) on markers and swatches in `EyedropperLayer.tsx` (AC: 3, 4)
  - [x] Add `onRequestRemove: (id: string, clientX: number, clientY: number) => void` to the `Props` interface.
  - [x] Add an `onContextMenu` handler to BOTH the swatch `Circle` and the ring-marker `Circle`. The handler calls `e.evt.preventDefault()` (suppress the browser menu) then `onRequestRemove(p.id, e.evt.clientX, e.evt.clientY)`.
  - [x] Attach `onContextMenu` UNCONDITIONALLY (outside the `interactionMode === "select"` conditional spread) so right-click removal works in both Select and Add modes. See Dev Notes for rationale.

- [x] Task 3: Add click-to-add and context-menu threading in `Canvas.tsx` (AC: 1, 2, 3, 4)
  - [x] Add `onAddPoint: (canvasX: number, canvasY: number) => void` and `onRequestRemove: (id: string, clientX: number, clientY: number) => void` to `CanvasProps`.
  - [x] Add `onClick` to the `Stage` that, ONLY when `interactionMode === "add"`, reads `e.target.getStage()?.getRelativePointerPosition()` and calls `onAddPoint(pos.x, pos.y)`. In select mode pass `undefined` (no handler). See Dev Notes for the exact handler.
  - [x] Add crosshair cursor over the image area: on the `KonvaImage`, when `interactionMode === "add"`, add `onMouseEnter`/`onMouseLeave` that set `e.target.getStage()?.container().style.cursor` to `"crosshair"` / `"default"`.
  - [x] Pass `onRequestRemove` through to `<EyedropperLayer>`.

- [x] Task 4: Add `handleAddPoint`, `handleRemovePoint`, and context-menu state in `EditorShell` (`components/Editor/index.tsx`) (AC: 1, 2, 5)
  - [x] Add state: `const [contextMenu, setContextMenu] = useState<{ pointId: string; x: number; y: number } | null>(null)`.
  - [x] Add `handleAddPoint` as a `useCallback` with `[]` deps: convert canvas coords → image coords, guard to the image band, sample color, build the new point via `apiPointsToEyedroppers`, append, run `assignSwatchLayout`, `setPoints`. See Dev Notes for the full implementation (read from refs — same pattern as the swatch-drag handlers).
  - [x] Add `handleRequestRemove` as a `useCallback`: `setContextMenu({ pointId: id, x: clientX, y: clientY })`.
  - [x] Add `handleRemovePoint` as a `useCallback`: `setPoints` filters the id out, then runs `assignSwatchLayout` on the remaining points (read layout from `canvasLayoutRef`); then `setContextMenu(null)`.
  - [x] Add a `useEffect` (deps: `[contextMenu]`) that, when `contextMenu !== null`, attaches a `mousedown` + `keydown` (Escape) listener on `window` to close the menu; clean up on unmount/close. See Dev Notes "Close behavior".
  - [x] Pass `onAddPoint={handleAddPoint}` and `onRequestRemove={handleRequestRemove}` to `<Canvas>`.
  - [x] Render `<ContextMenu>` (in the DOM wrapper, NOT inside Konva) when `contextMenu !== null`, passing `onRemove={() => handleRemovePoint(contextMenu.pointId)}` and `onClose={() => setContextMenu(null)}`.

- [x] Task 5: Write tests (AC: all)
  - [x] `ContextMenu.test.tsx` (NEW): renders "Remove point" button; clicking it calls `onRemove`; menu is positioned at the given `x`/`y`.
  - [x] `EyedropperLayer.test.tsx`: extend the Circle mock to expose `onContextMenu` (fire via a `contextMenu` DOM event with a fake `evt`). New tests: right-click on swatch calls `onRequestRemove("p1", …)`; right-click on ring marker calls `onRequestRemove("p1", …)`; the handler calls `e.evt.preventDefault()`; right-click works in add mode too. Add `onRequestRemove: vi.fn()` to `DEFAULT_PROPS`.
  - [x] `Canvas.test.tsx`: extend the Stage mock to capture `onClick` and the Image mock to expose cursor handlers. New tests: in add mode the Stage `onClick` calls `onAddPoint` with the relative pointer position; in select mode no add-click occurs; in add mode hovering the image sets crosshair cursor (and resets on leave); in select mode no hover handlers. Add `onAddPoint`/`onRequestRemove` stubs to `makeProps`.
  - [x] `apiPointsToEyedroppers.test.ts` already covers single-point creation defaults — no new unit test needed for point shape (reused by `handleAddPoint`). No new pure helper was extracted (add/remove reuse `assignSwatchLayout`).
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 130 tests → 141 passing).
  - [x] Run `npx tsc --noEmit` — clean. All call sites and test `makeProps`/`DEFAULT_PROPS` updated for the new required props on `Canvas`/`EyedropperLayer`.

### Review Findings (code review 2026-06-15)

- [x] [Review][Patch] **HIGH — Right-click in Add mode adds a phantom point.** Konva fires a synthesized `click` for the right mouse button (verified: `Stage.js:384` sets `ListenClick` on any button; `:519-522` fires `click` regardless of button). In Add mode the Stage `onClick` runs `onAddPoint` for that synthesized click, so a right-click on a marker/swatch BOTH opens the Remove menu AND adds a new point at the cursor. Fix: guard the Stage `onClick` to the primary button only (`if (e.evt.button !== 0) return`). [components/Editor/Canvas.tsx:53-60] — FIXED: added `if (e.evt.button !== 0) return` guard + regression test.
- [x] [Review][Patch] **MED — Crosshair cursor stuck after switching Add→Select while hovering the image.** The `onMouseEnter`/`onMouseLeave` cursor handlers are only spread when `interactionMode === "add"`; switching to Select mid-hover unmounts the `onMouseLeave` handler, so the container keeps `cursor: crosshair` until the next marker hover resets it. Fix: reset `container().style.cursor` to `"default"` in an effect keyed on `interactionMode` (confirmed by two reviewers). [components/Editor/Canvas.tsx:76-85] — FIXED: added `stageRef` + `useEffect` keyed on `interactionMode` that resets the cursor when mode ≠ "add".
- [x] [Review][Patch] **LOW — Net-new EditorShell logic is untested (AC2/AC5).** `handleAddPoint` (band-guard + coord conversion + sample + layout) and `handleRemovePoint` (filter + re-layout + close) have no unit/component test; only the Canvas/EyedropperLayer wiring is covered. project-context.md testing standards require changed behavior to be tested. Add an EditorShell test (or extract+test the guard) covering: padding-click rejected, in-band click adds a laid-out point, remove filters the id and re-runs layout. [components/Editor/index.tsx:314-362] — FIXED: extracted the pure band-guard as `canvasClickToImagePoint` (used by `handleAddPoint`) and added 5 tests (in-band conversion, top/bottom/right padding rejection, inclusive boundaries).
- [x] [Review][Patch] **LOW — `ContextMenu.onClose` is declared and passed but never consumed.** The prop is in `Props` and supplied at the call site (`index.tsx:535`) but not destructured/used; all closing is driven by the window listener. Either wire it (e.g. a close affordance) or drop it. Intentional per Dev Notes:199, but flagged by two reviewers as dead. [components/Editor/ContextMenu.tsx:7] — FIXED: removed the dead `onClose` prop from `Props`, the call site, and the tests.
- [x] [Review][Patch] **LOW — UI.md doc drift: right-click removal now works in both modes.** The code attaches `onContextMenu` unconditionally (deliberate, per Completion Notes), but UI.md documents right-click → Remove only under Select/default mode. Update UI.md's Add-mode section so spec and behavior stay in sync. [docs/UI.md] — FIXED: added the right-click → Remove bullet to UI.md's Add-mode section.
- [x] [Review][Defer] **assignSwatchLayout has no min-spacing/capacity guard — dense edges overlap.** Even-distribution `L*(i+1)/(n+1)` provides no ≥2r anti-overlap; the Add-point tool makes piling many points onto one edge easy. Already tracked from Story 2.3/2.5 reviews. [lib/swatch-layout.ts:48-54] — deferred, pre-existing
- [x] [Review][Defer] **runSuggest blind `setPoints` replace can clobber a user-added point / leave a stale menu pointId.** The initial auto-suggest on mount is ungated; a point added during that window is discarded when the suggest resolves. Already tracked from Story 2.2 review (no AbortController/sequence guard). [components/Editor/index.tsx:201] — deferred, pre-existing
- [x] [Review][Defer] **Module-global `pointIdCounter` is non-deterministic across reloads.** Re-confirmed; latent footgun for selection/animation state. Already tracked from Story 2.2 review. [components/Editor/index.tsx:51] — deferred, pre-existing
- [x] [Review][Defer] **Open context menu keeps stale viewport coords after a window resize.** No resize listener repositions or closes the menu; the marker moves but the menu stays put. Cosmetic — the correct `pointId` is still removed on click. [components/Editor/index.tsx:346] — deferred, low-impact (new to this story)

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from that directory.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/Editor/ContextMenu.tsx` | **does not exist** | NEW — presentational HTML "Remove point" menu |
| `components/Editor/ContextMenu.test.tsx` | **does not exist** | NEW — tests for the menu component |
| `components/Editor/index.tsx` | EditorShell with marker/swatch drag handlers; `interactionMode` state and Tools buttons already wired | Add `contextMenu` state, `handleAddPoint`, `handleRequestRemove`, `handleRemovePoint`, close-listener effect; render `<ContextMenu>`; pass `onAddPoint`/`onRequestRemove` to `<Canvas>` |
| `components/Editor/Canvas.tsx` | Stage with no click handler; passes drag props to EyedropperLayer | Add `onAddPoint`/`onRequestRemove` props; Stage `onClick` (add mode); KonvaImage crosshair cursor (add mode); pass `onRequestRemove` to EyedropperLayer |
| `components/Editor/EyedropperLayer.tsx` | Swatch + ring marker draggable in select mode | Add `onRequestRemove` prop; `onContextMenu` on both circles (unconditional) |
| `components/Editor/Canvas.test.tsx` | Mocks Stage/Layer/Rect/Image/Circle; `makeProps` has drag stubs | Capture Stage `onClick`; add `onAddPoint`/`onRequestRemove` stubs; add-click tests |
| `components/Editor/EyedropperLayer.test.tsx` | Circle mock supports drag/hover; `DEFAULT_PROPS` has drag stubs | Add `onContextMenu` to Circle mock; add `onRequestRemove` stub; right-click tests |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint` shape already supports everything (new points reuse `apiPointsToEyedroppers`).
- `lib/swatch-layout.ts` — `assignSwatchLayout` is exactly what add/remove need (no new layout function). DO NOT add a new helper here.
- `lib/color-sample.ts` — `sampleColor` is used as-is; it already clamps x/y internally.
- `lib/drag-utils.ts` — `clampToImage` is reused defensively in `handleAddPoint`; no change.
- `app/` routes, `app/editor/page.tsx` — no server or page changes.
- The Tools section buttons in `index.tsx` (Select/Add) — already wired in Story 2.4/2.5; do NOT rebuild them.

### Critical pre-existing trap (from Story 2.4 review — MUST avoid)

`EyedropperLayer.tsx:67` skips rendering any point whose `swatchOrder === null`:
```typescript
if (p.swatchOrder === null) return null
```
A freshly added point starts with `swatchOrder: null` (that's the `apiPointsToEyedroppers` default). **`handleAddPoint` MUST run `assignSwatchLayout` before/within the same `setPoints` call**, so the new point immediately gets a numeric `swatchOrder` and renders as a visible, draggable swatch + marker. Skipping this produces an invisible, undraggable point — exactly the failure the deferred note from Story 2.4 warned about.

### Coordinate system recap (critical — same as Stories 2.3–2.5)

- The Konva `Stage` is scaled by `scale = displayWidth / canvasLayout.canvasWidth` (Canvas.tsx:40). `getRelativePointerPosition()` on the Stage RETURNS LOGICAL CANVAS-SPACE coords (it accounts for the stage transform), so no manual unscaling is needed.
- Canvas-space → image-space: `imageX = canvasX`, `imageY = canvasY - imageOffsetY`. The image occupies `canvasX ∈ [0, canvasWidth]` and `canvasY ∈ [imageOffsetY, imageOffsetY + imageHeight]`.
- `EyedropperPoint.x`/`.y` are stored in IMAGE-pixel space (not canvas space). The hidden sampling canvas (`hiddenCanvasCtxRef`) is the natural-size original image, so `sampleColor(ctx, imageX, imageY)` is correct.
- Refs already in `EditorShell` you will read from (do NOT add `canvasLayout`/`imageHeight` to `useCallback` deps — use the refs, matching the established pattern): `canvasLayoutRef`, `imageHeightRef`, `hiddenCanvasCtxRef`, `pointsRef`.

### `handleAddPoint` in `EditorShell` (AC 1, 2)

```typescript
const handleAddPoint = useCallback((canvasX: number, canvasY: number) => {
  const layout = canvasLayoutRef.current
  const ctx = hiddenCanvasCtxRef.current
  if (!layout || !ctx) return

  // Canvas → image space; ignore clicks in the 9:16 letterbox padding.
  const imageX = canvasX
  const imageY = canvasY - layout.imageOffsetY
  if (imageX < 0 || imageX > layout.canvasWidth || imageY < 0 || imageY > imageHeightRef.current) {
    return
  }

  const { x, y } = clampToImage(imageX, imageY, layout.canvasWidth, imageHeightRef.current)
  const color = sampleColor(ctx, x, y)
  const [newPoint] = apiPointsToEyedroppers([{ x, y, color }])

  setPoints((prev) =>
    assignSwatchLayout(
      [...prev, newPoint],
      layout.canvasWidth,
      layout.canvasHeight,
      layout.imageOffsetY
    )
  )
}, [])
```

Notes:
- `apiPointsToEyedroppers` (already exported from `index.tsx`) builds a point with the correct defaults (`swatchSide: "auto"`, `swatchOrder: null`, label coords copied from x/y) and a unique id from the module `pointIdCounter`. Reuse it — do NOT hand-roll a new point object.
- `assignSwatchLayout` assigns the "auto" side and a numeric `swatchOrder` to the new point and re-spreads its edge group, satisfying AC2's "swatch is added, and swatch-layout.ts is re-run" and avoiding the null-`swatchOrder` trap.

### `handleRemovePoint` / `handleRequestRemove` in `EditorShell` (AC 5)

```typescript
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
  setContextMenu(null)
}, [])
```

Note on AC5 behaviour: re-running `assignSwatchLayout` re-sorts the remaining swatches by marker position (overriding any manual swatch positions set by Story 2.5 swatch drags). This matches the documented marker-drag behaviour and AC5's literal "swatch-layout.ts is re-run". It is the intended trade-off — do not try to preserve manual swatch order on remove.

### `ContextMenu.tsx` (NEW) — AC 3, 4, 5

A small client component rendered as an absolutely/fixed-positioned HTML overlay above the canvas. It is NOT a Konva node.

```tsx
"use client"

interface Props {
  x: number
  y: number
  onRemove: () => void
  onClose: () => void
}

export default function ContextMenu({ x, y, onRemove }: Props) {
  return (
    <div
      data-testid="context-menu"
      className="fixed z-50 rounded border border-[var(--color-border)] bg-white shadow-md py-1"
      style={{ left: x, top: y }}
      // Prevent the window mousedown close-listener from firing for clicks
      // inside the menu (so the button click is not pre-empted by close).
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onRemove}
        className="block w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--color-bg)] text-[var(--color-text-primary)]"
      >
        Remove point
      </button>
    </div>
  )
}
```

- `onClose` is supplied for API symmetry but closing is driven by the window listener in EditorShell (see below). You may omit `onClose` from the destructure if unused, but keep it in the Props type for clarity.
- Use `fixed` positioning with `e.evt.clientX/clientY` (viewport coords) from the Konva contextmenu event — those are viewport-relative, matching `position: fixed`.

### Close behavior (EditorShell effect)

```typescript
useEffect(() => {
  if (!contextMenu) return
  const close = () => setContextMenu(null)
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null) }
  window.addEventListener("mousedown", close)
  window.addEventListener("keydown", onKey)
  return () => {
    window.removeEventListener("mousedown", close)
    window.removeEventListener("keydown", onKey)
  }
}, [contextMenu])
```

The menu's own `onMouseDown={(e) => e.stopPropagation()}` stops this window `mousedown` listener from closing the menu before the button's `onClick` fires. (The `Remove point` button's click still works because `stopPropagation` on `mousedown` does not block the subsequent `click`.)

### `Stage` onClick (add mode) in `Canvas.tsx` — AC 1, 2

```tsx
<Stage
  width={displayWidth}
  height={displayHeight}
  scaleX={scale}
  scaleY={scale}
  onClick={
    interactionMode === "add"
      ? (e) => {
          const pos = e.target.getStage()?.getRelativePointerPosition()
          if (pos) onAddPoint(pos.x, pos.y)
        }
      : undefined
  }
>
```

- In Add mode, markers/swatches are NOT draggable and have no click handlers; a click over any of them bubbles to the Stage `onClick`, so clicking anywhere on the image (including over an existing marker/swatch) adds a point. EditorShell's image-band guard rejects clicks in the letterbox padding.
- Type the event param as `KonvaEventObject<MouseEvent>` (import from `konva/lib/Node`, same import already used in `EyedropperLayer.tsx`).

### KonvaImage crosshair cursor (add mode) — AC 1

Add to the `<KonvaImage>` in Canvas.tsx, gated on add mode (conditional-spread pattern, same as the cursor handlers in EyedropperLayer):

```tsx
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
```

### `onContextMenu` in `EyedropperLayer.tsx` — AC 3, 4

Add the SAME handler to both the swatch `Circle` and the ring-marker `Circle`. Attach it UNCONDITIONALLY (NOT inside the `interactionMode === "select"` spread), so right-click removal works in Add mode too:

```tsx
onContextMenu={(e: KonvaEventObject<PointerEvent>) => {
  e.evt.preventDefault()
  onRequestRemove(p.id, e.evt.clientX, e.evt.clientY)
}}
```

Rationale for unconditional attach: right-click is a distinct gesture from a mode's primary action (drag in select, add-click in add), so removal should always be reachable. UI.md documents right-click under "default mode", but the story ACs do not gate it on mode, and allowing it in both modes is strictly more useful and harmless. This is a deliberate choice — note it in Completion Notes.

The `onContextMenu` event type from Konva carries the native event on `e.evt` (a `PointerEvent`/`MouseEvent` with `preventDefault`, `clientX`, `clientY`).

### Test guidance

**Konva mock note (both EyedropperLayer.test.tsx and Canvas.test.tsx):** react-konva renders to a real canvas that jsdom can't introspect, so these tests mock react-konva to render DOM elements with `data-*` attributes and wire Konva callbacks to DOM events. Follow the existing mock conventions in each file exactly.

**`EyedropperLayer.test.tsx`** — extend the existing `Circle` mock to accept and wire `onContextMenu`. Because jsdom dispatches a real `contextmenu` event, fire it with `fireEvent.contextMenu(el)` and have the mock build a fake `evt`:
```tsx
// inside the Circle mock, add to the destructured props: onContextMenu
onContextMenu={(domEvt) => {
  domEvt.preventDefault()
  onContextMenu?.({ evt: { preventDefault: () => {}, clientX: 123, clientY: 456 } })
}}
```
Then test (swatch = `circles[0]`, ring marker = `circles[circles.length - 1]`, per the existing index convention):
- right-click swatch → `onRequestRemove` called with `("p1", 123, 456)`
- right-click ring marker → `onRequestRemove` called with `("p1", 123, 456)`
- (optional) verify `preventDefault` is invoked by spying on the `evt.preventDefault` you inject.

Add to `DEFAULT_PROPS`: `onRequestRemove: vi.fn()`.

**`Canvas.test.tsx`** — extend the mock `Stage` to render `onClick` so it can be fired, and provide a fake event whose `target.getStage()` returns a stub with `getRelativePointerPosition`:
```tsx
Stage: ({ children, onClick, ...rest }: any) => (
  <div
    data-testid="konva-stage"
    data-has-click={onClick ? "true" : "false"}
    onClick={() =>
      onClick?.({ target: { getStage: () => ({ getRelativePointerPosition: () => ({ x: 33, y: 77 }) }) } })
    }
    {/* keep existing data-width/height/scale* attrs */}
  >
    {children}
  </div>
),
```
Tests:
- add mode → Stage has `data-has-click="true"`; firing click calls `onAddPoint(33, 77)`
- select mode → Stage has `data-has-click="false"` (no add on click)

Add to `makeProps`: `onAddPoint: vi.fn()`, `onRequestRemove: vi.fn()`.

**`ContextMenu.test.tsx`** (NEW) — plain RTL (no Konva):
- renders a button with text "Remove point"
- clicking the button calls `onRemove`
- the root menu is positioned at the given `x`/`y` (assert inline `style` `left`/`top`)

### Project structure / conventions

- Tailwind v4 — no config file; use arbitrary values with CSS variables: `bg-[var(--color-bg)]`, `border-[var(--color-border)]`, `text-[var(--color-text-primary)]`. CSS tokens defined in `app/globals.css`.
- Test framework: Vitest + React Testing Library; co-located `*.test.ts(x)` next to the file under test (per `docs/project-context.md`).
- New components are client components — start with `"use client"` (ContextMenu uses DOM events; EditorShell/Canvas/EyedropperLayer are already client).
- Konva event types: import `KonvaEventObject` from `konva/lib/Node` (already imported in `EyedropperLayer.tsx`). Konva is v10.3.0.

### References

- [Source: docs/SPEC.md#Eyedropper points (Konva layer)] — "Click empty area on image → adds a new point"; "Right-click marker or swatch → context menu: Remove"; 4px-radius average color sampling.
- [Source: docs/UI.md#Canvas (center, flex-1)] — Add mode: "Cursor: crosshair over image area; Click on image → places new marker, auto-samples color, adds swatch". Select mode: right-click → "Remove point".
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6: Add & Remove Points] — the five acceptance criteria (FR13, FR14).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Story 2.4 note: null-`swatchOrder` points render nothing → add-point MUST run `assignSwatchLayout` (the "latent trap for 2.6"). Story 2.5 note: `Canvas.test.tsx` `makeProps` must stay in sync with required `Canvas` props or `tsc`/CI breaks.
- [Source: components/Editor/index.tsx:52-72] — `apiPointsToEyedroppers` single-point factory (reuse for new points).
- [Source: lib/swatch-layout.ts:5-57] — `assignSwatchLayout` (re-run on add and remove).
- [Source: lib/color-sample.ts] — `sampleColor(ctx, x, y)` (4px-radius / 8×8 average, internally clamped).
- [Source: components/Editor/EyedropperLayer.tsx:104-135] — existing conditional-spread cursor/drag handler pattern to mirror for `onContextMenu` and crosshair.

### Project Structure Notes

- All new files land under `eyedropper-web/components/Editor/` (matches ARCHITECTURE.md project structure — `ContextMenu.tsx` is a new sibling of `Canvas.tsx`/`EyedropperLayer.tsx`, consistent with the Editor component grouping).
- No new `lib/` helper is required — add/remove reuse `assignSwatchLayout`, `apiPointsToEyedroppers`, `sampleColor`, `clampToImage`. Do not introduce parallel layout logic.
- No conflicts with the unified structure detected.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx tsc --noEmit` — clean
- `npx next lint` — 0 errors, 0 warnings
- `npx vitest run` — 141 passing (baseline 130)

### Completion Notes List

- **AC1 (crosshair in add mode):** added `onMouseEnter`/`onMouseLeave` to the `KonvaImage` in `Canvas.tsx`, gated on `interactionMode === "add"`, setting the stage container cursor to `crosshair`/`default` — same conditional-spread cursor pattern as the marker/swatch handlers.
- **AC2 (click-to-add):** `Stage.onClick` (only attached in add mode) reads `getRelativePointerPosition()` (logical canvas-space, transform-aware) → `handleAddPoint`. Handler converts to image space, rejects clicks in the 9:16 letterbox padding, samples color via `sampleColor`, builds the point with the existing `apiPointsToEyedroppers` factory, appends, and runs `assignSwatchLayout` in the same `setPoints` call. This avoids the Story 2.4 null-`swatchOrder` invisible-point trap — the new point gets a numeric `swatchOrder` immediately and renders as a draggable swatch + marker.
- **AC3/AC4 (right-click → menu):** `onContextMenu` on BOTH the swatch and ring-marker `Circle`s; `e.evt.preventDefault()` suppresses the native menu, then `onRequestRemove(p.id, clientX, clientY)` opens the HTML `ContextMenu` at viewport coords (fixed positioning). **Design choice:** attached unconditionally (works in select AND add mode) — right-click is a distinct gesture from each mode's primary action, so removal is always reachable. UI.md documents right-click under "default mode" but the ACs do not gate on mode; allowing it in both is strictly more useful and harmless.
- **AC5 (remove):** `handleRemovePoint` filters the id out and re-runs `assignSwatchLayout` on the remaining points, then closes the menu. Re-running layout re-sorts remaining swatches by marker position (overriding any manual Story-2.5 swatch positions) — this matches the documented marker-drag behaviour and AC5's literal "swatch-layout.ts is re-run".
- **Context menu close:** window `mousedown` + Escape `keydown` listeners (effect keyed on `contextMenu`); the menu's own `onMouseDown` `stopPropagation` prevents the window listener from closing it before the "Remove point" `onClick` fires.
- **Type-safety regression guard (Story 2.5 lesson):** adding required props to `Canvas`/`EyedropperLayer` is a breaking change — updated all call sites and both test `makeProps`/`DEFAULT_PROPS`; `tsc --noEmit` verified clean.
- No `lib/` changes and no new layout helper — add/remove reuse `assignSwatchLayout`, `apiPointsToEyedroppers`, `sampleColor`, `clampToImage`.

### File List

- `eyedropper-web/components/Editor/ContextMenu.tsx` (NEW)
- `eyedropper-web/components/Editor/ContextMenu.test.tsx` (NEW)
- `eyedropper-web/components/Editor/index.tsx`
- `eyedropper-web/components/Editor/Canvas.tsx`
- `eyedropper-web/components/Editor/Canvas.test.tsx`
- `eyedropper-web/components/Editor/EyedropperLayer.tsx`
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx`

## Change Log

- 2026-06-15: Story 2.6 created (Add & Remove Points). Comprehensive context engine analysis completed — comprehensive developer guide created. Status → ready-for-dev.
- 2026-06-15: Implemented Story 2.6 — add points via click in Add mode (crosshair cursor, immediate color sample + layout) and remove points via right-click context menu on markers/swatches. New `ContextMenu.tsx` HTML overlay; `handleAddPoint`/`handleRemovePoint`/`handleRequestRemove` + close-listener effect in `EditorShell`; `Stage.onClick` and image crosshair in `Canvas`; unconditional `onContextMenu` on both circles in `EyedropperLayer`. 11 new tests, 141 total. tsc + lint clean. Status → review.
