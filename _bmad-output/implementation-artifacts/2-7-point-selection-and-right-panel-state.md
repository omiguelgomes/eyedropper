# Story 2.7: Point Selection & Right Panel State

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to click a swatch to select it and see its details in the right panel,
so that I can inspect and adjust individual point properties.

## Acceptance Criteria

1. **Given** I click a swatch circle **when** it becomes selected **then** the right sidebar updates to show: "Point #N", the color hex value with a filled swatch preview, swatch side buttons (auto / left / right / top / bottom) with the current assignment highlighted, and a "× Remove this point" button.

2. **Given** a point is selected and I click a swatch side button **when** the button is pressed **then** the point's `swatchSide` is updated to the chosen value (overriding auto-assignment) and `swatch-layout.ts` is re-run.

3. **Given** a point is selected and I click "× Remove this point" **when** the action completes **then** the point is removed identically to the right-click → Remove flow (Story 2.6).

4. **Given** I click on empty canvas space (not a marker or swatch) **when** the click registers **then** the selection is cleared and the right panel returns to the default "no point selected" state showing only the Export section.

## Tasks / Subtasks

- [x] Task 1: Add `PointPanel` presentational component (AC: 1, 2, 3)
  - [x] Create `components/Editor/PointPanel.tsx` — a `"use client"` presentational HTML component (NOT Konva). Props: `{ pointNumber: number; color: string; swatchSide: EyedropperPoint["swatchSide"]; onSetSide: (side: EyedropperPoint["swatchSide"]) => void; onRemove: () => void }`. See Dev Notes for exact markup/tokens.
  - [x] Render: a "Point #{pointNumber}" heading, a filled color preview swatch + the hex string, a row of 5 side buttons (`auto`, `left`, `right`, `top`, `bottom`) where the button matching `swatchSide` is highlighted with the accent token, and a full-width "× Remove this point" button.
  - [x] Side buttons call `onSetSide(side)`; the remove button calls `onRemove`.

- [x] Task 2: Add selection state + handlers in `EditorShell` (`components/Editor/index.tsx`) (AC: 1, 2, 3, 4)
  - [x] Add `const [selectedPointId, setSelectedPointId] = useState<string | null>(null)`.
  - [x] Add `handleSelectPoint = useCallback((id: string) => setSelectedPointId(id), [])`.
  - [x] Add `handleDeselect = useCallback(() => setSelectedPointId(null), [])`.
  - [x] Add `handleSetSide = useCallback((id, side) => {...}, [])` — `setPoints` maps the matching point's `swatchSide` to `side`, then runs `assignSwatchLayout` (read layout from `canvasLayoutRef.current`). See Dev Notes for the exact body.
  - [x] Update `handleRemovePoint` to also clear selection when the removed id is selected: add `setSelectedPointId((cur) => (cur === id ? null : cur))`. This makes AC3 (panel remove) and the right-click → Remove flow (Story 2.6) both clear a stale selection. Do NOT change its existing filter + re-layout + `setContextMenu(null)` behavior.
  - [x] Pass `onSelectPoint={handleSelectPoint}` to `<Canvas>` (threaded down to `EyedropperLayer`) and `onDeselect={handleDeselect}` to `<Canvas>` (handled in the Stage click).

- [x] Task 3: Render the right-panel selection state in `EditorShell` (AC: 1, 4)
  - [x] Compute `const selectedPoint = selectedPointId ? points.find((p) => p.id === selectedPointId) : undefined` and `const selectedNumber = selectedPoint ? points.findIndex((p) => p.id === selectedPoint.id) + 1 : 0`.
  - [x] In the right `<aside>`, render `<PointPanel>` ABOVE the existing Export `<section>` ONLY when `selectedPoint` is defined, wiring `onSetSide={(side) => handleSetSide(selectedPoint.id, side)}` and `onRemove={() => handleRemovePoint(selectedPoint.id)}`.
  - [x] When `selectedPoint` is undefined (nothing selected, OR a stale id whose point was removed/replaced), render only the Export section — the default state. The `points.find` guard makes this robust against a dangling `selectedPointId` after a re-suggest replaces all points. Do NOT clear/alter the Export section itself.

- [x] Task 4: Wire swatch/marker click selection in `EyedropperLayer.tsx` (AC: 1, 4)
  - [x] Add `onSelectPoint: (id: string) => void` to the `Props` interface.
  - [x] Add `onClick` to BOTH the swatch `Circle` and the ring-marker `Circle`, gated to `interactionMode === "select"` (add it INSIDE the existing `interactionMode === "select"` conditional-spread object alongside the drag/hover handlers). The handler sets `e.cancelBubble = true` (stops the event reaching the Stage's deselect click) then calls `onSelectPoint(p.id)`. See Dev Notes for the exact handler + the cancelBubble rationale.

- [x] Task 5: Wire Stage deselect-click in `Canvas.tsx` (AC: 4)
  - [x] Add `onSelectPoint: (id: string) => void` and `onDeselect: () => void` to `CanvasProps`.
  - [x] Change the Stage `onClick` so it is attached in BOTH modes: in `"add"` mode keep the existing primary-button-guarded add-point behavior; in `"select"` mode call `onDeselect()` (it only fires for clicks that bubble to the Stage — i.e. empty padding / background / image — because swatch/marker clicks set `cancelBubble`). See Dev Notes for the exact handler.
  - [x] Pass `onSelectPoint` through to `<EyedropperLayer>`.

- [x] Task 6: Write tests (AC: all)
  - [x] `PointPanel.test.tsx` (NEW): renders "Point #N", the hex string, a preview with the point color as fill, and 5 side buttons; the button matching `swatchSide` is visually highlighted (assert a distinguishing class/attribute); clicking a side button calls `onSetSide` with that side; clicking "× Remove this point" calls `onRemove`.
  - [x] `EyedropperLayer.test.tsx`: extend the `Circle` mock to wire `onClick` (fire via a `click` DOM event with a fake `evt` carrying a mutable `cancelBubble`). New tests: clicking the swatch in select mode calls `onSelectPoint("p1")` and sets `cancelBubble`; clicking the ring marker in select mode calls `onSelectPoint("p1")`; in add mode neither circle has an `onClick` (no selection). Add `onSelectPoint: vi.fn()` to `DEFAULT_PROPS`.
  - [x] `Canvas.test.tsx`: extend the Stage mock so the fake click event carries `cancelBubble: false` (selection tests rely on bubbling). New tests: in select mode the Stage has an `onClick` that calls `onDeselect` (and does NOT call `onAddPoint`); in add mode the Stage click calls `onAddPoint` and does NOT call `onDeselect`. Add `onSelectPoint`/`onDeselect` stubs to `makeProps`.
  - [x] If any net-new non-trivial pure logic is extracted (see Dev Notes "Testing the EditorShell logic"), unit-test it. Otherwise the component/wiring tests above cover the ACs (`handleSetSide` delegates to the already-tested `assignSwatchLayout`). — No new pure logic extracted; `handleSetSide` is a thin map + `assignSwatchLayout` (already covered by `swatch-layout.test.ts`).
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 147 passing → 156 passing, +9 net new).
  - [x] Run `npx tsc --noEmit` — clean. New required props on `Canvas`/`EyedropperLayer` are a breaking change: update ALL call sites and the test `makeProps`/`DEFAULT_PROPS` (the recurring Story 2.5/2.6 lesson).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from that directory.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/Editor/PointPanel.tsx` | **does not exist** | NEW — presentational right-panel point details (Point #N, color, side buttons, remove) |
| `components/Editor/PointPanel.test.tsx` | **does not exist** | NEW — tests for the panel component |
| `components/Editor/index.tsx` | EditorShell: points state, add/remove/drag handlers, `ContextMenu`; right `<aside>` renders only `<ExportButton>` | Add `selectedPointId` state + `handleSelectPoint`/`handleDeselect`/`handleSetSide`; clear selection in `handleRemovePoint`; render `<PointPanel>` above Export when a point is selected; pass `onSelectPoint`/`onDeselect` to `<Canvas>` |
| `components/Editor/Canvas.tsx` | Stage `onClick` only in add mode; passes drag/remove props to EyedropperLayer | Stage `onClick` in BOTH modes (add→add point, select→deselect); add `onSelectPoint`/`onDeselect` props; pass `onSelectPoint` to EyedropperLayer |
| `components/Editor/EyedropperLayer.tsx` | Swatch + marker: draggable, hover, `onContextMenu`; click does nothing | Add `onSelectPoint` prop; `onClick` on both circles inside the select-mode spread (cancelBubble + select) |
| `components/Editor/Canvas.test.tsx` | Mocks Stage/Layer/Rect/Image/Circle; Stage click event has `evt.button` | Add `cancelBubble` to the fake Stage click event; `onSelectPoint`/`onDeselect` stubs; select-mode deselect tests |
| `components/Editor/EyedropperLayer.test.tsx` | Circle mock wires drag/hover/contextMenu; `DEFAULT_PROPS` has those stubs | Add `onClick` to the Circle mock (fake `evt` with `cancelBubble`); `onSelectPoint` stub; select/add click tests |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint.swatchSide` already supports `"auto" | "left" | "right" | "top" | "bottom"`. `EditorState.selectedPointId` already exists in the type but `EditorState` is **not** the runtime state container (EditorShell uses discrete `useState` hooks); add `selectedPointId` as a local `useState`, do NOT introduce an `EditorState` object.
- `lib/swatch-layout.ts` — `assignSwatchLayout` already respects an explicit `swatchSide` and reassigns `"auto"`. `handleSetSide` reuses it; do NOT add a new layout helper.
- `lib/color-sample.ts`, `lib/drag-utils.ts` — unused by this story.
- `app/` routes, `app/editor/page.tsx` — no server/page changes.
- `components/Editor/ContextMenu.tsx` — the right-click → Remove path is unchanged; AC3 reuses `handleRemovePoint`, it does not touch `ContextMenu`.
- The Suggest/Tools sections and `ExportButton` in `index.tsx` — already wired; do NOT rebuild them. `PointPanel` renders ABOVE the Export section, leaving Export untouched.

### Selection model (critical)

- Selection is a single `selectedPointId: string | null` local state in `EditorShell`. There is **no multi-select**.
- Selection keys on `point.id`. Ids are stable within a session (`apiPointsToEyedroppers` assigns `point-${pointIdCounter++}`). The known `pointIdCounter` HMR/StrictMode reset (deferred from Story 2.2) does NOT affect runtime selection — it only matters across a full module reload, after which all points re-fetch anyway.
- **Stale-selection guard:** a re-suggest (`runSuggest`) replaces ALL points with new ids (the blind-`setPoints` replace, deferred from Story 2.2). After that, the old `selectedPointId` dangles. Do NOT trust `selectedPointId` directly for rendering — always resolve it via `points.find(...)` and render the default panel if the lookup fails. (You may also `setSelectedPointId(null)` at the top of `runSuggest` for tidiness, but the render-time guard is the load-bearing fix.)

### NO canvas visual change for selection (scope guard)

This story changes ONLY the right panel. Do **not** add a selection halo, highlight ring, thicker border, or any other canvas-side indicator to the selected swatch/marker — the ACs and UI.md describe only the right-panel content. `EyedropperLayer` therefore does NOT need `selectedPointId`; it only needs the `onSelectPoint` callback. Keep it minimal.

### `EditorShell` handlers (AC 2, 3, 4)

```typescript
const handleSelectPoint = useCallback((id: string) => {
  setSelectedPointId(id)
}, [])

const handleDeselect = useCallback(() => {
  setSelectedPointId(null)
}, [])

const handleSetSide = useCallback(
  (id: string, side: EyedropperPoint["swatchSide"]) => {
    const layout = canvasLayoutRef.current
    setPoints((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, swatchSide: side } : p))
      if (!layout) return updated
      return assignSwatchLayout(
        updated,
        layout.canvasWidth,
        layout.canvasHeight,
        layout.imageOffsetY
      )
    })
  },
  []
)
```

`handleRemovePoint` — add ONE line to clear a stale selection; everything else is unchanged from Story 2.6:

```typescript
const handleRemovePoint = useCallback((id: string) => {
  const layout = canvasLayoutRef.current
  setPoints((prev) => {
    const remaining = prev.filter((p) => p.id !== id)
    if (!layout) return remaining
    return assignSwatchLayout(remaining, layout.canvasWidth, layout.canvasHeight, layout.imageOffsetY)
  })
  setSelectedPointId((cur) => (cur === id ? null : cur)) // NEW
  setContextMenu(null)
}, [])
```

Notes:
- `handleSetSide` uses the `canvasLayoutRef` (not the `canvasLayout` state) so it can keep `[]` deps — the established pattern from the drag handlers. Do NOT add `canvasLayout`/`imageHeight` to the deps.
- Setting `side === "auto"` re-runs auto edge-assignment (nearest edge) in `assignSwatchLayout`; an explicit side is respected and the point joins that edge's sorted/spread group. This is the existing, tested behavior of `assignSwatchLayout` — `handleSetSide` is just a thin map + re-layout.
- AC3 explicitly says "removed identically to the right-click → Remove flow" — so AC3 calls the SAME `handleRemovePoint`. Do not write a second removal path.

### Right-panel render (AC 1, 4) in `EditorShell`

Resolve the selection at render time, then conditionally render `<PointPanel>` above Export:

```tsx
const selectedPoint = selectedPointId ? points.find((p) => p.id === selectedPointId) : undefined
const selectedNumber = selectedPoint ? points.findIndex((p) => p.id === selectedPoint.id) + 1 : 0
```

```tsx
{/* Right sidebar */}
<aside
  style={{ width: 280 }}
  className="bg-[var(--color-sidebar)] border-l border-[var(--color-border)] flex flex-col p-4 gap-6 flex-shrink-0"
>
  {selectedPoint && (
    <PointPanel
      pointNumber={selectedNumber}
      color={selectedPoint.color}
      swatchSide={selectedPoint.swatchSide}
      onSetSide={(side) => handleSetSide(selectedPoint.id, side)}
      onRemove={() => handleRemovePoint(selectedPoint.id)}
    />
  )}
  <section>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
      Export
    </h3>
    <ExportButton />
  </section>
</aside>
```

- "Point #N": N is the 1-based index of the selected point in the current `points` array (`findIndex + 1`). It is a display-only number, not the point `id`. The current right `<aside>` has no `gap`; add `gap-6` (matching the left sidebar) so the panel and Export aren't flush.
- Default state (no selection / stale id) = ONLY the Export section. (UI.md mock also shows a "Selected point / (nothing selected)" placeholder block in the default state; the AC says "only the Export section". Follow the AC — do NOT add a placeholder block. Note this doc drift in Completion Notes.)

### `PointPanel.tsx` (NEW) — AC 1, 2, 3

A small client component. Mirror the existing left-sidebar section/button styling (see `index.tsx` Tools buttons) and the accent-highlight pattern (active = accent bg + white text, like the Select/Add toggle).

```tsx
"use client"

import type { EyedropperPoint } from "@/lib/types"

const SIDES: EyedropperPoint["swatchSide"][] = ["auto", "left", "right", "top", "bottom"]

interface Props {
  pointNumber: number
  color: string
  swatchSide: EyedropperPoint["swatchSide"]
  onSetSide: (side: EyedropperPoint["swatchSide"]) => void
  onRemove: () => void
}

export default function PointPanel({ pointNumber, color, swatchSide, onSetSide, onRemove }: Props) {
  return (
    <section data-testid="point-panel">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Point #{pointNumber}
      </h3>

      <div className="flex items-center gap-2 mb-3">
        <span
          data-testid="point-color-preview"
          className="inline-block w-6 h-6 rounded border border-[var(--color-border)]"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-[var(--color-text-primary)] font-mono">{color}</span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Swatch side
      </p>
      <div className="flex flex-wrap gap-1 mb-3">
        {SIDES.map((side) => (
          <button
            key={side}
            onClick={() => onSetSide(side)}
            aria-pressed={swatchSide === side}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              swatchSide === side
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            {side}
          </button>
        ))}
      </div>

      <button
        onClick={onRemove}
        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white text-red-600 hover:border-red-600 transition-colors"
      >
        × Remove this point
      </button>
    </section>
  )
}
```

- Highlight: the button whose `side === swatchSide` gets the accent bg + white text; `aria-pressed` gives the test a clean, semantic hook for "which side is current".
- Keep the hex `color` rendered verbatim (it's already a `#rrggbb` string from `sampleColor`); no formatting/uppercasing required.

### `EyedropperLayer` click-to-select (AC 1, 4) — cancelBubble is load-bearing

Add `onClick` to BOTH circles, INSIDE the existing `interactionMode === "select"` spread (so it is absent in add mode, where clicks must fall through to the Stage to add a point):

```tsx
onClick: (e: KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true
  onSelectPoint(p.id)
},
```

Why `cancelBubble`: the Stage's select-mode `onClick` calls `onDeselect()`. Konva click events bubble shape → layer → stage, so without `e.cancelBubble = true` a swatch/marker click would select AND then immediately deselect when it reaches the Stage. Setting `cancelBubble` stops propagation to the Stage, so a shape click selects and an empty-area click (which never hits a shape with the handler) deselects. This is the idiomatic Konva equivalent of `stopPropagation` (the 2.6 `ContextMenu` used the DOM `stopPropagation` for the analogous reason).

Design choice — selecting on the MARKER too (not just the swatch): AC1 says "click a swatch circle → selects" and AC4 says clicking "not a marker or swatch" deselects, which implies a marker click must NOT deselect. The cleanest way to honor both is to attach the same select `onClick` to the marker as well as the swatch — a marker click selects its point (intuitive, and it satisfies AC4 by canceling bubble). Document this in Completion Notes (same spirit as 2.6's "right-click works in both modes" note).

`KonvaEventObject` is already imported in `EyedropperLayer.tsx`. A click after an actual drag is suppressed by Konva (drag sets an internal flag), so dragging a swatch/marker will NOT also fire select — no conflict with the Story 2.4/2.5 drag handlers.

### `Canvas` Stage onClick — both modes (AC 4)

Replace the add-only `onClick` with a both-modes handler:

```tsx
onClick={(e: KonvaEventObject<MouseEvent>) => {
  if (interactionMode === "add") {
    // Konva synthesizes a click for any mouse button; only primary adds.
    if (e.evt.button !== 0) return
    const pos = e.target.getStage()?.getRelativePointerPosition()
    if (pos) onAddPoint(pos.x, pos.y)
  } else {
    // Select mode: only empty-area clicks reach the Stage (swatch/marker
    // clicks set cancelBubble), so this is the "click empty canvas" deselect.
    onDeselect()
  }
}}
```

- The handler is now unconditionally attached (no `interactionMode === "add" ? … : undefined`). That's fine: the select branch only does work on bubbled (empty-area) clicks.
- Background `Rect` and `KonvaImage` are plain shapes with no `onClick` + no `cancelBubble`, so clicking the image or the 9:16 padding bubbles to the Stage and deselects — matching AC4 "empty canvas space (not a marker or swatch)".

### Coordinate system / refs recap (unchanged from 2.3–2.6)

- Stage scaled by `scale = displayWidth / canvasLayout.canvasWidth`. `getRelativePointerPosition()` returns logical canvas-space coords (transform-aware) — still only needed by the add-point branch, untouched here.
- `EditorShell` refs to read from in `[]`-dep callbacks: `canvasLayoutRef`. `handleSetSide` reads `canvasLayoutRef.current` exactly like the drag handlers.

### Test guidance

**Konva mock note (EyedropperLayer.test.tsx, Canvas.test.tsx):** react-konva renders to a canvas jsdom can't introspect, so both files mock react-konva to DOM elements and wire Konva callbacks to DOM events. Follow each file's existing conventions exactly.

**`EyedropperLayer.test.tsx`** — extend the existing `Circle` mock to accept and wire `onClick`. Build a fake Konva event with a mutable `cancelBubble` so the test can assert the handler set it:
```tsx
// add onClick to the destructured Circle props, then in the rendered <div>:
onClick={(domEvt) => {
  domEvt.stopPropagation?.()
  const evt = { evt: { button: 0 }, cancelBubble: false }
  onClick?.(evt)
  // optionally expose evt.cancelBubble for assertion via a module-scope recorder
}}
```
Because the real handler does `e.cancelBubble = true` (a property on the event object, not `e.evt`), record the event object (e.g. a module-scope `lastClickEvent`) so a test can assert `lastClickEvent.cancelBubble === true`. Tests (swatch = `circles[0]`, ring marker = `circles[circles.length - 1]`, per the existing index convention):
- select mode: `fireEvent.click(swatch)` → `onSelectPoint` called with `"p1"`; recorded event `cancelBubble === true`
- select mode: `fireEvent.click(ringMarker)` → `onSelectPoint` called with `"p1"`
- add mode: the Circle mock should report no `onClick` wired (mirror the existing `data-has-hover` pattern with a `data-has-click` attribute) — assert `data-has-click === "false"` in add mode and `"true"` in select mode

Add to `DEFAULT_PROPS`: `onSelectPoint: vi.fn()`.

**`Canvas.test.tsx`** — the existing Stage mock fires `onClick` with `{ evt: { button }, target: {...} }`. Add `cancelBubble: false` to that fake event object (the select branch ignores it, but keep parity with real Konva). Tests:
- select mode: Stage has `data-has-click="true"`; firing click calls `onDeselect` and does NOT call `onAddPoint`
- add mode: firing click calls `onAddPoint(33, 77)` and does NOT call `onDeselect` (existing add tests stay green)

Add to `makeProps`: `onSelectPoint: vi.fn()`, `onDeselect: vi.fn()`.

**`PointPanel.test.tsx`** (NEW) — plain RTL (no Konva):
- renders heading text containing "Point #3" for `pointNumber={3}`
- renders the hex string (e.g. `#8b5e52`) and a preview element whose inline `background-color` is the point color (assert via `getByTestId("point-color-preview")` style)
- renders 5 buttons labeled `auto`/`left`/`right`/`top`/`bottom`; the one matching `swatchSide` has `aria-pressed="true"` (others `"false"`)
- clicking the `right` button calls `onSetSide("right")`
- clicking "× Remove this point" calls `onRemove`

### Testing the EditorShell logic

`handleSetSide` is a thin `map` + `assignSwatchLayout` (the latter is already covered by `swatch-layout.test.ts`, including "manual swatchSide !== 'auto' is respected"). Selection state is plain `useState`. Following the Story 2.6 review precedent (untested EditorShell branches were flagged), the new behavior is covered by: the `PointPanel` component tests (panel content + callbacks), the `EyedropperLayer` click→select wiring, and the `Canvas` deselect wiring. Do NOT stand up the whole `EditorShell` (image load + Konva) just to test selection. If you find yourself adding genuinely new branching logic beyond the snippets above (e.g. a non-trivial point-number or side-mapping transform), extract it as a pure exported helper (like `canvasClickToImagePoint` from 2.6) and unit-test it.

### Project structure / conventions

- Tailwind v4 — no config file; arbitrary values with CSS variables: `bg-[var(--color-bg)]`, `border-[var(--color-border)]`, `text-[var(--color-text-primary)]`, `bg-[var(--color-accent)]`. Tokens in `app/globals.css`. (`text-red-600`/`border-red-600` are stock Tailwind utilities — fine for the destructive Remove button, matching the `suggestError` red text already in `index.tsx`.)
- Vitest + React Testing Library; co-located `*.test.tsx` next to the component (per `docs/project-context.md`).
- New components are client components — start with `"use client"`.
- Konva event types: import `KonvaEventObject` from `konva/lib/Node` (already imported in `EyedropperLayer.tsx` and `Canvas.tsx`). Konva v10.3.0, react-konva v19.2.5, React 19.1.0, Next 15.5.19.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7: Point Selection & Right Panel State] — the 4 acceptance criteria (FR15).
- [Source: docs/SPEC.md#Eyedropper points (Konva layer)] — "Click swatch → selects it (shows options in right panel)".
- [Source: docs/UI.md#Right sidebar (~280px)] — "Point selected" panel: Point #N, Color ████ #hex, "Swatch side [auto][left][right][top][bottom]", "[× Remove this point]", then Export. Default = Export only (AC overrides UI.md's extra "(nothing selected)" placeholder).
- [Source: components/Editor/index.tsx:331-371] — existing `handleAddPoint`/`handleRemovePoint`/`handleRequestRemove` and the `canvasLayoutRef` `[]`-dep pattern to mirror for `handleSetSide`.
- [Source: components/Editor/index.tsx:459-478] — Select/Add toggle buttons: the accent-highlight active-state class pattern to reuse for the side buttons.
- [Source: components/Editor/index.tsx:526-537] — current right `<aside>` (Export only) — where `<PointPanel>` is inserted above Export.
- [Source: components/Editor/EyedropperLayer.tsx:98-141, 144-180] — swatch + ring-marker `Circle`s and the `interactionMode === "select"` conditional-spread where `onClick` is added.
- [Source: components/Editor/Canvas.tsx:68-79] — current add-only Stage `onClick`; extend to both modes.
- [Source: lib/swatch-layout.ts:5-57] — `assignSwatchLayout` (respects explicit side, reassigns "auto"); re-run by `handleSetSide`.
- [Source: components/Editor/ContextMenu.tsx] — the 2.6 presentational-overlay precedent for `PointPanel`'s structure/tokens; the `stopPropagation` precedent that `cancelBubble` mirrors on the canvas side.
- [Source: _bmad-output/implementation-artifacts/2-6-add-and-remove-points.md] — `handleRemovePoint` (reused by AC3); the Story 2.5/2.6 "update all `makeProps`/`DEFAULT_PROPS` when adding required props or tsc/CI breaks" lesson.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Story 2.2 notes: `pointIdCounter` HMR reset and `runSuggest` blind `setPoints` replace — both inform the stale-selection guard (resolve `selectedPointId` via `points.find`, don't trust it directly).

### Project Structure Notes

- New files land under `eyedropper-web/components/Editor/` — `PointPanel.tsx` is a new sibling of `ContextMenu.tsx`/`Canvas.tsx`, consistent with the Editor component grouping. (ARCHITECTURE.md lists a top-level `LabelPanel.tsx` for the *label* controls of Epic 3; the point-selection panel is editor-local and follows the `ContextMenu` precedent.)
- No new `lib/` helper — selection reuses `assignSwatchLayout` and existing state. Do not introduce parallel layout logic.
- No conflicts with the unified structure detected.

## Review Findings

_Code review 2026-06-15 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 4 ACs verified fully met; all scope guards honored; 156 tests passing, tsc clean._

- [x] [Review][Decision] Switching select→add mode leaves the right panel open on a point that can no longer be deselected by clicking [`components/Editor/index.tsx:491,501,564`] — Resolved 2026-06-15: leave as-is (intended). Panel remains editable in add mode by design; no AC covers mode-switch deselection. Dismissed.
- [x] [Review][Patch] `runSuggest` does not clear `selectedPointId` on the blind point-replace, leaving a dangling stale id [`components/Editor/index.tsx:190`] — FIXED 2026-06-15: added `setSelectedPointId(null)` at the top of `runSuggest`. tsc clean, 156 tests passing.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx tsc --noEmit` initially failed on the new `lastClickEvent` recorder in `EyedropperLayer.test.tsx`: the reset assignment `lastClickEvent.evt = null` narrowed the type to `never`, making `.cancelBubble` unreachable. Fixed by typing the recorder to hold the full Konva click event object (`{ evt: { button }, cancelBubble }`) and dropping the unnecessary reset (each test fires its own click before asserting).

### Completion Notes List

- All 4 ACs satisfied. Selection is a single `selectedPointId: string | null` local `useState` in `EditorShell` (no multi-select, no `EditorState` object per Dev Notes). Stale-selection guard implemented at render time via `points.find` — a dangling id after a re-suggest renders the default (Export-only) panel.
- **Marker click also selects** (not just the swatch): the same select `onClick` is attached to both the swatch and ring-marker circles. This honors AC4 ("clicking not a marker or swatch deselects" → a marker click must NOT deselect) by canceling bubble on either shape. Same spirit as Story 2.6's "right-click works on both shapes" note.
- **`cancelBubble` is load-bearing**: shape `onClick` sets `e.cancelBubble = true` so a swatch/marker click does not propagate to the Stage's select-mode `onClick` (which calls `onDeselect`). Empty-area clicks (background `Rect` / `KonvaImage` / 9:16 padding — none have `onClick`) bubble to the Stage and deselect.
- **Stage `onClick` is now attached unconditionally** (both modes). Add mode keeps the primary-button-guarded add behavior; select mode calls `onDeselect()` only on bubbled empty-area clicks. The existing `Canvas.test.tsx` "select mode has no add-click handler" test was updated accordingly (it now asserts deselect-on-click + no add).
- **NO canvas visual change for selection** (scope guard honored): no halo/highlight ring added; `EyedropperLayer` only received the `onSelectPoint` callback, not `selectedPointId`.
- **Doc drift noted (UI.md vs AC):** UI.md's mock shows a "Selected point / (nothing selected)" placeholder block in the default state, but AC4 says the default state shows "only the Export section". Followed the AC — no placeholder block rendered.
- Tests: baseline 147 → 156 passing (+9: 5 new `PointPanel`, 4 new `EyedropperLayer` click tests; `Canvas` net 0 — one existing test rewritten for the both-modes Stage handler). `npx tsc --noEmit` clean. No `lint` script exists in `package.json`; tsc is the static check per project convention.

### File List

- `eyedropper-web/components/Editor/PointPanel.tsx` (NEW)
- `eyedropper-web/components/Editor/PointPanel.test.tsx` (NEW)
- `eyedropper-web/components/Editor/index.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/Canvas.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/Canvas.test.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — status tracking)

### Change Log

- 2026-06-15 — Implemented point selection & right-panel state (Story 2.7). New `PointPanel` component; `selectedPointId` state + `handleSelectPoint`/`handleDeselect`/`handleSetSide` in `EditorShell`; click-to-select on swatch + marker (cancelBubble) in `EyedropperLayer`; both-modes Stage `onClick` (add / deselect) in `Canvas`. Tests 147 → 156, tsc clean. Status → review.
