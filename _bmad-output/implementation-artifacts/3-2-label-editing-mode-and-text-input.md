# Story 3.2: Label Editing Mode & Text Input

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to switch into label editing mode and type custom text for each color swatch,
so that I can name each color zone for my audience.

## Acceptance Criteria

1. **Given** I click "Edit labels" in the left sidebar Labels section **when** label editing mode activates **then** the canvas switches to show editable text labels next to each swatch; the "Edit labels" button appears toggled/active (`aria-pressed="true"`).

2. **Given** I am in label editing mode and a point has a visible label **when** the editing UI renders **then** each swatch with `label.visible === true` shows its `label.text` as an editable text field positioned next to the swatch (at the label's `(x, y)` canvas position) — for **all 4 styles**, regardless of the style's `labelPosition`.

3. **Given** Claude suggestions were used **when** label editing mode is first entered **then** each label's text field is pre-filled with the description Claude returned for that point (already stored in `EyedropperPoint.label.text`).

4. **Given** I type in a label text field **when** the input changes **then** the `EyedropperPoint.label.text` for that point is updated in state and the field reflects the new text immediately (and the static canvas label, where the style shows one, re-renders with the new text).

5. **Given** I click "Edit labels" again while in label editing mode **when** the toggle is pressed **then** label editing mode deactivates; the editable fields disappear and labels remain on the canvas as static text **only** for styles whose `labelPosition` is `beside` or `below` (`float`, `grid`); styles with `labelPosition: "none"` (`float_clean`, `minimal`) show no static label.

## Tasks / Subtasks

- [x] Task 1: Add label-editing state + handlers to `EditorShell` (`components/Editor/index.tsx`) (AC: 1, 3, 4)
  - [x] Add `const [labelEditMode, setLabelEditMode] = useState(false)` alongside the other discrete `useState` hooks (do NOT add it to the `EditorState` *type* — like `style`/`selectedPointId`, runtime state lives in discrete hooks, not an `EditorState` object; see Dev Notes "State model").
  - [x] Add `handleToggleLabelEdit = useCallback(() => { ... }, [...])`. On the OFF→ON transition ONLY, re-initialize every point's `label.x`/`label.y` to the computed "next to the swatch" position via `getLabelPosition(...)` (see Task 3 + Dev Notes "Label position"), then flip `labelEditMode` to `true`. On ON→OFF, just set `false` (do NOT touch label positions). Read the live layout from `canvasLayoutRef.current` and the live style from `styleRef.current` (these refs already exist, lines 131/135) — see Dev Notes for why refs, not state, inside the callback.
  - [x] Add `handleUpdateLabelText = useCallback((id: string, text: string) => { setPoints((prev) => prev.map((p) => p.id === id ? { ...p, label: { ...p.label, text } } : p)) }, [])`. Spread `label` to preserve the other label fields.
  - [x] Do NOT clear `selectedPointId` or change `interactionMode` when toggling label edit mode — label editing is orthogonal to point selection and the select/add tool (the right-panel per-label controls are Story 3.3, not this story).

- [x] Task 2: Wire the "Edit labels" toggle into the left sidebar Labels section (`components/Editor/index.tsx`) (AC: 1, 5)
  - [x] Replace the Labels `<section>` placeholder (currently `<p ...>Coming soon</p>`, lines 532–537) with a single toggle `<button>`, keeping the existing `<h3>Labels</h3>` heading.
  - [x] Mirror the active-state pattern already used by the Tools Select/Add buttons (`index.tsx:505–524`) and `PointPanel` side buttons: `aria-pressed={labelEditMode}`; active = `border-[var(--color-accent)] bg-[var(--color-accent)] text-white`, inactive = `border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]`. Label text: `Edit labels`. `onClick={handleToggleLabelEdit}`.

- [x] Task 3: Add label-position math (`lib/label-layout.ts` NEW + export `getSwatchPos` from `EyedropperLayer.tsx`) (AC: 2, 5)
  - [x] `EyedropperLayer.tsx` currently defines `getSwatchPos(p, canvasWidth, canvasHeight, swatchRadius)` as a private function (lines 23–37). Add `export` to it — it is now reused for label positioning. No behavior change; do NOT move it (keep the diff to adding the keyword).
  - [x] Create `lib/label-layout.ts` exporting a pure `getLabelPosition(swatchPos: { x: number; y: number }, side: EyedropperPoint["swatchSide"], labelPosition: Style["labelPosition"], swatchRadius: number): { x: number; y: number }`. It returns the canvas-space `(x, y)` where the label sits relative to the swatch. Rules (see Dev Notes "Label position" for the exact offsets): `below` → centered under the swatch (`x: swatchPos.x`, `y: swatchPos.y + swatchRadius + GAP`); `beside`/`none` → to the inner side of the swatch (right of a left-edge swatch, left of a right-edge swatch; default to the right) at vertical center (`y: swatchPos.y`). Keep it dependency-light: a pure function of its args, no imports beyond the types.
  - [x] Co-locate `lib/label-layout.test.ts` (NEW) — unit-test the offset math for each `labelPosition` × representative `swatchSide` (see Test guidance).

- [x] Task 4: Implement `LabelLayer` — static Konva text in DISPLAY mode (`components/Editor/LabelLayer.tsx`) (AC: 5)
  - [x] Replace the stub (`export default function LabelLayer() { return null }`) with a `"use client"` Konva component that renders a `<Layer>` of `<Text>` nodes — ONE per point where `p.label.visible === true` AND `style.labelPosition !== "none"`.
  - [x] Props: `{ points: EyedropperPoint[]; style: Style; canvasWidth: number; canvasHeight: number }`. For each qualifying point compute `swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)` then `labelPos = getLabelPosition(swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius)`. Skip points with `swatchOrder === null` (same guard as `EyedropperLayer`, line 71 — an un-laid-out point has no swatch position).
  - [x] Each `<Text>`: `x={labelPos.x} y={labelPos.y} text={p.label.text} fontSize={p.label.fontSize} fontFamily={p.label.fontFamily} fill={p.label.color} listening={false}`. For `below` center horizontally (`offsetX` = half the text width, or set `align="center"` with a `width` — simplest: leave default left-anchor and accept left-aligned for `below`, OR center via `align`; see Dev Notes). Do NOT make labels draggable here — dragging is Story 3.3. `listening={false}` keeps them from intercepting marker/swatch clicks.
  - [x] Empty-text guard: render nothing for a point whose `label.text` is `""` (an empty Konva Text is invisible anyway, but skipping it avoids a zero-size node). Optional but tidy.

- [x] Task 5: Implement `LabelEditOverlay` — HTML text inputs in EDIT mode (`components/Editor/LabelEditOverlay.tsx` NEW) (AC: 1, 2, 3, 4)
  - [x] NEW `"use client"` plain-HTML (NOT Konva) component. This is the standard Konva text-editing recipe: an absolutely-positioned HTML input overlay on top of the canvas (Konva has no native editable text). See Dev Notes "Editing overlay — the Konva text-input recipe".
  - [x] Props: `{ points: EyedropperPoint[]; style: Style; canvasWidth: number; canvasHeight: number; scale: number; onUpdateLabelText: (id: string, text: string) => void }`.
  - [x] Render an absolutely-positioned container filling the stage (`position: absolute; inset: 0; width/height` = display size) with `pointer-events: none` on the container so empty areas pass clicks through to the canvas; each input gets `pointer-events: auto`.
  - [x] For each point with `label.visible === true` and `swatchOrder !== null`, compute the SAME `labelPos` as `LabelLayer` (`getSwatchPos` → `getLabelPosition`), convert canvas-space → screen-space by multiplying by `scale`, and render a controlled `<input type="text">` positioned `absolute` at `left: labelPos.x * scale, top: labelPos.y * scale`. `value={p.label.text}`, `onChange={(e) => onUpdateLabelText(p.id, e.target.value)}`. Add `data-point-id={p.id}` and an accessible label (`aria-label={`Label text for point ${i + 1}`}`) for testability.
  - [x] Style the inputs to read as on-canvas labels (small, semi-transparent white background, thin accent border so they're visibly editable), but keep it minimal — exact typography styling per the label's font is polish for Story 3.3. Do NOT add font dropdown / size slider / color picker / show-label checkbox here (Story 3.3) or apply-to-all (Story 3.4).

- [x] Task 6: Render `LabelLayer` + `LabelEditOverlay` through `Canvas` (`components/Editor/Canvas.tsx` + `index.tsx`) (AC: 1, 2, 5)
  - [x] `index.tsx`: pass `labelEditMode` and `onUpdateLabelText={handleUpdateLabelText}` to `<Canvas>` (add to the existing prop list, lines 550–568).
  - [x] `Canvas.tsx`: add `labelEditMode: boolean` and `onUpdateLabelText: (id: string, text: string) => void` to `CanvasProps`. Import `LabelLayer` and `LabelEditOverlay`.
  - [x] Wrap the returned `<Stage>` in a `position: relative` div sized to `displayWidth × displayHeight` so the HTML overlay can be absolutely positioned over the canvas (see Dev Notes "Editing overlay" for the wrapper shape). Render `<LabelLayer>` INSIDE the `<Stage>` as a new layer AFTER `<EyedropperLayer>` (so labels draw on top) — but ONLY when `!labelEditMode` (in edit mode the HTML inputs show the live text instead; see AC5 / Dev Notes "Display vs edit"). Render `<LabelEditOverlay>` as the absolutely-positioned sibling of `<Stage>` (inside the wrapper), ONLY when `labelEditMode`.
  - [x] Pass `scale` (already computed at `Canvas.tsx:51` as `displayWidth / canvasLayout.canvasWidth`) into `LabelEditOverlay`. Pass `canvasLayout.canvasWidth`/`canvasHeight` and `style` into both label components.

- [x] Task 7: Write tests (AC: all)
  - [x] `lib/label-layout.test.ts` (NEW): pure-function tests for `getLabelPosition` — `below` returns a point under the swatch (`y > swatchPos.y`, `x === swatchPos.x`); `beside`/`none` for a `left` swatch returns a point to the right (`x > swatchPos.x`); for a `right` swatch returns a point to the left (`x < swatchPos.x`); `y` stays at swatch center for `beside`. No Konva, no React.
  - [x] `components/Editor/LabelLayer.test.tsx` (NEW): mock `react-konva` (`Layer`/`Text` → DOM with `data-*`, same precedent as `EyedropperLayer.test.tsx`/`Canvas.test.tsx`). Assert: with a `labelPosition: "beside"` or `"below"` style, one `Text` per visible point renders with `data-text` = `label.text`; with `labelPosition: "none"` (`float_clean`/`minimal`) NO `Text` renders; a point with `label.visible: false` produces no `Text`; a point with `swatchOrder: null` produces no `Text`.
  - [x] `components/Editor/LabelEditOverlay.test.tsx` (NEW): plain RTL (no Konva — it's HTML). Assert: one `<input>` per visible point, each pre-filled with `label.text` (covers AC3 — pass a point whose `label.text` came from a Claude description); typing into an input (`fireEvent.change` or `userEvent`) calls `onUpdateLabelText` with `(pointId, newText)`; a `label.visible: false` point renders no input; inputs render for ALL styles (test with a `labelPosition: "none"` style too — AC2 "all 4 styles").
  - [x] `components/Editor/index.tsx` toggle: extend or add a focused test asserting the "Edit labels" button toggles `aria-pressed`. Per the Story 2.7/3.1 precedent ("don't stand up the whole EditorShell just to test a toggle"), prefer NOT a full EditorShell integration test; if the toggle logic is non-trivial enough to warrant coverage, keep it light. The label-edit re-init of `label.x/y` is covered indirectly by the `getLabelPosition` unit tests; a full EditorShell render is not required. — _Decision: NOT added. The toggle's `aria-pressed` wiring is a trivial state flip and the re-init math is fully covered by `getLabelPosition` unit tests; a full EditorShell render is not warranted (per the cited precedent)._
  - [x] `components/Editor/Canvas.test.tsx` (MODIFY): the existing mock covers `Stage/Layer/Rect/Image/Circle` and mocks out `EyedropperLayer`. Add a mock for `LabelLayer` and `LabelEditOverlay` (mock them to simple markers, e.g. `data-testid="label-layer"` / `data-testid="label-edit-overlay"`) so Canvas tests stay isolated; assert `LabelLayer` renders when `labelEditMode={false}` and `LabelEditOverlay` renders when `labelEditMode={true}`, and vice-versa. Update `DEFAULT_PROPS`/required props so existing Canvas tests still pass with the two new required props.
  - [x] Run `npm test` — all pass, no regressions (baseline: **169 passing, 16 files** as of Story 3.1). → **191 passing, 19 files**.
  - [x] Run `npx tsc --noEmit` — clean. The two new `Canvas` props are required, so update every `Canvas` render in `Canvas.test.tsx` (and any other caller) to pass them — this is the recurring "update mocks/props when you touch a tested component" lesson (Stories 2.5/2.6/2.7/3.1).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from there. Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1. **No new dependencies** — the editable label uses an HTML `<input>` overlay (plain DOM), NOT `react-konva-utils`/`Html` (not installed, do not add).

### Scope — what this story IS and IS NOT

This story is the **label-edit toggle + on-canvas editable text + Claude pre-fill + static display on exit**. Nothing else.

**IN scope (5 ACs):** the "Edit labels" toggle, an editable text field per visible swatch (all 4 styles), pre-fill from `label.text`, live text→state update, and static Konva text remaining on exit for `beside`/`below` styles only.

**OUT of scope — explicitly deferred (do NOT build):**
- **Label dragging** + **per-label controls** (font dropdown, size slider, color picker, "Show label" checkbox) and **Google Font loading via `next/font`** → **Story 3.3**. The right-panel "Label" controls shown in `docs/UI.md:127–148` belong to 3.3/3.4 — do NOT add them to `PointPanel` or the right sidebar here.
- **Apply-to-all label controls** → **Story 3.4**.
- Because font *loading* is 3.3, the label `fontFamily` ("Cormorant Garamond Italic" default) is NOT loaded yet; Konva `<Text>` / the HTML input will fall back to a system font. That is expected and fine for 3.2 — do NOT add `next/font` wiring (that is 3.3's AC).

### State model — discrete `useState`, not the `EditorState` object

`EditorShell` keeps runtime state in discrete `useState`/`useRef` hooks (`points`, `selectedPointId`, `style`, `interactionMode`, …) — the `EditorState` interface in `lib/types.ts` is an aspirational shape, NOT the runtime container (confirmed in Story 2.7 and 3.1 Dev Notes). Add `labelEditMode` as a new `useState(false)`. Do NOT introduce an `EditorState` object and do NOT add `labelEditMode` to the `lib/types.ts` interface (it isn't used as a container; adding it there is dead code).

`EyedropperPoint.label` ALREADY has every field this story needs (`text`, `visible`, `x`, `y`, `fontSize`, `fontFamily`, `color` — see `lib/types.ts:17–25`). Do NOT change `lib/types.ts`.

### Claude pre-fill is already wired (AC3)

`claudePointsToEyedroppers` (`index.tsx:94–114`) already sets `label.text = p.description`. SLIC points (`apiPointsToEyedroppers`, `:72–92`) and added points set `label.text = ""`. So AC3 needs NO new fetching/plumbing — entering edit mode simply shows `label.text`, which is the Claude description when Claude was the suggestion method. The `LabelEditOverlay` input bound to `value={p.label.text}` satisfies AC3 automatically.

### Label position (AC2) — re-init on entering edit mode, derive from swatch

Decision (confirmed with the artist): a label's initial canvas position is derived from its **swatch** position + the style's `labelPosition`, NOT the marker. Currently `label.x/label.y` are seeded to the *marker's image coords* (`index.tsx:85–87, 107–109`) — that would render labels on top of the drawing. So on the OFF→ON edit-mode transition, re-initialize each point's `label.x/label.y` via `getLabelPosition(...)`. This also gives Story 3.3's free-drag a sensible starting point.

`getLabelPosition(swatchPos, side, labelPosition, swatchRadius)` offsets (use a small `GAP`, e.g. `8`):
- `below` (grid): `{ x: swatchPos.x, y: swatchPos.y + swatchRadius + GAP }` — under the swatch.
- `beside` (float): to the inner side of the swatch at vertical center. For a `left`-edge swatch → right of it: `{ x: swatchPos.x + swatchRadius + GAP, y: swatchPos.y }`. For a `right`-edge swatch → left of it: `{ x: swatchPos.x - swatchRadius - GAP, y: swatchPos.y }`. For `top`/`bottom`/`auto` swatches default to the right side.
- `none` (float_clean, minimal): no style-defined position, but edit mode still shows a field (AC2 "all 4 styles") — use the same rule as `beside` so the field appears next to the swatch.

Keep `getLabelPosition` PURE (only its args). It does NOT read `swatchOrder` directly — the caller passes the already-computed `swatchPos` from `getSwatchPos`. `getSwatchPos` (now exported from `EyedropperLayer.tsx`) reads `swatchSide`/`swatchOrder`/`swatchRadius` and returns canvas-space coords.

### Editing overlay — the Konva text-input recipe (AC2, AC4)

Konva has no native editable text. The standard approach (Konva's own "Editable text" demo) is an HTML `<input>`/`<textarea>` positioned over the canvas. Mechanics here:

- Canvas-space → screen-space: the `<Stage>` is rendered at `displayWidth × displayHeight` with `scaleX/scaleY = scale` (`Canvas.tsx:51,66–69`). A point at canvas coords `(cx, cy)` appears on screen at `(cx * scale, cy * scale)` relative to the stage's top-left. So an overlay `<div>` sized to the stage and positioned at the same top-left lets you place an input at `left: labelPos.x * scale, top: labelPos.y * scale`.
- Wrapper: change `Canvas`'s root from a bare `<Stage>` to `<div style={{ position: "relative", width: displayWidth, height: displayHeight }}>` containing the `<Stage>` then (conditionally) `<LabelEditOverlay>`. The wrapper sits in the same flex-centered `<main>`, so it's centered identically — no extra offset math needed.
- Overlay container: `position: absolute; inset: 0; pointer-events: none` so empty regions don't block canvas interaction; each `<input>` sets `pointer-events: auto`.
- Inputs are **controlled** (`value={p.label.text}`, `onChange → onUpdateLabelText`). React re-render keeps every input in sync with `points` state — that is AC4.

### Display vs edit — only one label representation at a time

- `labelEditMode === false` (display): `LabelLayer` draws Konva `<Text>` for visible labels on `beside`/`below` styles only (`float_clean`/`minimal` → nothing; AC5). No HTML inputs.
- `labelEditMode === true` (edit): `LabelEditOverlay` draws HTML inputs for ALL visible labels (every style; AC2). Skip the Konva `<Text>` while editing so text isn't drawn twice (the input shows the live value). This keeps the two representations mutually exclusive and avoids double-render/flicker.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/Editor/index.tsx` | Labels section = "Coming soon"; no label state | ADD `labelEditMode` state + `handleToggleLabelEdit` (re-init label x/y on enter) + `handleUpdateLabelText`; replace Labels `<section>` with the toggle button; pass `labelEditMode` + `onUpdateLabelText` to `<Canvas>` |
| `components/Editor/Canvas.tsx` | Pure `<Stage>`; renders `EyedropperLayer` | ADD `labelEditMode`/`onUpdateLabelText` props; wrap `<Stage>` in a `position:relative` sized div; render `<LabelLayer>` (in-stage, display mode) + `<LabelEditOverlay>` (HTML sibling, edit mode) |
| `components/Editor/LabelLayer.tsx` | Stub: `return null` | IMPLEMENT — Konva `<Layer>` of static `<Text>` for visible labels on `beside`/`below` styles |
| `components/Editor/LabelEditOverlay.tsx` | does not exist | NEW — HTML `<input>` overlay, one per visible label, controlled, positioned by `labelPos * scale` |
| `components/Editor/EyedropperLayer.tsx` | `getSwatchPos` private (lines 23–37) | EXPORT `getSwatchPos` (add keyword only; no behavior change) |
| `lib/label-layout.ts` | does not exist | NEW — pure `getLabelPosition(swatchPos, side, labelPosition, swatchRadius)` |
| `lib/label-layout.test.ts` | does not exist | NEW — offset-math unit tests |
| `components/Editor/LabelLayer.test.tsx` | does not exist | NEW — react-konva mocked; per-style Text presence/absence |
| `components/Editor/LabelEditOverlay.test.tsx` | does not exist | NEW — RTL; input count, pre-fill, onChange callback |
| `components/Editor/Canvas.test.tsx` | mocks Stage/Layer/Rect/Image/Circle + EyedropperLayer | MODIFY — mock `LabelLayer`/`LabelEditOverlay`; add the two required props; assert conditional render |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint.label` already complete; do NOT add `labelEditMode` to `EditorState`.
- `lib/styles.ts`, `styles.json` — `labelPosition` already typed/populated; no change.
- `lib/swatch-layout.ts`, `lib/color-sample.ts`, `lib/drag-utils.ts`, `lib/canvas-to-916.ts` — unchanged.
- `components/StylePicker.tsx`, `StyleThumbnail.tsx`, `PointPanel.tsx`, `ContextMenu.tsx`, `ExportButton.tsx` — unrelated; the right-panel per-label controls are Story 3.3, NOT here.
- The `EyedropperLayer` marker/swatch/connector rendering — only `getSwatchPos`'s `export` keyword changes; leave the rest exactly as-is (don't touch the Story 3.1 `dot`/`ring` branch).

### Test guidance

- Vitest + RTL, co-located `*.test.tsx`/`*.test.ts` (per `docs/project-context.md`). No `lint` script — `npx tsc --noEmit` is the static check.
- **react-konva mocking** (for `LabelLayer.test.tsx`): follow the `Canvas.test.tsx`/`EyedropperLayer.test.tsx` precedent — `vi.mock("react-konva", ...)` mapping `Layer`/`Text` to `<div data-testid=... data-text=... data-x=... data-y=...>`. Assert on `data-text` and presence/count. Do NOT attempt a real Konva render in jsdom.
- **`LabelEditOverlay.test.tsx`** is plain HTML — no Konva mock needed. Render directly, query inputs by `aria-label` or `data-point-id`, assert `value` (pre-fill) and `fireEvent.change`/`userEvent.type` → `onUpdateLabelText` called with `(id, text)`. Include a `labelPosition: "none"` style in one case to prove AC2 ("all 4 styles").
- **`getLabelPosition`** is a pure function — straightforward arithmetic assertions, fastest coverage of the position rules.
- **Mock-update discipline:** adding two required `Canvas` props breaks every existing `Canvas.test.tsx` render until updated — fix them all and re-run `npx tsc --noEmit` (recurring 2.5/2.6/2.7/3.1 lesson).

### Previous Story Intelligence (Story 3.1 + earlier)

- **Active-state button pattern** is established (Tools toggle, `PointPanel` side buttons, `StylePicker`): `aria-pressed` + accent border/bg when active. Reuse it verbatim for the "Edit labels" toggle — clean semantic test hook (AC1).
- **`styleRef.current` is the live style inside callbacks** (3.1, load-bearing). `handleToggleLabelEdit` runs outside render, so read `styleRef.current` (not the `style` state closure) when computing label positions, and `canvasLayoutRef.current` (not `canvasLayout` state) for the layout — mirrors why the swatch drag handlers use refs (`index.tsx:296,315`).
- **Don't stand up the whole `EditorShell` for a toggle/selection test** (2.7/3.1) — cover the pieces (`getLabelPosition` unit, `LabelEditOverlay` RTL, `LabelLayer` konva-mock) rather than a full integration render.
- **`assignSwatchLayout` is NOT needed on edit-mode toggle** — toggling labels doesn't move swatches. Only re-init `label.x/label.y`; leave `swatchOrder`/`swatchSide` untouched. (Contrast: re-laying out swatches is what the marker/side/add/remove handlers do.)
- **Deferred items NOT in scope here:** the larger-radius style-switch swatch-clip and white-dot legibility (both `deferred-work.md`, Story 3.1) are swatch/style concerns, untouched by labels. The `runSuggest` blind-replace and `pointIdCounter` HMR footguns remain deferred — irrelevant to labels.

### Project Structure Notes

- `LabelLayer.tsx` and the NEW `LabelEditOverlay.tsx` are editor-local → `components/Editor/` (siblings of `EyedropperLayer.tsx`/`Canvas.tsx`), per `docs/ARCHITECTURE.md:18–22` which lists `LabelLayer.tsx` under `components/Editor/`. (Contrast `StylePicker.tsx`, which ARCHITECTURE places at the `components/` root — labels stay editor-local.)
- `lib/label-layout.ts` is a NEW pure-math helper alongside `lib/swatch-layout.ts` — appropriate `lib/` placement for layout math (mirrors `swatch-layout.ts`). No conflict with the unified structure.
- No new `lib/` color/style/types module — those already exist; do NOT duplicate.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Label Editing Mode & Text Input (lines 494–522)] — the 5 acceptance criteria (FR19, FR23 Claude pre-fill).
- [Source: docs/SPEC.md#Label Editing (Step 5) (lines 153–166)] — "Each swatch with a label shows an editable text field next to it on the canvas"; "If Claude suggested descriptions, they pre-fill the text fields; otherwise empty." (Text draggable + per-label controls are Story 3.3.)
- [Source: docs/UI.md#Labels (lines 62–65)] — left sidebar `[ Edit labels ]` toggles label editing mode.
- [Source: docs/UI.md#In label editing mode (lines 127–148)] — the right-panel Label controls (text/font/size/color/show + apply-to-all): **Stories 3.3 & 3.4, NOT this story.**
- [Source: docs/ARCHITECTURE.md:18–22] — `components/Editor/LabelLayer.tsx # Draggable text labels` (editor-local placement).
- [Source: docs/ARCHITECTURE.md:98–114] — `EyedropperPoint.label` shape (all label fields already exist).
- [Source: lib/types.ts:17–25] — `label` object: `text/visible/x/y/fontSize/fontFamily/color` — complete; do NOT modify.
- [Source: components/Editor/index.tsx:94–114] — `claudePointsToEyedroppers` sets `label.text = description` (AC3 already wired).
- [Source: components/Editor/index.tsx:131,135] — `canvasLayoutRef`/`styleRef` (read these in `handleToggleLabelEdit`, not state closures).
- [Source: components/Editor/index.tsx:505–524] — Tools Select/Add `aria-pressed` active-button pattern to mirror for the toggle.
- [Source: components/Editor/index.tsx:532–537] — Labels section "Coming soon" stub to replace.
- [Source: components/Editor/EyedropperLayer.tsx:23–37] — `getSwatchPos` (export it; reuse for label positioning).
- [Source: components/Editor/EyedropperLayer.tsx:71] — `swatchOrder === null` skip guard (mirror in `LabelLayer`/overlay).
- [Source: components/Editor/Canvas.tsx:51,66–69,113–126] — `scale` computation + Stage scaling + where `EyedropperLayer` is rendered (add `LabelLayer` after it; wrap Stage for the overlay).
- [Source: components/Editor/Canvas.test.tsx:14–53] — react-konva mock pattern + `EyedropperLayer` mock precedent (mock `LabelLayer`/`LabelEditOverlay` the same way).
- [Source: components/Editor/EyedropperLayer.test.tsx:30–70] — Konva-mock-to-DOM precedent for `LabelLayer.test.tsx`.
- [Source: _bmad-output/implementation-artifacts/3-1-style-picker-and-live-style-switching.md] — `aria-pressed` toggle pattern, `styleRef` live-read lesson, "don't stand up EditorShell to test," "update mocks/props when touched."
- [Source: docs/project-context.md] — testing standards (Vitest + RTL, co-located tests, `npm test`), hydration rules, Tailwind v4 CSS-variable tokens.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`eu.anthropic.claude-opus-4-8`)

### Debug Log References

- Initial `npx tsc --noEmit` surfaced 5 errors in the two new test files: the `makePoint` helper's override type `Partial<EyedropperPoint> & { label?: Partial<...> }` intersected the full (required) `label` from `Partial<EyedropperPoint>` with the partial label, so a `{ label: { text } }` override was rejected. Fixed by changing the base to `Omit<Partial<EyedropperPoint>, "label">` in both `LabelLayer.test.tsx` and `LabelEditOverlay.test.tsx`. tsc then clean.

### Completion Notes List

- **Red-green-refactor** per task: wrote each test first, confirmed RED (import-resolve failure / stub-returns-null), then implemented to GREEN.
- **AC1** — `Edit labels` toggle in left sidebar with `aria-pressed={labelEditMode}`, mirroring the Tools button pattern; Canvas swaps to `LabelEditOverlay` in edit mode.
- **AC2** — `LabelEditOverlay` renders a controlled `<input>` per visible, laid-out point for **all 4 styles** (including `labelPosition: "none"`), positioned at `labelPos * scale` in screen space.
- **AC3** — inputs are controlled on `value={p.label.text}`; Claude descriptions are already stored there by `claudePointsToEyedroppers`, so pre-fill needed no new plumbing.
- **AC4** — `onChange → handleUpdateLabelText → setPoints` (spreads `label` to preserve other fields); the static `LabelLayer` re-renders from the same `label.text`.
- **AC5** — `LabelLayer` (display mode) draws static Konva `<Text>` only for `beside`/`below` styles; `labelPosition: "none"` (`float_clean`/`minimal`) renders nothing. Display and edit representations are mutually exclusive (`!labelEditMode` vs `labelEditMode`) to avoid double-render.
- **Label position re-init**: on OFF→ON only, `handleToggleLabelEdit` reseeds every laid-out point's `label.x/y` from its swatch position via `getLabelPosition`, reading `canvasLayoutRef.current`/`styleRef.current` (not state closures) since it runs outside render. `swatchOrder`/`swatchSide` untouched (no swatch re-layout).
- **`below` centering**: used `align="center"` on the Konva `<Text>` (no explicit `width`, so Konva centers around its own measured box); kept minimal per scope.
- **Test split** per the 2.7/3.1 precedent: covered the pieces (`getLabelPosition` unit, `LabelLayer` konva-mock, `LabelEditOverlay` RTL, `Canvas` conditional-render) instead of a full `EditorShell` integration render.
- **No new dependencies**, no `lib/types.ts` change, no `next/font` wiring (font loading is Story 3.3).
- Final: **191 passing, 19 files** (was 169/16); `npx tsc --noEmit` clean.

### File List

- `eyedropper-web/lib/label-layout.ts` (NEW) — pure `getLabelPosition` + `LABEL_GAP`
- `eyedropper-web/lib/label-layout.test.ts` (NEW)
- `eyedropper-web/components/Editor/LabelLayer.tsx` (MODIFIED — implemented from stub)
- `eyedropper-web/components/Editor/LabelLayer.test.tsx` (NEW)
- `eyedropper-web/components/Editor/LabelEditOverlay.tsx` (NEW)
- `eyedropper-web/components/Editor/LabelEditOverlay.test.tsx` (NEW)
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` (MODIFIED — `export` on `getSwatchPos`)
- `eyedropper-web/components/Editor/Canvas.tsx` (MODIFIED — `labelEditMode`/`onUpdateLabelText` props, wrapper div, conditional label render)
- `eyedropper-web/components/Editor/Canvas.test.tsx` (MODIFIED — mock label components, two new props, conditional-render assertions)
- `eyedropper-web/components/Editor/index.tsx` (MODIFIED — `labelEditMode` state, `handleToggleLabelEdit`/`handleUpdateLabelText`, Labels toggle button, Canvas wiring)

### Review Findings

_Code review 2026-06-16 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: all 5 ACs PASS, no scope violations, no protected files touched, test plan complete. Verification: `npm test` 191/19 ✓, `tsc --noEmit` clean ✓._

- [x] [Review][Patch] (resolved from Decision → patched) `getLabelPosition` doesn't account for edge orientation or canvas bounds — edge swatches get off-canvas/overflowing labels [lib/label-layout.ts:21-28] — The spec formula is implemented faithfully, but for a **bottom-edge swatch in a `below`/grid style** it returned `y = canvasHeight + 8`, i.e. the label sat **off the bottom of the 9:16 canvas**. **FIXED**: `getLabelPosition` now takes `canvasWidth`/`canvasHeight`, flips `below` to point ABOVE a bottom-edge swatch, and clamps the anchor into `[0,W]×[0,H]`. All 3 callers (`LabelLayer`, `LabelEditOverlay`, `handleToggleLabelEdit`) pass canvas dims. +4 unit tests (bottom-edge-goes-up, 3 clamp cases). 195 passing.

- [x] [Review][Patch] `setPoints` called inside the `setLabelEditMode` updater — impure state updater [components/Editor/index.tsx:394-418] — `handleToggleLabelEdit` called `setPoints(...)` from inside the `setLabelEditMode((on) => {…})` updater (impure; StrictMode double-invokes it). **FIXED**: added `labelEditModeRef` (synced via effect) so the toggle reads the live mode without a state-updater closure; the seed `setPoints` and `setLabelEditMode(true/false)` now run as separate, top-level calls in the callback. Deps stay `[]`.

## Change Log

- 2026-06-16 — Code review (3-layer adversarial). Acceptance: clean pass on all 5 ACs. Triage: 1 decision-needed (edge-orientation label placement → off-canvas for bottom-edge grid labels), 1 patch (setPoints inside setState updater); 2 dismissed-as-noise families (false positives), rest dismissed as spec-by-design / Story 3.3 scope.
- 2026-06-15 — Implemented Story 3.2 (label editing mode & text input): all 5 ACs, 7 tasks. +22 tests (3 new test files), suite 191 passing / 19 files. Status → review.
