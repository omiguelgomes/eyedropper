# Story 3.4: Apply-to-All Label Controls

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to apply a font, size, or color setting to all labels at once,
so that I can quickly achieve a consistent typographic style across the whole palette.

## Acceptance Criteria

1. **Given** I am in label editing mode with a point selected (so the right sidebar shows `LabelPanel`) **when** the "Apply to all labels" section renders **then** it shows exactly three buttons: **Font**, **Size**, **Color**, below the per-label controls and above the Export section. (The section only exists inside `LabelPanel`, so it is shown only when a point is selected in edit mode — matching `docs/UI.md:141–143`.)

2. **Given** a point is selected with a specific font family set **when** I click "Font" under "Apply to all labels" **then** every point's `label.fontFamily` is updated to match the selected point's `label.fontFamily`; all on-canvas labels (edit-mode fields and display-mode `<Text>`) re-render with the new font immediately.

3. **Given** a point is selected with a specific font size set **when** I click "Size" under "Apply to all labels" **then** every point's `label.fontSize` is updated to match the selected point's `label.fontSize`; all labels re-render at the new size immediately.

4. **Given** a point is selected with a specific label color set **when** I click "Color" under "Apply to all labels" **then** every point's `label.color` is updated to match the selected point's `label.color`; all labels re-render with the new color immediately.

## Tasks / Subtasks

- [x] Task 1: Add the broadcast handler in `EditorShell` (`components/Editor/index.tsx` MODIFY) (AC: 2, 3, 4)
  - [x] Add `handleApplyToAll = useCallback((field: "fontFamily" | "fontSize" | "color") => { ... }, [selectedPointId])`. It reads the currently selected point's `label[field]` and writes that value to **every** point's `label[field]`:
    ```ts
    const handleApplyToAll = useCallback(
      (field: "fontFamily" | "fontSize" | "color") => {
        setPoints((prev) => {
          const selected = prev.find((p) => p.id === selectedPointId)
          if (!selected) return prev
          const value = selected.label[field]
          return prev.map((p) => ({ ...p, label: { ...p.label, [field]: value } }))
        })
      },
      [selectedPointId]
    )
    ```
  - [x] **Read the selected point from inside the `setPoints` updater** (`prev.find(...)`), NOT from the outer `selectedPoint` render closure — this follows the established refs/updater-not-closure discipline (3.1/3.2: avoid stale-closure reads in callbacks; the updater's `prev` is always the live points array). Depend only on `selectedPointId` (a primitive) so the callback identity is stable.
  - [x] Guard the no-selection case (`if (!selected) return prev`) even though the button is only reachable with a selection — returning `prev` unchanged is a cheap, correct no-op.
  - [x] Do NOT re-run `swatch-layout.ts` — label font/size/color do not affect swatch edge assignment or the no-crossing layout. (Only marker `(x,y)`, `swatchSide`, and add/remove change layout; 2.3/2.4/2.6.)

- [x] Task 2: Add the "Apply to all labels" section to `LabelPanel` (`components/Editor/LabelPanel.tsx` MODIFY) (AC: 1, 2, 3, 4)
  - [x] Add ONE new prop: `onApplyToAll: (field: "fontFamily" | "fontSize" | "color") => void`. Keep the existing `label` and `onUpdate` props unchanged.
  - [x] After the existing "Show label" checkbox (the last current control) and before the component closes, render a new block:
    - Heading `<h3>` / `<p>` "Apply to all labels" using the **same** Tailwind token classes as the existing section headings in this file (`text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2`).
    - Three buttons in a `flex gap` row, in this exact order: **Font**, **Size**, **Color**. Each calls `onApplyToAll("fontFamily")`, `onApplyToAll("fontSize")`, `onApplyToAll("color")` respectively on click.
    - Style the buttons to match the existing non-active button look in `PointPanel.tsx` (swatch-side buttons): `text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-white hover:border-[var(--color-accent)] transition-colors`. These are momentary action buttons (not toggles) — do NOT use `aria-pressed`.
    - Give each button an accessible name matching its visible text ("Font", "Size", "Color") — visible text is sufficient; no extra `aria-label` needed.
  - [x] Keep the section visually separated from the Export section the same way `PointPanel` sections are spaced (the parent `<aside>` already applies `gap-6` between top-level children, but `LabelPanel` renders as a single `<section>` — keep the apply-to-all block as a nested element inside `LabelPanel`'s root `<section>`, with `mt-3`/`mt-4` spacing above its heading to separate it from "Show label", mirroring the existing intra-panel spacing like `mb-3`).

- [x] Task 3: Wire the new prop in `EditorShell` (`components/Editor/index.tsx` MODIFY) (AC: 1, 2, 3, 4)
  - [x] At the `<LabelPanel ... />` render (currently `index.tsx:646–649`), add `onApplyToAll={handleApplyToAll}`. Keep `label={selectedPoint.label}` and `onUpdate={(patch) => handleUpdateLabel(selectedPoint.id, patch)}` exactly as they are.
  - [x] No change to the right-panel switching logic (selected+editMode → LabelPanel; selected+!editMode → PointPanel; none → Export) — that was finalized in 3.3.

- [x] Task 4: Write tests (AC: all)
  - [x] `components/Editor/LabelPanel.test.tsx` (MODIFY — the file from 3.3 already mocks `@/lib/fonts`): ADD a required `onApplyToAll: vi.fn()` to **every** existing `render(<LabelPanel ... />)` call so the new required prop compiles (recurring "update props when you add a required prop" lesson — 2.5/2.6/2.7/3.1/3.2/3.3). Prefer adding a small `makeProps(overrides)` helper or pass `onApplyToAll={vi.fn()}` inline in each of the 5 existing tests. Then ADD a new test block: render with `onApplyToAll = vi.fn()`; assert the three buttons "Font", "Size", "Color" exist (`getByRole("button", { name: "Font" })` etc.) and that clicking each calls `onApplyToAll("fontFamily")`, `onApplyToAll("fontSize")`, `onApplyToAll("color")` respectively (AC1–AC4). Note the button text is "Font"/"Size"/"Color" but the argument is the **field key** `"fontFamily"`/`"fontSize"`/`"color"` — assert the key, not the label.
  - [x] **`handleApplyToAll` logic test (AC2–AC4):** the broadcast logic lives in `index.tsx`, and 3.3 established "don't stand up the whole `EditorShell` for a selection/toggle test." Pick the lower-cost option and note your choice in Completion Notes:
    - **(preferred)** If a tiny pure helper makes the logic testable in isolation, that's fine — but do NOT over-engineer; the inline `useCallback` above is simple enough that a `LabelPanel`-level test (clicking a button fires `onApplyToAll(field)`) plus a focused reducer-style unit test is sufficient. If you extract a pure `applyFieldToAll(points, selectedId, field)` helper into `lib/` to make it unit-testable, add a co-located `*.test.ts` and assert: every point's `label[field]` equals the selected point's value; other label fields (`text`, `x`, `y`, `visible`, and the two non-applied of font/size/color) are untouched; a missing/`null` `selectedId` returns the array unchanged.
    - **(acceptable alternative)** Keep the logic inline in `index.tsx` and rely on the `LabelPanel` test for the wiring + a brief manual reasoning note; do not build a full `EditorShell` integration render just for this (cite the 3.3 precedent if you skip it).
  - [x] Run `npm test` — all pass, no regressions (baseline: **210 passing, 21 files** as of Story 3.3's review). Report the new totals. → **217 passing, 22 files** (+7 tests: 6 helper + 1 button block; +1 file: `lib/apply-to-all.test.ts`).
  - [x] Run `npx tsc --noEmit` — clean. The new required `LabelPanel.onApplyToAll` prop must be threaded at the single `index.tsx` call site and added to every `LabelPanel` test render. → exit 0, clean.

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from there. Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1. **No new runtime dependencies** — this story is three plain `<button>`s and one state callback. Do NOT add anything.

### Scope — what this story IS and IS NOT

This is the **final story of Epic 3** and the smallest in it. It adds the "Apply to all labels" block (Font / Size / Color buttons) to the `LabelPanel` built in Story 3.3, plus the broadcast handler that copies the selected point's font/size/color to every point.

**IN scope (4 ACs):** three action buttons in `LabelPanel` (Font/Size/Color); a `handleApplyToAll(field)` in `EditorShell` that copies `selectedPoint.label[field]` → all points' `label[field]`; live canvas re-render (free — it's just `setPoints`); tests.

**OUT of scope — do NOT build:**
- **Apply-to-all for `text`, `visible`, or position (`x`/`y`)** — UX-DR9 / `docs/UI.md:142–143` / FR22 / SPEC `docs/SPEC.md:164–165` specify **font, size, color only**. Three buttons, three fields. Do not add a "text" or "visibility" broadcast.
- **Export** (`stage.toDataURL`, `/api/export`, Download wiring) → **Epic 4 / Story 4.1**. `ExportButton` stays the placeholder it is.
- **Per-label controls** (text/font/size/color/show inputs) — already built in 3.3. Do NOT touch the existing `LabelPanel` controls beyond appending the new section.
- **`labelDefaults`** (`EditorState.labelDefaults`, `lib/types.ts:3–7,38`) — this is the seed for *new* labels, NOT the apply-to-all target. Apply-to-all writes to existing `points[].label`, not to `labelDefaults`. Do NOT wire apply-to-all into `labelDefaults` (and note: `labelDefaults` is currently unused state from earlier scaffolding — leave it alone; out of scope).
- **Free-floating / push-aside swatches, custom user styles** → future (`deferred-work.md`). Untouched.
- Re-seeding `label.x/y` on add/style-switch during edit mode — pre-existing 3.2 gap, not this story.

### Source of truth for the broadcast value (AC2–AC4)

The value to broadcast is the **selected point's** current `label[field]` — read it from inside the `setPoints((prev) => ...)` updater via `prev.find((p) => p.id === selectedPointId)`, not from the `selectedPoint` render-closure variable (`index.tsx:506`). Rationale (3.1/3.2 review lessons): callbacks created with `useCallback` can capture a stale `points`/`selectedPoint`; reading `prev` inside the updater guarantees the live array. Depend on `selectedPointId` only (primitive → stable identity). This mirrors how `handleSetSide`/`handleRemovePoint` already operate on `prev` inside `setPoints`.

### Why no `swatch-layout.ts` re-run

`swatch-layout.ts` assigns swatches to edges and enforces the no-crossing sort based on marker `(x,y)` and `swatchSide` only (`docs/ARCHITECTURE.md:119–125`). Label `fontFamily`/`fontSize`/`color` are pure presentation on the `LabelLayer`/`LabelEditOverlay` — they never feed the layout. So `handleApplyToAll` is a plain `setPoints` map with no `placeSwatches(...)` call (contrast with `handleSetSide`/marker-drag-end/add/remove, which DO re-run layout). Adding a layout re-run here would be wrong (wasted work) — don't.

### LabelPanel — current shape and the single change

`components/Editor/LabelPanel.tsx` (from 3.3) is a single root `<section data-testid="label-panel">` containing, top to bottom: Label heading + text input, Font heading + `<select>`, Size heading + range, Color heading + color input, "Show label" checkbox. Props today: `{ label, onUpdate }`. This story appends an **"Apply to all labels"** block after the checkbox and adds ONE prop `onApplyToAll`. The three buttons mirror `PointPanel`'s swatch-side button styling (`PointPanel.tsx:36–48`) but are momentary actions (no `aria-pressed`, no active state — clicking just broadcasts).

The buttons' visible text is **"Font" / "Size" / "Color"** (per `docs/UI.md:143`) but the callback argument is the **label field key** `"fontFamily" / "fontSize" / "color"` (the keys on `EyedropperPoint.label`). Keep that mapping explicit in the JSX (`onClick={() => onApplyToAll("fontFamily")}` on the "Font" button, etc.).

### Right-panel placement (AC1)

The "Apply to all labels" section appears **inside `LabelPanel`**, which the right `<aside>` renders only when `selectedPoint && labelEditMode` (`index.tsx:645–650`, finalized in 3.3). So it is automatically (and correctly) absent in non-edit mode and when nothing is selected. `docs/UI.md:127–148` shows it between the per-label controls and the Export section — which is exactly where it lands, since `LabelPanel` renders above the Export `<section>` in the `<aside>` (`index.tsx:660–665`). No change to the `<aside>` structure or the switching conditionals is needed; only add `onApplyToAll` to the existing `<LabelPanel>` element.

### State model — no new top-level state

`EditorShell` keeps runtime state in discrete `useState`/`useRef` (2.7/3.1/3.2/3.3). Add NO new state for this story — `handleApplyToAll` only reads `selectedPointId` and mutates `points` via `setPoints`. Do NOT modify `lib/types.ts` (`EyedropperPoint.label` already has `fontFamily/fontSize/color`, `lib/types.ts:22–24`). Do NOT touch `EditorState`/`labelDefaults`.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/Editor/LabelPanel.tsx` | `{label, onUpdate}`; text/font/size/color/show controls | MODIFY — add `onApplyToAll` prop; append "Apply to all labels" section (Font/Size/Color buttons) |
| `components/Editor/index.tsx` | `LabelPanel` rendered with `label`+`onUpdate` | MODIFY — add `handleApplyToAll(field)` callback; pass `onApplyToAll={handleApplyToAll}` to `<LabelPanel>` |
| `components/Editor/LabelPanel.test.tsx` | 5 tests, mocks `@/lib/fonts`, `render(<LabelPanel label onUpdate/>)` | MODIFY — add required `onApplyToAll` to every render; ADD apply-to-all button tests |
| `lib/apply-to-all.ts` (+ `.test.ts`) | does not exist | OPTIONAL NEW — only if you extract the broadcast as a pure helper for unit testing (see Task 4); otherwise keep logic inline in `index.tsx` and skip this |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint.label` complete; no `EditorState`/`labelDefaults` change.
- `lib/fonts.ts` / `lib/fonts.test.ts` — `FONT_OPTIONS`/`resolveFontFamily` unchanged; apply-to-all copies the stored `fontFamily` label string, no font-resolution logic needed here.
- `components/Editor/PointPanel.tsx` — unchanged (mirror its button classes in `LabelPanel`, but do NOT edit `PointPanel`).
- `components/Editor/LabelLayer.tsx`, `LabelEditOverlay.tsx`, `Canvas.tsx` — they already render from `label.fontFamily/fontSize/color` (3.3); a `setPoints` change re-renders them for free. No prop or render change needed.
- `lib/swatch-layout.ts`, `lib/label-layout.ts`, `lib/color-sample.ts`, `EyedropperLayer.tsx` — layout/marker logic, irrelevant to label presentation.
- `app/layout.tsx`, `app/globals.css`, `styles.json`, `lib/styles.ts` — untouched.
- `ExportButton.tsx`, `StylePicker.tsx`, `StyleThumbnail.tsx`, `ContextMenu.tsx` — unrelated.

### Testing standards

- Vitest + RTL, co-located `*.test.tsx`/`*.test.ts` (`docs/project-context.md`). No `lint` script — `npx tsc --noEmit` is the static check.
- `LabelPanel.test.tsx` already mocks `@/lib/fonts` (`vi.mock("@/lib/fonts", ...)` with 6 `FONT_OPTIONS` + `resolveFontFamily: (s)=>s`) so the component renders without the real `next/font` transform — keep that mock; just add the new prop and tests under it.
- **Mock-update discipline:** adding required prop `onApplyToAll` breaks every existing `LabelPanel` render until updated — fix all 5 current `render(...)` calls (a `makeProps` helper is the clean way), then re-run `npx tsc --noEmit` (recurring 2.5/2.6/2.7/3.1/3.2/3.3 lesson).
- Query buttons by role/name: `getByRole("button", { name: "Font" })`. Assert the callback **argument is the field key** (`"fontFamily"`), not the visible label.
- **Don't stand up the whole `EditorShell`** for the broadcast test (3.3 precedent) — the `LabelPanel` test covers the button→callback wiring; if you want the map logic covered directly, extract the pure helper (Task 4 preferred option) rather than rendering `EditorShell`.

### Previous Story Intelligence (Story 3.3 + earlier)

- **3.3 finalized `LabelPanel`** as the right-panel edit-mode control set and the `{selectedPoint && labelEditMode}` switch in the `<aside>`. This story only *extends* `LabelPanel` and adds one prop at the same call site — no switching/wiring rework.
- **`handleUpdateLabel(id, patch)`** (`index.tsx:430–437`) is the per-field updater (text/font/size/color/show/x/y). `handleApplyToAll` is its all-points sibling — same `{ ...p, label: { ...p.label, [field]: value } }` merge shape, but mapped over **all** points and sourcing `value` from the selected point.
- **Refs/updater-not-closure** (3.1 "styleRef is the live style"; 3.2 "no `setPoints` inside a `setState` updater" / use refs not closures): read the selected point from `prev` inside `setPoints`, depend on `selectedPointId` only.
- **"Update props when you add a required prop"** (every story 2.5→3.3): the new `LabelPanel.onApplyToAll` will break `LabelPanel.test.tsx` renders and `tsc` until threaded — budget for it.
- **No-`swatch-layout`-on-presentation:** marker/side/add/remove re-run layout; pure label styling does not. Don't re-run it.
- **Deferred items NOT this story:** font-flash Konva redraw (`document.fonts.ready`), re-seed `label.x/y` on add/style-switch, free-floating swatches, custom styles (`deferred-work.md`). Don't fix opportunistically (CLAUDE.md §3 surgical changes).

### Project Structure Notes

- No new component, no new state container, no new dependency, no `lib/types.ts` change.
- Optional `lib/apply-to-all.ts` helper (only if extracted for unit testing) lives in `lib/` beside `lib/styles.ts`/`lib/fonts.ts`/`lib/label-layout.ts`. No conflict.
- `LabelPanel.tsx` stays editor-local (`components/Editor/`) — the documented ARCHITECTURE variance from 3.3 (twin of `PointPanel`); this story does not revisit it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: Apply-to-All Label Controls (lines 562–584)] — the 4 acceptance criteria (FR22).
- [Source: docs/SPEC.md#Label Editing (Step 5) (lines 164–165)] — "Global label controls: Apply font/size/color to all labels at once."
- [Source: docs/UI.md#In label editing mode (point selected) (lines 141–143)] — "Apply to all labels" block with `[ Font ] [ Size ] [ Color ]`, positioned between per-label controls and Export.
- [Source: docs/ARCHITECTURE.md:98–114] — `EyedropperPoint.label` shape (`fontFamily/fontSize/color` are the three apply-to-all fields).
- [Source: docs/ARCHITECTURE.md:119–125] — `swatch-layout.ts` keys on marker coords + `swatchSide` only → no layout re-run for label styling.
- [Source: lib/types.ts:22–24] — `label.fontSize/fontFamily/color` — the three fields; do NOT modify the type.
- [Source: lib/types.ts:3–7,38] — `LabelDefaults`/`EditorState.labelDefaults` — the new-label seed, NOT the apply-to-all target; leave untouched.
- [Source: components/Editor/LabelPanel.tsx] — the component to extend (append "Apply to all labels" section; add `onApplyToAll` prop).
- [Source: components/Editor/LabelPanel.test.tsx:7–17,34–88] — `@/lib/fonts` mock + 5 existing tests whose renders need the new prop.
- [Source: components/Editor/PointPanel.tsx:34–48] — swatch-side button styling to mirror for the three action buttons (without `aria-pressed`).
- [Source: components/Editor/index.tsx:430–442] — `handleUpdateLabel`/`handleUpdateLabelPos` (sibling pattern for `handleApplyToAll`).
- [Source: components/Editor/index.tsx:506–507] — `selectedPoint`/`selectedNumber` derivation (read from `prev` in the updater, not this closure).
- [Source: components/Editor/index.tsx:645–650] — `<LabelPanel label onUpdate/>` render (add `onApplyToAll`).
- [Source: components/Editor/index.tsx:660–665] — right-`<aside>` Export section below `LabelPanel` (placement of apply-to-all is automatic).
- [Source: _bmad-output/implementation-artifacts/3-3-label-dragging-and-per-label-controls.md] — `LabelPanel` creation, `handleUpdateLabel`, right-panel switch, refs-not-closures, "update props when touched," "don't stand up EditorShell," baseline 210 tests / 21 files.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — free-floating swatches / custom styles / font-flash redraw are future, NOT this story.
- [Source: docs/project-context.md] — testing standards (Vitest + RTL, co-located, `npm test`, `tsc --noEmit`), Tailwind v4 CSS-variable tokens.

### Review Findings

_Code review 2026-06-29 (combined 3.3 + 3.4; adversarial 3-layer: blind / edge-case / acceptance)._

✅ **Clean — no findings against 3.4.** All 4 ACs satisfied and every "do NOT build / do NOT touch" constraint respected: exactly three fields (`fontFamily`/`fontSize`/`color`, no text/visible/x/y broadcast); reads the selected value from `prev` inside the updater (not the render closure); depends only on `selectedPointId`; no `swatch-layout` re-run; `labelDefaults`/`EditorState`/`lib/types.ts` untouched; button text "Font"/"Size"/"Color" maps to the field-key argument. The Edge Case Hunter noted apply-to-all also writes to not-laid-out / hidden-label points (`applyFieldToAll` maps all points unconditionally) — harmless and consistent with the spec's "every point" wording; not actioned. All review fixes landed in 3.3's shared files; 221 tests passing, tsc clean.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npx vitest run lib/apply-to-all.test.ts` → 6 passed
- `npx vitest run components/Editor/LabelPanel.test.tsx` → 6 passed
- `npx vitest run` (full suite) → 22 files, 217 passed
- `npx tsc --noEmit` → exit 0 (clean)

### Completion Notes List

- **Test approach (Task 4):** Took the *preferred* option — extracted the broadcast logic into a pure `applyFieldToAll(points, selectedId, field)` helper in `lib/apply-to-all.ts` with a co-located `lib/apply-to-all.test.ts` (6 cases). This unit-tests the map/merge logic directly without standing up `EditorShell` (honoring the 3.3 "don't render the whole shell" precedent), while the `LabelPanel` test covers the button→callback wiring. The `handleApplyToAll` callback in `index.tsx` is a thin `setPoints((prev) => applyFieldToAll(prev, selectedPointId, field))` wrapper, so the live array comes from `prev` (no stale-closure read) and the callback depends only on the `selectedPointId` primitive.
- **Helper test asserts** every point's `label[field]` equals the selected value; that `text`/`x`/`y`/`visible` and the two non-applied font fields are untouched; and that a `null`/non-matching `selectedId` returns the same array reference unchanged.
- **No `swatch-layout.ts` re-run** — label font/size/color are pure presentation and never feed the no-crossing layout (which keys on marker coords + `swatchSide`). `handleApplyToAll` is a plain `setPoints` map, unlike `handleSetSide`/marker-drag-end/add/remove.
- **Mock-update discipline:** added the now-required `onApplyToAll` prop to all 5 existing `LabelPanel` renders via a new `makeProps(overrides)` helper, then added the Font/Size/Color button test. The button visible text ("Font"/"Size"/"Color") maps to the field key argument ("fontFamily"/"fontSize"/"color"); the test asserts the key.
- **No new runtime dependencies, no `lib/types.ts` change, no `labelDefaults`/`EditorState` touch** — all out-of-scope items left untouched.

### File List

- `eyedropper-web/lib/apply-to-all.ts` (NEW) — pure `applyFieldToAll` broadcast helper
- `eyedropper-web/lib/apply-to-all.test.ts` (NEW) — 6 unit tests for the helper
- `eyedropper-web/components/Editor/index.tsx` (MODIFY) — import helper; add `handleApplyToAll` callback; pass `onApplyToAll` to `<LabelPanel>`
- `eyedropper-web/components/Editor/LabelPanel.tsx` (MODIFY) — add `onApplyToAll` prop; append "Apply to all labels" section (Font/Size/Color buttons)
- `eyedropper-web/components/Editor/LabelPanel.test.tsx` (MODIFY) — `makeProps` helper threading the new required prop through all renders; add apply-to-all button test

## Change Log

- 2026-06-29 — Implemented Story 3.4 Apply-to-All Label Controls: added `applyFieldToAll` pure helper + tests, `handleApplyToAll` broadcast callback in `EditorShell`, and the Font/Size/Color "Apply to all labels" section in `LabelPanel`. All 4 ACs satisfied; 217 tests passing (22 files), `tsc --noEmit` clean. Status → review.
