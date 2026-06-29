# Story 3.3: Label Dragging & Per-Label Controls

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to drag labels freely on the canvas and control their font, size, color, and visibility individually,
so that I can achieve a polished, publication-ready layout.

## Acceptance Criteria

1. **Given** I am in label editing mode **when** I drag a label on the canvas (via its drag handle — see Dev Notes "Drag mechanism") **then** it moves freely to any position within the canvas bounds; its `label.x` and `label.y` are updated in state and the label re-renders at the new position immediately.

2. **Given** I select a point (click its swatch) while in label editing mode **when** the right sidebar renders **then** it shows the label controls instead of the `PointPanel` swatch-side controls: a text input (pre-filled with `label.text`), a font family dropdown (6 options: 5 Google Font presets + System), a font size slider (12–48px), a color picker, and a "Show label" checkbox — followed by the Export section. (The "Apply to all labels" buttons are **Story 3.4**, NOT this story.)

3. **Given** I change the font family for a selected point's label **when** the dropdown value changes **then** `label.fontFamily` updates and the canvas label (the on-canvas edit field) re-renders with the new font immediately.

4. **Given** I move the font size slider **when** the slider value changes **then** `label.fontSize` updates and the canvas label re-renders at the new size immediately.

5. **Given** I change the label color **when** the color picker value changes **then** `label.color` updates and the canvas label re-renders with the new color immediately.

6. **Given** I uncheck "Show label" **when** the checkbox changes **then** `label.visible` is set to `false`, the label is hidden on the canvas (no edit field in edit mode, no static `<Text>` in display mode) and excluded from export (export renders the Konva stage, which already skips invisible labels via `LabelLayer`).

7. **Given** the font presets are loaded **when** the font family dropdown renders **then** it lists exactly, in this order: **Cormorant Garamond Italic** (default), **Playfair Display Italic**, **Inter**, **DM Serif Display**, **Libre Baskerville Italic**, and **System**; the 5 Google Fonts are loaded via `next/font/google` and applied so the on-canvas label renders in the chosen font.

## Tasks / Subtasks

- [x] Task 1: Load the 5 Google Font presets via `next/font` (`lib/fonts.ts` NEW + `app/layout.tsx` MODIFY) (AC: 7, 3)
  - [x] Create `lib/fonts.ts`. Call `next/font/google` at module scope (literal args only — `next/font` requires statically-analyzable calls) for the 5 presets with the correct style/weight:
    - `Cormorant_Garamond({ weight: "500", style: "italic", subsets: ["latin"], variable: "--font-cormorant", display: "swap" })`
    - `Playfair_Display({ style: "italic", subsets: ["latin"], variable: "--font-playfair", display: "swap" })`
    - `Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })`
    - `DM_Serif_Display({ weight: "400", subsets: ["latin"], variable: "--font-dm-serif", display: "swap" })`
    - `Libre_Baskerville({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-libre", display: "swap" })`
  - [x] Export a `FONT_OPTIONS: { label: string; family: string }[]` array in this exact order: Cormorant Garamond Italic, Playfair Display Italic, Inter, DM Serif Display, Libre Baskerville Italic, System. For each Google font set `family` to the next/font object's `.style.fontFamily` (the resolved `@font-face` family string — what Konva/CSS must use to render it). For **System** set `family: "serif"` (device default serif per UX-DR12 / `docs/UI.md:167`).
  - [x] Export `resolveFontFamily(label: string): string` — looks up `FONT_OPTIONS` by `label`, returns its `family`; falls back to the passed string (or `"serif"`) if not found. This maps the stored human-readable `label.fontFamily` ("Cormorant Garamond Italic") to the actual render family. Keep it pure.
  - [x] Also export the 5 font objects (or just their `.variable`) so `layout.tsx` can attach the CSS variables.
  - [x] `app/layout.tsx`: import the 5 font `.variable` class names from `lib/fonts.ts` and append them to the `<body>` `className` (alongside the existing `geistSans.variable`/`geistMono.variable`). This makes the `@font-face` rules available document-wide so the canvas can render them. Do NOT change the Geist setup or `globals.css` token block.

- [x] Task 2: Position labels from `label.x`/`label.y` (source-of-truth switch) (`LabelLayer.tsx` + `LabelEditOverlay.tsx` MODIFY) (AC: 1, 3, 4, 5, 6, 7)
  - [x] **Current behavior:** both `LabelLayer` and `LabelEditOverlay` recompute the label position every render via `getSwatchPos(...)` → `getLabelPosition(...)`, ignoring `label.x`/`label.y`. For draggable labels the **stored `label.x`/`label.y` must become the source of truth** (they are already seeded on edit-mode entry by `handleToggleLabelEdit`, `index.tsx:401–427`, via `getLabelPosition`).
  - [x] `LabelLayer.tsx`: render each `<Text>` at `x={p.label.x} y={p.label.y}` instead of the computed `labelPos`. Remove the now-unused `getSwatchPos`/`getLabelPosition` calls **and their imports** from this file (orphan cleanup — your change makes them unused here). Map the font: `fontFamily={resolveFontFamily(p.label.fontFamily)}` (import `resolveFontFamily` from `@/lib/fonts`). Keep every existing guard exactly (`labelPosition === "none"` → nothing; `swatchOrder === null` skip; `!label.visible` skip; `label.text === ""` skip) and keep `align`/`listening={false}`.
  - [x] `LabelEditOverlay.tsx`: position the field from `label.x`/`label.y` → `left: p.label.x * scale, top: p.label.y * scale`. Remove the `getSwatchPos`/`getLabelPosition` calls and imports here too (orphaned by this change). Set the input's CSS `fontFamily: resolveFontFamily(p.label.fontFamily)` so the on-canvas field shows the chosen font (AC3, WYSIWYG). The `canvasWidth`/`canvasHeight` props stay (Task 3 drag-clamp needs them).
  - [x] Note: `getLabelPosition` (`lib/label-layout.ts`) is STILL used by `handleToggleLabelEdit` to seed `label.x/y` on entry — do NOT delete it or its test. Only the two render components stop calling it.

- [x] Task 3: Add a drag handle to each on-canvas label and wire free dragging (`LabelEditOverlay.tsx` MODIFY + `index.tsx`/`Canvas.tsx` plumbing) (AC: 1)
  - [x] **Drag mechanism (confirmed with the artist): a drag handle (grip) next to each editable input.** Keep the controlled `<input>` for typing; render a small grip element (e.g. `⠿`, an `aria-label="Drag label N"` button/span) immediately left of the input inside a per-label wrapper `<div style={{ position: absolute, left: x*scale, top: y*scale, display: flex, pointer-events: auto }}>`. The input keeps `pointer-events: auto`; the wrapper container around all labels keeps `pointer-events: none` (so empty regions pass clicks to the canvas — preserve the existing outer-container behavior from 3.2).
  - [x] Implement dragging on the **grip only** using pointer events (no new dependency): `onPointerDown` → `e.currentTarget.setPointerCapture(e.pointerId)`, record the start screen point and the label's start `(label.x, label.y)` in a `useRef`; `onPointerMove` (while captured) → convert the screen delta to canvas space (`deltaCanvas = deltaScreen / scale`), compute `newX/newY`, **clamp to `[0, canvasWidth] × [0, canvasHeight]`**, and call `onUpdateLabelPos(p.id, newX, newY)`; `onPointerUp` → release capture and clear the drag ref. Clicking the input still focuses it for typing (grip and input are separate targets).
  - [x] `LabelEditOverlay` Props: ADD `onUpdateLabelPos: (id: string, x: number, y: number) => void`. Keep `onUpdateLabelText`. The grip needs `cursor: move` styling.
  - [x] `Canvas.tsx`: add `onUpdateLabelPos` to `CanvasProps` and pass it through to `<LabelEditOverlay>` (it already passes `onUpdateLabelText`, `scale`, `canvasWidth`, `canvasHeight`).
  - [x] `index.tsx`: add `onUpdateLabelPos={handleUpdateLabelPos}` to the `<Canvas>` prop list (Task 5 defines the handler).

- [x] Task 4: Build the right-panel label controls (`components/Editor/LabelPanel.tsx` NEW) (AC: 2, 3, 4, 5, 6, 7)
  - [x] NEW `"use client"` component, editor-local (sibling of `PointPanel.tsx` — see Dev Notes "LabelPanel placement" for the ARCHITECTURE variance). Mirror `PointPanel`'s markup conventions (section heading style, Tailwind CSS-variable tokens, `aria-pressed` where relevant).
  - [x] Props: `{ label: EyedropperPoint["label"]; onUpdate: (patch: Partial<EyedropperPoint["label"]>) => void }`. The parent binds `onUpdate` to the selected point (Task 5). A single `onUpdate(patch)` keeps the surface minimal (one handler, partial merge) rather than five callbacks.
  - [x] Controls, top to bottom (per `docs/UI.md:127–148`), MINUS the "Apply to all labels" block (Story 3.4):
    - **Label** heading + text `<input>`: `value={label.text}`, `onChange → onUpdate({ text: e.target.value })`. `aria-label="Label text"`.
    - **Font** `<select>`: options from `FONT_OPTIONS.map(o => o.label)`; `value={label.fontFamily}` (stored value is the option **label**, e.g. "Cormorant Garamond Italic"); `onChange → onUpdate({ fontFamily: e.target.value })`. `aria-label="Font family"`.
    - **Size** `<input type="range" min={12} max={48}>`: `value={label.fontSize}`, `onChange → onUpdate({ fontSize: Number(e.target.value) })`; show the px value next to it. `aria-label="Font size"`.
    - **Color** `<input type="color">`: `value={label.color}`, `onChange → onUpdate({ color: e.target.value })`. `aria-label="Label color"`. (Note: `<input type=color>` requires a 6-digit hex; `label.color` defaults to `#1a1a1a` — valid.)
    - **Show label** `<input type="checkbox">`: `checked={label.visible}`, `onChange → onUpdate({ visible: e.target.checked })`. `aria-label="Show label"` (or a `<label>Show label</label>` wrapping it).
  - [x] Do NOT add the swatch-side / Point # / Remove controls (those stay in `PointPanel`). Do NOT add Apply-to-all (Story 3.4).

- [x] Task 5: Wire state + right-panel switching in `EditorShell` (`components/Editor/index.tsx` MODIFY) (AC: 1, 2, 3, 4, 5, 6)
  - [x] Replace `handleUpdateLabelText` with a single general `handleUpdateLabel = useCallback((id: string, patch: Partial<EyedropperPoint["label"]>) => { setPoints(prev => prev.map(p => p.id === id ? { ...p, label: { ...p.label, ...patch } } : p)) }, [])`. Spread `label` to preserve untouched fields (same pattern the old handler used).
  - [x] Rewire the existing `<Canvas onUpdateLabelText=...>` prop to delegate: `onUpdateLabelText={(id, text) => handleUpdateLabel(id, { text })}` — keeps the `Canvas`/`LabelEditOverlay` `onUpdateLabelText(id, text)` API unchanged (so 3.2's overlay tests still pass) while removing the redundant dedicated handler.
  - [x] Add `handleUpdateLabelPos = useCallback((id: string, x: number, y: number) => handleUpdateLabel(id, { x, y }), [handleUpdateLabel])` and pass `onUpdateLabelPos={handleUpdateLabelPos}` to `<Canvas>`.
  - [x] **Right sidebar switching:** currently the right `<aside>` renders `{selectedPoint && <PointPanel .../>}` then the Export `<section>`. Change to: when `selectedPoint` AND `labelEditMode` → render `<LabelPanel label={selectedPoint.label} onUpdate={(patch) => handleUpdateLabel(selectedPoint.id, patch)} />`; when `selectedPoint` AND `!labelEditMode` → render `<PointPanel .../>` (unchanged); when no selection → neither (just Export). Per `docs/UI.md:127–148`, label-edit mode with a point selected shows the Label controls **instead of** the swatch-side panel.
  - [x] Import `LabelPanel` from `./LabelPanel`. Do NOT remove the `PointPanel` import or its render path.

- [x] Task 6: Write tests (AC: all)
  - [x] `lib/fonts.test.ts` (NEW): assert `FONT_OPTIONS` has 6 entries in the exact AC7 order with the right labels; `FONT_OPTIONS[0].label === "Cormorant Garamond Italic"`; the last is `{ label: "System", family: "serif" }`; `resolveFontFamily("System")` → `"serif"`, `resolveFontFamily("Cormorant Garamond Italic")` → a non-empty string, `resolveFontFamily("nonexistent")` → falls back (the input or `"serif"`). **Mock `next/font/google`** so the test runs without network/build: `vi.mock("next/font/google", () => ({ Cormorant_Garamond: () => ({ style: { fontFamily: "Cormorant" }, variable: "--font-cormorant" }), /* …one stub per font… */ }))`. (See Dev Notes "Testing next/font".)
  - [x] `components/Editor/LabelPanel.test.tsx` (NEW): plain RTL (no Konva). Render with a sample `label`. Assert: text input pre-filled with `label.text` and typing calls `onUpdate({ text })` (AC2); font `<select>` lists 6 options in order and shows `label.fontFamily`, changing it calls `onUpdate({ fontFamily })` (AC3, AC7); range input min=12/max=48/value=`label.fontSize`, changing calls `onUpdate({ fontSize: <number> })` (AC4); color input value=`label.color`, changing calls `onUpdate({ color })` (AC5); checkbox `checked` mirrors `label.visible`, toggling calls `onUpdate({ visible: false })` (AC6). Mock `@/lib/fonts` (or its `next/font` import) the same way as `fonts.test.ts` so the component's `FONT_OPTIONS` import resolves without the real `next/font`.
  - [x] `components/Editor/LabelEditOverlay.test.tsx` (MODIFY): (a) the existing **"positions each input at labelPos * scale"** test now breaks — the field is positioned from `label.x`/`label.y`, not the computed `getLabelPosition`. Update it: set `makePoint` with known `label.x`/`label.y` and assert `left === x*scale`, `top === y*scale`. (b) ADD a drag test: render with a known `scale`, `fireEvent.pointerDown` on the grip (query by `aria-label="Drag label 1"`), `pointerMove` by a known screen delta, assert `onUpdateLabelPos` called with `(id, startX + delta/scale, startY + delta/scale)`; ADD a clamp test (drag past `canvasWidth`/0 → clamped). (c) ADD a required `onUpdateLabelPos: vi.fn()` to the shared render props so existing cases still compile. `setPointerCapture`/`releasePointerCapture` don't exist in jsdom — stub them on the element or guard the call with `?.` (see Dev Notes).
  - [x] `components/Editor/LabelLayer.test.tsx` (MODIFY): the existing tests assert on `data-text`/`data-fill`/`data-fontsize`/count — those still pass (position isn't asserted). ADD: a point with distinct `label.x`/`label.y` renders a `<Text>` at `data-x={label.x}`/`data-y={label.y}` (extend the mock to expose them if not already — it already maps `data-x`/`data-y`); a `label.visible: false` point still renders no `<Text>` (AC6, already covered — keep). Add `resolveFontFamily` mock if `@/lib/fonts` import needs it (mock `next/font/google` as above).
  - [x] `components/Editor/Canvas.test.tsx` (MODIFY): add the new required `onUpdateLabelPos: vi.fn()` to `makeProps()` so every `Canvas` render still compiles (recurring "update props when you add a required prop" lesson — 2.5/2.6/2.7/3.1/3.2). The `LabelLayer`/`LabelEditOverlay` mocks stay; no behavior assertion change needed.
  - [x] Run `npm test` — all pass, no regressions (baseline: **195 passing, 19 files** as of Story 3.2's review). Report the new totals.
  - [x] Run `npx tsc --noEmit` — clean. New required props (`Canvas.onUpdateLabelPos`, `LabelEditOverlay.onUpdateLabelPos`) must be threaded through every caller/test.

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from there. Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1. **No new runtime dependencies** — fonts come from `next/font/google` (built into Next), dragging uses native Pointer Events, all controls are plain HTML (`<select>`, `<input type=range|color|checkbox>`). Do NOT add `react-konva-utils`, `react-color`, a slider lib, or a font-loader package.

### Scope — what this story IS and IS NOT

This story completes the **per-label editing surface**: drag a label freely (grip handle), and a right-panel control set (text / font / size / color / show) for the selected point, with the 5 Google fonts actually loaded.

**IN scope (7 ACs):** label dragging via grip → `label.x/y`; right-panel `LabelPanel` with text input, font dropdown (6 options), size slider (12–48), color picker, "Show label" checkbox; live re-render on each control; `next/font` loading of the 5 presets; switching the right panel to label controls when a point is selected in edit mode.

**OUT of scope — explicitly deferred (do NOT build):**
- **Apply-to-all label controls** ("Font" / "Size" / "Color" buttons in `docs/UI.md:142–143`) → **Story 3.4**. Do NOT add them to `LabelPanel`.
- **Export** (`stage.toDataURL`, `/api/export`, Download wiring) → **Epic 4 / Story 4.1**. AC6's "excluded from export" is satisfied passively (invisible labels are already skipped by `LabelLayer`); do NOT build any export logic here. `ExportButton` stays the placeholder it is.
- **Free-floating, push-aside swatches** and **custom user styles** → future epics (`deferred-work.md`). Untouched here — this story moves *labels*, not swatches.
- Re-seeding `label.x/y` when a point is added during edit mode, or on style switch while in edit mode — pre-existing gap from 3.2 (the seed runs only on OFF→ON edit toggle). Not in this story's ACs; leave as-is (note it if you want, but do not expand scope).

### Drag mechanism — grip handle + Pointer Events (AC1)

Decision (confirmed with the artist): each on-canvas label is the **editable `<input>` from 3.2** with a **drag handle (grip) beside it**. Drag the grip to move; click the field to type. This keeps inline editing (SPEC §"Label Editing": "editable text field next to it on the canvas") and gives unambiguous drag-vs-type separation — no movement-threshold heuristic, easy to test.

Mechanics (no library; native Pointer Events on the grip):
- Wrap each label in a per-label `<div style={{ position: "absolute", left: label.x*scale, top: label.y*scale, display: "flex", alignItems: "center", gap: 2, pointerEvents: "auto" }}>`. The OUTER container keeps `pointerEvents: "none"` (3.2 behavior — empty regions pass clicks to the canvas).
- Grip: a small element (`⠿` / `≡`) with `cursor: "move"`, `aria-label={`Drag label ${i + 1}`}`. On `onPointerDown`: `e.currentTarget.setPointerCapture?.(e.pointerId)`, store `{ pointerId, startScreenX: e.clientX, startScreenY: e.clientY, startX: label.x, startY: label.y }` in a `useRef`. On `onPointerMove` (only if a drag is active for this pointer): `const nx = clamp(startX + (e.clientX - startScreenX)/scale, 0, canvasWidth)`, `const ny = clamp(startY + (e.clientY - startScreenY)/scale, 0, canvasHeight)`, `onUpdateLabelPos(p.id, nx, ny)`. On `onPointerUp`: `releasePointerCapture?.(...)`, clear the ref.
- Canvas-space ↔ screen-space: the stage is drawn at `scaleX/scaleY = scale` (`Canvas.tsx:57`), so screen px = canvas px × `scale` and a screen delta ÷ `scale` = canvas delta. This is the same scale relationship 3.2 used to position the inputs.
- Clamp to `[0, canvasWidth] × [0, canvasHeight]` (AC1 "within the canvas bounds"). A tiny overflow at the far edge (the input has width) is acceptable — clamp the anchor, not the input's right edge (mirrors `getLabelPosition`'s anchor-clamp).

### Source of truth: `label.x`/`label.y` (Task 2 — why both render paths change)

3.2 seeds `label.x/y` on edit-mode entry (`handleToggleLabelEdit`) but both `LabelLayer` and `LabelEditOverlay` *recompute* the position from the swatch every render (ignoring `label.x/y`). Dragging is impossible until the rendered position actually reads the dragged `label.x/y`. So both components switch to `x={label.x} y={label.y}` (Konva) / `left: label.x*scale` (HTML). `getLabelPosition` remains the **seed** function (called once on toggle); the components become pure consumers of `label.x/y`. This also makes display-mode labels (after exiting edit mode) stay where they were dragged — the intended behavior.

### Fonts via `next/font` (AC7, AC3)

- `next/font/google` calls must be at module scope with **literal** arguments (build-time analyzed). Put them in `lib/fonts.ts`.
- Konva draws text on a `<canvas>`; it uses whatever `fontFamily` string you pass and the browser's loaded fonts. So the stored `label.fontFamily` (human label, e.g. "Cormorant Garamond Italic") must be mapped to the **resolved `@font-face` family** (`fontObj.style.fontFamily`) at render time → `resolveFontFamily`. The HTML `<input>` overlay should use the resolved family too (WYSIWYG).
- Apply each font's `.variable` to `<body>` in `layout.tsx` so the `@font-face` rules exist document-wide (Geist already does this — follow the same pattern, just append).
- **Known Konva + webfont caveat (acceptable for this story, do not over-engineer):** Konva measures/draws text immediately; if a webfont isn't loaded yet it draws with the fallback and won't auto-redraw when the font arrives. With `display: "swap"` the font swaps in CSS, but the Konva `<Text>` node may not repaint until the next state change. The on-canvas **edit field** is real HTML and updates correctly; the static `LabelLayer` `<Text>` is the only one with the lag, and any subsequent edit repaints it. A `document.fonts.ready`-triggered redraw is **optional polish — defer it** (note in Completion Notes / `deferred-work.md` if you skip it). Do NOT add a `FontFaceObserver` dependency.
- The italic presets need `style: "italic"`; Cormorant Garamond needs an explicit `weight` (it's a variable/multi-weight family — pick `"500"`), DM Serif Display and Libre Baskerville need `weight: "400"`. Inter is variable (no `weight` needed). If `npx tsc`/Next complains a font requires a `weight`, add the documented weight — do not switch the font.

### State model — discrete `useState`, general label updater

`EditorShell` keeps runtime state in discrete `useState`/`useRef` (confirmed 2.7/3.1/3.2). `labelEditMode` already exists (`index.tsx:148`). Add NO new top-level state for this story — the controls mutate `points[].label` through the new general `handleUpdateLabel(id, patch)`. Do NOT add anything to the `EditorState` interface in `lib/types.ts` (`EyedropperPoint.label` already has every field: `text/visible/x/y/fontSize/fontFamily/color`, `lib/types.ts:17–25`). Do NOT modify `lib/types.ts`.

`handleUpdateLabel` replaces `handleUpdateLabelText` (identical merge logic, generalized to a partial). The `Canvas`/`LabelEditOverlay` `onUpdateLabelText(id, text)` prop API stays — `index.tsx` adapts it (`(id, text) => handleUpdateLabel(id, { text })`) so 3.2's overlay tests are untouched.

### Right-panel switching (AC2)

The right `<aside>` (`index.tsx:631–650`) currently renders `{selectedPoint && <PointPanel .../>}` then Export. New rule (per `docs/UI.md`):
- `selectedPoint && labelEditMode` → `<LabelPanel .../>`
- `selectedPoint && !labelEditMode` → `<PointPanel .../>` (unchanged)
- no selection → just Export

So entering label-edit mode and clicking a swatch swaps the swatch-side panel for the label-controls panel. `PointPanel` is NOT removed — it's the non-edit-mode panel. Note selection is independent of label visibility: you select via the swatch (`EyedropperLayer`), so an invisible-label point is still selectable and its "Show label" checkbox re-enables it.

### LabelPanel placement — ARCHITECTURE variance (documented, deliberate)

`docs/ARCHITECTURE.md:24` lists `components/LabelPanel.tsx` (root). However, this component is the right-panel **per-selected-point** control set — functionally the twin of `PointPanel.tsx`, which lives at `components/Editor/PointPanel.tsx`. Place `LabelPanel.tsx` **editor-local** (`components/Editor/`) for consistency with its sibling and because the dev wires it directly beside `PointPanel` in `index.tsx`'s right sidebar. (ARCHITECTURE is aspirational — it also lists `useEyedroppers.ts`, never created, and `LabelLayer.tsx` "Draggable text labels" which is editor-local.) This is a conscious, consistent choice — not a structure violation.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/fonts.ts` | does not exist | NEW — `next/font/google` for 5 presets; `FONT_OPTIONS` (6, ordered); `resolveFontFamily`; export `.variable`s |
| `lib/fonts.test.ts` | does not exist | NEW — `FONT_OPTIONS` order/labels, `resolveFontFamily`; mock `next/font/google` |
| `app/layout.tsx` | Geist fonts only | MODIFY — append the 5 font `.variable` classes to `<body>` |
| `components/Editor/LabelLayer.tsx` | `<Text>` at computed `labelPos`; imports `getSwatchPos`/`getLabelPosition` | MODIFY — render at `label.x/y`; `fontFamily=resolveFontFamily(...)`; drop now-unused imports |
| `components/Editor/LabelEditOverlay.tsx` | input at computed `labelPos`; no drag | MODIFY — input at `label.x/y`; grip handle + Pointer-Event drag → `onUpdateLabelPos`; `fontFamily=resolveFontFamily(...)`; new prop |
| `components/Editor/LabelPanel.tsx` | does not exist | NEW — text/font/size/color/show controls; `onUpdate(patch)` |
| `components/Editor/LabelPanel.test.tsx` | does not exist | NEW — RTL control assertions |
| `components/Editor/Canvas.tsx` | passes `onUpdateLabelText` to overlay | MODIFY — add `onUpdateLabelPos` prop, pass through |
| `components/Editor/index.tsx` | `handleUpdateLabelText`; `PointPanel` only | MODIFY — `handleUpdateLabel`(general) + `handleUpdateLabelPos`; right-panel switch to `LabelPanel` in edit mode; thread new Canvas prop |
| `components/Editor/Canvas.test.tsx` | mocks label comps | MODIFY — add `onUpdateLabelPos` to `makeProps` |
| `components/Editor/LabelEditOverlay.test.tsx` | positions via `getLabelPosition` | MODIFY — position via `label.x/y`; add drag + clamp tests; add `onUpdateLabelPos` prop |
| `components/Editor/LabelLayer.test.tsx` | text/fill/size/count | MODIFY — add `label.x/y` position assertion; mock `next/font` if needed |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint.label` already complete; no `EditorState` changes.
- `lib/label-layout.ts` + `lib/label-layout.test.ts` — `getLabelPosition` is still the seed function (`handleToggleLabelEdit`); keep as-is.
- `lib/styles.ts`, `styles.json` — `labelPosition`/`swatchRadius` already typed/populated.
- `lib/swatch-layout.ts`, `lib/color-sample.ts`, `lib/drag-utils.ts`, `lib/canvas-to-916.ts`, `components/Editor/EyedropperLayer.tsx` — swatch/marker logic, untouched by labels (`getSwatchPos` stays exported for `EyedropperLayer`'s own use; no longer imported by the label components).
- `components/StylePicker.tsx`, `StyleThumbnail.tsx`, `ContextMenu.tsx`, `ExportButton.tsx`, `PointPanel.tsx` — unrelated; `PointPanel` keeps its current behavior (do NOT move its controls into `LabelPanel`).
- `app/globals.css` token block — leave the CSS-variable palette as-is (just don't touch it; the new fonts add their own `--font-*` vars via `next/font`).

### Testing standards

- Vitest + RTL, co-located `*.test.tsx`/`*.test.ts` (`docs/project-context.md`). No `lint` script — `npx tsc --noEmit` is the static check.
- **Testing `next/font`** (`lib/fonts.test.ts`, and any component importing `@/lib/fonts`): `next/font/google` is a build-time transform that throws/fails under Vitest. `vi.mock("next/font/google", () => ({ <FontName>: () => ({ style: { fontFamily: "<Name>" }, variable: "--font-x", className: "x" }) }))` for each font the module imports. Then assert `FONT_OPTIONS`/`resolveFontFamily` against the stubbed families. For `LabelPanel.test.tsx`/`LabelLayer.test.tsx`, prefer `vi.mock("@/lib/fonts", () => ({ FONT_OPTIONS: [...6...], resolveFontFamily: (s) => s }))` so the component under test gets deterministic data without the `next/font` transform.
- **Pointer-event drag** (`LabelEditOverlay.test.tsx`): jsdom lacks `setPointerCapture`/`releasePointerCapture` — either guard the calls with `?.` in the component (recommended; harmless in prod) or stub them on the target element in the test. Drive with `fireEvent.pointerDown/pointerMove/pointerUp` passing `clientX`/`clientY`; assert `onUpdateLabelPos` arguments computed as `start + delta/scale`, and the clamp at bounds.
- **react-konva mock** (`LabelLayer.test.tsx`): existing precedent maps `Layer`/`Text` → DOM with `data-*`; it already exposes `data-x`/`data-y`. Assert position from `label.x/y`. Don't real-render Konva in jsdom.
- **Mock-update discipline:** adding a required prop (`onUpdateLabelPos`) breaks every `Canvas` render until updated — fix `Canvas.test.tsx`'s `makeProps` and re-run `npx tsc --noEmit` (recurring 2.5/2.6/2.7/3.1/3.2 lesson).

### Previous Story Intelligence (Story 3.2 + earlier)

- **`label.x/y` were seeded on OFF→ON edit toggle** (`handleToggleLabelEdit`, reads `canvasLayoutRef.current`/`styleRef.current`, not state closures — they run outside render). This story makes the render paths *consume* those seeded coords. Don't reintroduce a state-closure read in callbacks; use refs (3.1 "styleRef is the live style"; 3.2 fix #2 "no `setPoints` inside a `setState` updater").
- **3.2 review fix #1**: `getLabelPosition` now clamps to canvas bounds and flips `below` for bottom-edge swatches. That logic stays in the seed path; your drag-clamp (Task 3) mirrors the same `[0,W]×[0,H]` clamp.
- **Active-state button pattern** (`aria-pressed` + accent border/bg) is established — reuse token classes in `LabelPanel` for visual consistency (the controls here are inputs/select, but keep the section-heading style from `PointPanel`).
- **"Don't stand up the whole `EditorShell` for a toggle/selection test"** (2.7/3.1/3.2) — cover the pieces: `LabelPanel` RTL, `LabelEditOverlay` drag RTL, `fonts` unit, `LabelLayer` konva-mock. The right-panel switch (PointPanel↔LabelPanel) is a trivial conditional; a full integration render is not required (follow the cited precedent — note the decision if you skip it).
- **Deferred items that touch nearby code but are NOT this story:** style-switch swatch-clip/dot legibility (`deferred-work.md`, swatch concerns), `runSuggest` blind-replace + module-global `pointIdCounter` HMR footguns (Story 2.2 entries). Irrelevant to labels — don't fix opportunistically (CLAUDE.md §3 surgical changes).

### Project Structure Notes

- `LabelPanel.tsx` → `components/Editor/` (editor-local, beside `PointPanel.tsx`) — documented variance from `ARCHITECTURE.md:24` (root) above.
- `lib/fonts.ts` → `lib/` (new shared module, alongside `lib/styles.ts`/`lib/label-layout.ts`). No conflict.
- No new state container, no `lib/types.ts` change, no new dependency.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Label Dragging & Per-Label Controls (lines 524–559)] — the 7 acceptance criteria (FR20, FR21).
- [Source: docs/SPEC.md#Label Editing (Step 5) (lines 153–166)] — "Text draggable to any position within the canvas"; per-label controls (font/size/color/visibility); apply-to-all is a separate (Story 3.4) bullet.
- [Source: docs/UI.md#In label editing mode (point selected) (lines 127–148)] — exact right-panel control list: Label text, Font dropdown, Size slider, Color, "Show label"; **Apply to all labels = Story 3.4 (do NOT build)**.
- [Source: docs/UI.md#Font options (lines 159–167)] — the 6 dropdown options in order (5 Google + System).
- [Source: docs/ARCHITECTURE.md:18,24] — `LabelLayer.tsx` "Draggable text labels"; `LabelPanel.tsx` "Right panel: per-label controls" (placement variance noted above).
- [Source: docs/ARCHITECTURE.md:98–114] — `EyedropperPoint.label` shape (all fields exist).
- [Source: lib/types.ts:17–25] — `label` object: `text/visible/x/y/fontSize/fontFamily/color` — complete; do NOT modify.
- [Source: components/Editor/index.tsx:148–155] — `labelEditMode` state + `labelEditModeRef`.
- [Source: components/Editor/index.tsx:401–427] — `handleToggleLabelEdit` seeds `label.x/y` via `getLabelPosition` on OFF→ON (the seed this story's render paths consume).
- [Source: components/Editor/index.tsx:429–433] — `handleUpdateLabelText` (replace with general `handleUpdateLabel`).
- [Source: components/Editor/index.tsx:631–650] — right `<aside>`: `{selectedPoint && <PointPanel/>}` + Export (add the `LabelPanel` branch).
- [Source: components/Editor/index.tsx:604–624] — `<Canvas>` prop list (add `onUpdateLabelPos`).
- [Source: components/Editor/Canvas.tsx:33,57,143–152] — `onUpdateLabelText` prop, `scale`, `<LabelEditOverlay>` render (thread `onUpdateLabelPos`).
- [Source: components/Editor/LabelEditOverlay.tsx:34–71] — current input render via `getSwatchPos`/`getLabelPosition` (switch to `label.x/y` + grip drag).
- [Source: components/Editor/LabelLayer.tsx:24–52] — current `<Text>` render via computed `labelPos` (switch to `label.x/y` + `resolveFontFamily`).
- [Source: components/Editor/PointPanel.tsx] — markup/token conventions to mirror in `LabelPanel`; this component is UNCHANGED.
- [Source: components/Editor/LabelEditOverlay.test.tsx:123–139] — the position test that must change to `label.x/y`.
- [Source: components/Editor/LabelLayer.test.tsx:7–21] — react-konva mock exposing `data-x/data-y/data-text/data-fill/data-fontsize`.
- [Source: components/Editor/Canvas.test.tsx:77–100] — `makeProps` (add `onUpdateLabelPos`).
- [Source: app/layout.tsx] — Geist `next/font` pattern to mirror for the 5 presets' `.variable` on `<body>`.
- [Source: _bmad-output/implementation-artifacts/3-2-label-editing-mode-and-text-input.md] — `label.x/y` seeding, overlay/`LabelLayer` mechanics, "don't stand up EditorShell," "update props when touched," refs-not-closures, no-`setPoints`-in-`setState` review fixes.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — free-floating swatches / custom styles / font-flash redraw are future/optional, NOT this story.
- [Source: docs/project-context.md] — testing standards (Vitest + RTL, co-located, `npm test`, `tsc --noEmit`), hydration rules, Tailwind v4 CSS-variable tokens.

### Review Findings

_Code review 2026-06-29 (combined 3.3 + 3.4; adversarial 3-layer: blind / edge-case / acceptance). 3.4's apply-to-all came back clean — all surviving findings are 3.3._

- [x] [Review][Decision→Fixed] Display-mode labels render at image-space coords (missing `imageOffsetY`, not beside swatch) before first edit-mode toggle — NEW regression from this story's source-of-truth switch. `LabelLayer` now draws `<Text x={p.label.x} y={p.label.y}>` in canvas space, but `label.x/y` were seeded to image-space `p.x/p.y` (`apiPointsToEyedroppers`/`claudePointsToEyedroppers`) and only corrected to a beside-swatch position on OFF→ON edit toggle. Markers correctly render at `p.y + imageOffsetY` (`EyedropperLayer.tsx:74`), so a Claude-suggested label (which pre-fills text) in a `float`/`grid` style painted `imageOffsetY` px too high and detached from its swatch until the user entered edit mode. **Fixed (option 1):** added a pure `seedNewLabels(before, after, style, W, H)` (exported from `index.tsx`) that seeds `label.x/y` to the `getLabelPosition` anchor for points that JUST became laid out (swatchOrder null→assigned), leaving already-laid-out labels untouched (dragged positions survive re-layout). Wired into all three layout sites: `runSuggest`, `handleAddPoint`, and the `canvasLayout` effect. +3 unit tests.
- [x] [Review][Patch→Fixed] Drag grip is keyboard-inaccessible while announcing `role="button"` [components/Editor/LabelEditOverlay.tsx] — added `tabIndex={0}` + an `onKeyDown` arrow-key nudge (1px, clamped). +1 test.
- [x] [Review][Patch→Fixed] `onPointerMove` uses the render-closure `p.id` instead of the captured `dragRef.current.id` [components/Editor/LabelEditOverlay.tsx] — now uses `d.id` from the ref.
- [x] [Review][Patch→Fixed] Unused required `style` prop on `LabelEditOverlay` [components/Editor/LabelEditOverlay.tsx] — dropped from Props + body, the `Canvas` pass-through, and the test renders (removed the now-unused `loadStyles`/`styleByName` import).
- [x] [Review][Defer] "Drag label N" aria-label numbering is non-contiguous/unstable [components/Editor/LabelEditOverlay.tsx:67] — deferred, consistent with the existing full-array `selectedNumber` convention (`index.tsx:520`); minor a11y.
- [x] [Review][Defer] Concurrent multi-pointer drags clobber the single shared `dragRef` [components/Editor/LabelEditOverlay.tsx:35-42] — deferred, effectively unreachable in a desktop-only (mobile-gated), single-mouse-pointer app.
- [x] [Review][Defer] Static Konva `LabelLayer` does not repaint when a webfont finishes loading (FOUT) [components/Editor/LabelLayer.tsx] — deferred, explicitly scoped out by this story's Dev Notes (optional `document.fonts.ready` polish, no `FontFaceObserver`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — BMAD dev-story workflow.

### Debug Log References

- `npm test -- --run` → 210 passing, 21 files (baseline was 195 / 19; +15 tests, +2 files).
- `npx tsc --noEmit` → No errors found.
- `npm run build` → fails on a **pre-existing, unrelated** environment issue: Turbopack cannot resolve the broken relative symlink `scripts/.venv/bin/python3 → python3.14` (out of filesystem root) while bundling the existing `app/api/suggest/route.ts` (Python SLIC venv). No font/label-related errors. Build is not a story validation gate (gates are `npm test` + `tsc`, no lint script); flagged for environment cleanup.

### Completion Notes List

- **Task 1 — fonts:** `lib/fonts.ts` loads the 5 presets via `next/font/google` at module scope; exports `FONT_OPTIONS` (6, AC7 order, System→"serif"), pure `resolveFontFamily`, and `fontVariables` (the `.variable` classes). `app/layout.tsx` appends `fontVariables.join(" ")` to `<body>` alongside the Geist vars; Geist/globals.css untouched.
- **Task 2 — source-of-truth switch:** `LabelLayer` and `LabelEditOverlay` now render from `label.x`/`label.y` (Konva `x/y`, HTML `left/top = x/y*scale`) and apply `resolveFontFamily(label.fontFamily)`. Dropped the now-orphaned `getSwatchPos`/`getLabelPosition` imports from both. `getLabelPosition` remains the seed (`handleToggleLabelEdit`) — untouched, test kept. `style` prop became unused in `LabelEditOverlay`'s body (removed from the destructure; kept in Props since Canvas still passes it). `LabelLayer` no longer uses `canvasWidth/canvasHeight` in its body but they remain in Props (Canvas passes them).
- **Task 3 — drag:** per-label flex wrapper (`pointerEvents: auto`) inside the existing `pointerEvents: none` outer container; a `⠿` grip (`role="button"`, `aria-label="Drag label N"`, `cursor: move`, `touchAction: none`) drives native Pointer Events. `useRef` records start screen point + start `label.x/y`; `onPointerMove` converts screen delta ÷ scale, clamps to `[0,W]×[0,H]`, calls `onUpdateLabelPos`. `setPointerCapture`/`releasePointerCapture` guarded with `?.` for jsdom. New required prop threaded through `Canvas` and `index.tsx`.
- **Task 4 — LabelPanel:** new editor-local `components/Editor/LabelPanel.tsx` (sibling of `PointPanel`, documented ARCHITECTURE variance). Text input / font `<select>` (6 options from `FONT_OPTIONS`) / size range 12–48 with px readout / color picker / "Show label" checkbox, all via a single `onUpdate(patch)`. No Apply-to-all (Story 3.4), no swatch-side controls.
- **Task 5 — wiring:** `handleUpdateLabelText` generalized to `handleUpdateLabel(id, patch)`; `Canvas`'s `onUpdateLabelText(id,text)` API kept via adapter `(id,text)=>handleUpdateLabel(id,{text})`. Added `handleUpdateLabelPos`. Right `<aside>` now: selected+editMode → `LabelPanel`; selected+!editMode → `PointPanel`; none → just Export.
- **Task 6 — tests:** NEW `lib/fonts.test.ts`, `LabelPanel.test.tsx`. MODIFIED `LabelEditOverlay.test.tsx` (position now from `label.x/y` on the wrapper; +drag +clamp tests; `onUpdateLabelPos` prop), `LabelLayer.test.tsx` (+`data-x/data-y` position assertion; `@/lib/fonts` mock), `Canvas.test.tsx` (`onUpdateLabelPos` in `makeProps`), `apiPointsToEyedroppers.test.ts` (`@/lib/fonts` mock — index.tsx now transitively imports `next/font`).
- **Deferred (per Dev Notes, intentionally NOT done):** `document.fonts.ready`-triggered Konva redraw for the static `LabelLayer` webfont-flash — optional polish, no `FontFaceObserver` added; the on-canvas edit field renders correctly and any edit repaints the static text. Re-seeding `label.x/y` on add/style-switch during edit mode is a pre-existing 3.2 gap, out of scope.

### File List

- `eyedropper-web/lib/fonts.ts` (NEW)
- `eyedropper-web/lib/fonts.test.ts` (NEW)
- `eyedropper-web/components/Editor/LabelPanel.tsx` (NEW)
- `eyedropper-web/components/Editor/LabelPanel.test.tsx` (NEW)
- `eyedropper-web/app/layout.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/LabelLayer.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/LabelEditOverlay.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/Canvas.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/index.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/Canvas.test.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/LabelEditOverlay.test.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/LabelLayer.test.tsx` (MODIFIED)
- `eyedropper-web/components/Editor/apiPointsToEyedroppers.test.ts` (MODIFIED)

### Change Log

- 2026-06-24 — Implemented Story 3.3 (label dragging via grip handle + per-label right-panel controls + 5 Google Font presets). All 7 ACs satisfied; 210 tests passing, tsc clean. Status → review.
- 2026-06-29 — Code review (combined 3.3 + 3.4). Fixed 4 findings: (1) label-position regression — added `seedNewLabels` to seed `label.x/y` at the beside-swatch anchor when a point is first laid out (`index.tsx` + 3 sites: runSuggest/handleAddPoint/canvasLayout effect); (2) grip keyboard a11y (`tabIndex` + arrow-key nudge); (3) drag uses captured `dragRef.id` not closure `p.id`; (4) dropped the orphaned `style` prop from `LabelEditOverlay`. 221 tests passing (was 217), tsc clean. 3 Low items deferred to `deferred-work.md`. Status → done.
