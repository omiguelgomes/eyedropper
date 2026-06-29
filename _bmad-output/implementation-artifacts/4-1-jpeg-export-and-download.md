# Story 4.1: JPEG Export & Download

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to click "Download 9:16 JPEG" and get an instant, crisp download of my annotated canvas,
so that I can post the final image to Instagram or TikTok.

## Acceptance Criteria

1. **Given** the editor has points, styles, and labels configured **when** I click "Download 9:16 JPEG" in the right sidebar **then** the Konva stage is captured via `stage.toDataURL({ pixelRatio })`, the resulting data URL is POSTed to `/api/export`, and the server returns a JPEG blob.

2. **Given** `/api/export` receives the data URL **when** it processes the request **then** it converts the data URL to a JPEG at **quality 95** using Sharp and returns it as an `image/jpeg` response.

3. **Given** the browser receives the JPEG response **when** the download is triggered **then** the browser saves the file as `eyedropper-export.jpg` **without opening a new tab**.

4. **Given** the exported image is inspected **when** its dimensions are measured **then** it is **9:16 aspect ratio at 2× the original uploaded image's width** (e.g. original 800px wide → export **1600×2844px**).

5. **Given** the right sidebar renders with no point selected **when** it is inspected **then** "Download 9:16 JPEG" is shown in the Export section; the button is **always visible regardless of selection state** (it already is — `index.tsx:660–665` renders the Export `<section>` unconditionally).

6. **Given** the export is in-flight **when** the button state is checked **then** the button shows a **loading/disabled** state; on completion (success **or** error) it returns to its default enabled state.

7. **Given** I am in **label-edit mode** (`labelEditMode === true`) when I click Download **then** the exported JPEG still contains the labels. (Edit-mode labels are HTML `<input>` overlays that `toDataURL` cannot capture — see Dev Notes "Label-edit-mode export gap". This is a real correctness requirement, not optional polish.)

## Tasks / Subtasks

- [x] **Task 1: Implement `/api/export` route** (`app/api/export/route.ts` REPLACE the 2-line stub) (AC: 1, 2)
  - [x] Accept `POST` with JSON body `{ dataUrl: string }`. Parse with `await request.json()` inside a `try/catch` → return `400 { error: "Invalid request body" }` on parse failure (mirror `app/api/suggest/route.ts:26–30`).
  - [x] Validate `dataUrl` is a non-empty string starting with `data:image/`; else `400 { error: "Invalid data URL" }`.
  - [x] Strip the data-URL prefix and decode base64 to a `Buffer`: `const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, ""); const buffer = Buffer.from(base64, "base64")`.
  - [x] Convert to JPEG with Sharp at quality 95 and return the bytes:
    ```ts
    const jpeg = await sharp(buffer).jpeg({ quality: 95 }).toBuffer()
    return new NextResponse(jpeg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="eyedropper-export.jpg"',
      },
    })
    ```
  - [x] Wrap the Sharp call in `try/catch` → `500 { error: "Export failed" }` on a decode/encode error. Import shape: `import sharp from "sharp"` and `import { NextRequest, NextResponse } from "next/server"` (match `app/api/upload/route.ts:1–2,21,28`).
  - [x] **Do NOT resize, pad, or change dimensions server-side.** The incoming data URL is already the final 9:16 bitmap at the correct resolution (the client sets `pixelRatio` — Task 2). Sharp only re-encodes PNG→JPEG q95; it must not alter width/height. (FR24/NFR8: dimensions are produced client-side by the pixelRatio; `canvas-to-916.ts` already guarantees the 9:16 canvas shape.)

- [x] **Task 2: Lift the Konva stage ref so the shell can capture it** (`components/Editor/Canvas.tsx` + `components/Editor/index.tsx` MODIFY) (AC: 1, 4)
  - [x] In `Canvas.tsx`: add a prop `stageRef: React.RefObject<Konva.Stage | null>` and pass it to `<Stage ref={stageRef}>` (currently `Canvas.tsx:60` uses a **local** `useRef`). **Replace** the local `stageRef` with the passed-in prop so the existing cursor-reset effect (`Canvas.tsx:66–71`) keeps working through the same ref. Keep `import type Konva from "konva"` (already at `Canvas.tsx:6`).
  - [x] In `EditorShell` (`index.tsx`): create `const stageRef = useRef<Konva.Stage | null>(null)` (add `import type Konva from "konva"`). Pass `stageRef={stageRef}` into `<Canvas ... />` (the render block at `index.tsx:613–634`).
  - [x] **pixelRatio is computed, not the literal `2`.** The stage is rendered downscaled: `scale = displayWidth / canvasLayout.canvasWidth` (`Canvas.tsx:59`). To make the exported bitmap exactly **2× the original image width** (AC4), the export must use `pixelRatio = (2 * canvasLayout.canvasWidth) / displaySize.width` (equivalently `2 / scale`). A literal `pixelRatio: 2` would yield `2 × displayWidth` (the on-screen size), which is **wrong** and fails AC4. See Dev Notes "pixelRatio math" for the derivation. `canvasLayout.canvasWidth === imageWidth` (original width — `canvas-to-916.ts:8`), so this yields width `2 × imageWidth` and height `2 × canvasHeight`, preserving 9:16.

- [x] **Task 3: Add the export handler in `EditorShell`** (`components/Editor/index.tsx` MODIFY) (AC: 1, 3, 4, 7)
  - [x] Add `const handleExport = useCallback(async () => { ... }, [...])` that:
    1. Reads `const stage = stageRef.current; const layout = canvasLayoutRef.current; const display = displaySize`. If any is missing, return (no-op).
    2. Computes `const pixelRatio = (2 * layout.canvasWidth) / display.width`.
    3. **Handles the label-edit-mode gap (AC7):** if `labelEditMode` is `true`, the Konva `LabelLayer` is not mounted (`Canvas.tsx:136`) and labels live only in the HTML `LabelEditOverlay` — so `toDataURL` would omit them. Before capturing, ensure the Konva labels are present. **Recommended minimal approach:** turn off edit mode for the capture — `if (labelEditModeRef.current) setLabelEditMode(false)`, then capture on the next paint (the capture must run after React commits the `LabelLayer`). Use a `requestAnimationFrame` (or a short `await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`) before `toDataURL` so the newly-mounted `LabelLayer` has rendered. Do **not** silently drop labels. (See Dev Notes for the exact recipe and the alternative if you prefer not to toggle mode.)
    4. `const dataUrl = stage.toDataURL({ pixelRatio })`.
    5. `POST` to `/api/export` with `{ dataUrl }`, read the response as a blob, and trigger a download (Task 4 helper).
    6. Throw on `!res.ok` so the button's catch (Task 5) clears the loading state and the user is not left thinking it worked.
  - [x] `handleExport` must `return`/`throw` a Promise so `ExportButton` can `await` it for its loading state. Depend on the primitives/refs it reads (e.g. `[displaySize]`; layout & stage & labelEditMode are read via refs).
  - [x] Pass `onExport={handleExport}` to `<ExportButton onExport={handleExport} />` (`index.tsx:664`).

- [x] **Task 4: Browser download helper** (`lib/download.ts` NEW + `lib/download.test.ts` NEW) (AC: 3)
  - [x] Export `function triggerDownload(blob: Blob, filename: string): void` that creates an object URL, makes a hidden `<a>` with `download = filename`, appends it, `.click()`s, removes it, and revokes the URL:
    ```ts
    export function triggerDownload(blob: Blob, filename: string): void {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
    ```
  - [x] The `download` attribute (+ same-origin object URL) is what prevents a new tab (AC3). Do not `window.open`. Call it from `handleExport` with `("eyedropper-export.jpg")`.
  - [x] **Why a `lib/` helper:** the anchor/blob/URL dance is the only part of the export that is awkward to assert from a component test, so isolating it makes AC3 unit-testable (mirrors the project's "extract a pure-ish helper for the hard-to-test bit" pattern — cf. 3.4 `lib/apply-to-all.ts` guidance).

- [x] **Task 5: Wire `ExportButton` to the handler with a loading state** (`components/ExportButton.tsx` REPLACE) (AC: 5, 6)
  - [x] New prop: `onExport: () => Promise<void>`. Add local `const [isExporting, setIsExporting] = useState(false)`. On click: `setIsExporting(true); try { await onExport() } finally { setIsExporting(false) }`.
  - [x] While `isExporting`: `disabled`, show label "Exporting…" and the `disabled:opacity-60 cursor-wait` look; otherwise enabled, label "Download 9:16 JPEG". Reuse the existing accent styling (`bg-[var(--color-accent)] text-white`), just drop the permanent `disabled`/`opacity-60`/`cursor-not-allowed` and make them conditional on `isExporting`.
  - [x] `"use client"` is required (it now has state + a click handler). Keep it a default export.

- [x] **Task 6: Write tests** (AC: all)
  - [x] **`app/api/export/route.test.ts` (NEW):** mock `sharp` (mirror `app/api/upload/route.test.ts:7–11` — `vi.mock("sharp", () => ({ default: vi.fn(() => mockSharpInstance) }))` with `jpeg: vi.fn().mockReturnValue({ toBuffer: vi.fn().mockResolvedValue(Buffer.from("jpeg")) })`). Assert: (a) valid `{ dataUrl: "data:image/png;base64,AAAA" }` → 200, `Content-Type: image/jpeg`, `sharp(...).jpeg` called with `{ quality: 95 }`, body equals the mocked buffer; (b) base64 is decoded and passed to `sharp` (assert the `sharp` mock was called with a `Buffer`); (c) missing/empty `dataUrl` → 400; (d) non-`data:image/` string → 400; (e) `toBuffer` rejecting → 500. Build the request with `{ json: vi.fn().mockResolvedValue({ dataUrl }) } as any` (mirror the upload test's `makeReq`).
  - [x] **`lib/download.test.ts` (NEW):** stub `URL.createObjectURL`/`URL.revokeObjectURL` (`vi.fn()`), spy on `document.createElement`/`HTMLAnchorElement.prototype.click`. Assert `triggerDownload(blob, "eyedropper-export.jpg")` sets `a.download === "eyedropper-export.jpg"`, calls `.click()` once, and revokes the object URL. (jsdom is the configured env — `vitest.config.ts` / `vitest.setup.ts`.)
  - [x] **`components/ExportButton.test.tsx` (NEW):** render with `onExport={vi.fn().mockResolvedValue(undefined)}`. Assert: default button has accessible name "Download 9:16 JPEG" and is enabled; clicking calls `onExport`; during a pending `onExport` (resolve a controlled promise) the button is disabled / shows "Exporting…"; after resolution it re-enables; if `onExport` rejects, the button still re-enables (AC6 — use a rejecting mock and assert no unhandled error + button enabled). Use `@testing-library/user-event` (already a dep).
  - [x] **Do NOT stand up the whole `EditorShell`** to test `handleExport` (established 3.3/3.4 precedent). The stage-capture + fetch wiring in `index.tsx` is covered transitively by the route test (server side), the download test (browser side), and the ExportButton test (loading/UX). A full Konva-stage integration render is out of proportion; note this choice in Completion Notes.
  - [x] Run `npm test` — all pass, no regressions. **Baseline: 210 passing across 21 files** (Story 3.4). Report new totals (expect +~12–15 tests, +3 files).
  - [x] Run `npx tsc --noEmit` — clean. New required props (`Canvas.stageRef`, `ExportButton.onExport`) must be threaded at their single call sites in `index.tsx` and added to any test renders.

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from there; static check is `npx tsc --noEmit` (there is no `lint` script). Versions: Next **15.5.19** (App Router, Turbopack), React **19.1.0**, Konva **^10.3.0**, react-konva **^19.2.5**, Sharp **^0.35.1**, Vitest **^4.1.8**, @testing-library/react **^16.3.2**, @testing-library/user-event **^14.6.1**. **No new runtime dependencies** — `sharp` and `konva` are already installed. Do NOT add anything.

### Scope — what this story IS and IS NOT

This is the **first story of Epic 4** and delivers the export half of FR24/FR25/FR26 + NFR5/NFR8. It turns the placeholder `ExportButton` (`components/ExportButton.tsx`, currently a permanently-`disabled` button) into a working "capture stage → POST → download JPEG" flow.

**IN scope:** `/api/export` route (PNG data URL → JPEG q95 via Sharp); lifting the Konva stage ref to the shell; an export handler that captures at the correct `pixelRatio` (2× original width, 9:16); a browser download helper; `ExportButton` wired with a loading state; ensuring labels appear in the export even from edit mode (AC7); tests for all of the above.

**OUT of scope — do NOT build:**
- **Upload cleanup cron** (`/tmp` 1-hour deletion, `vercel.json`) → **Story 4.2** (the other Epic 4 story). FR28 is 4.2, not here.
- **Server-side re-render from full state** (Pillow / re-running the layout server-side). `docs/ARCHITECTURE.md:76–78` and `docs/DECISIONS.md:9–10` explicitly choose **client-side `stage.toDataURL`** for v1. The server only re-encodes the bitmap to JPEG. Do not serialize/re-render points server-side.
- **Resizing/padding in `/api/export`.** The data URL is already the final 9:16 bitmap; Sharp only changes the codec (PNG→JPEG q95). Do NOT call `.resize()`/`.extend()`.
- **A second `/api/export` body shape** (`{ id, points, style, labels }` from `docs/SPEC.md:64`). That is the *alternative* server-render design the DECISIONS doc rejected for v1. Use `{ dataUrl }`.
- **Disabling export when there are 0 points.** AC5 says always visible/usable; exporting the bare padded image is valid.
- Any change to the editor's interaction model, swatch layout, label logic, or styles.

### pixelRatio math (AC4) — the key gotcha

The Konva `<Stage>` is rendered **downscaled to fit the viewport**:
- `Canvas.tsx:59`: `const scale = displayWidth / canvasLayout.canvasWidth`
- `Canvas.tsx:75–76`: `<Stage width={displayWidth} height={displayHeight} scaleX={scale} scaleY={scale}>`
- Content is authored in **canvas space** (`0..canvasWidth × 0..canvasHeight`) and scaled by `scale` onto the `displayWidth × displayHeight` stage.

`stage.toDataURL({ pixelRatio: p })` outputs a bitmap of `(displayWidth·p) × (displayHeight·p)`. To make the output width equal **2× the original image width** (= `2 · canvasWidth`, since `canvasWidth === imageWidth` per `canvas-to-916.ts:8`):

```
displayWidth · p = 2 · canvasWidth
⇒ p = (2 · canvasWidth) / displayWidth   ( = 2 / scale )
```

Because `canvasHeight = round(canvasWidth · 16/9)` (`canvas-to-916.ts:9`), the height comes out `2 · canvasHeight` and the **9:16 ratio is preserved** (NFR5). Worked example (AC4): original 800px → `canvasWidth=800`, `canvasHeight=round(1422.2)=1422` → export `1600 × 2844`. ✓

**Why the spec/FR25's literal `pixelRatio: 2` is not used verbatim:** that value assumes the stage is at full image resolution. Here the stage is downscaled, so a literal `2` would export `2 × displayWidth` (a few hundred px wide), failing AC4. The dimension AC (FR24/NFR8, concrete & testable) governs; compute `pixelRatio` from the live layout. (Flagged as a question for Miguel — see end.)

### Label-edit-mode export gap (AC7) — must handle, do not ignore

Labels render in **two different, mutually-exclusive ways**:
- **Display mode** (`labelEditMode === false`): `LabelLayer.tsx` draws Konva `<Text>` nodes **inside the Stage** (`Canvas.tsx:136 {!labelEditMode && <LabelLayer .../>}`). These **are** captured by `toDataURL`. ✓
- **Edit mode** (`labelEditMode === true`): `LabelLayer` is **unmounted**; labels are HTML `<input>` elements in `LabelEditOverlay.tsx`, positioned absolutely **on top of** the canvas (`Canvas.tsx:145–155`). HTML overlays are **not part of the Konva stage** and are **invisible to `toDataURL`**. ✗

So exporting while in edit mode (a very common moment — the artist just finished typing labels) would silently drop every label. AC7 forbids that.

**Recommended minimal fix (in `handleExport`):** if `labelEditModeRef.current` is true, call `setLabelEditMode(false)` so the Konva `LabelLayer` mounts, wait for React to commit + Konva to paint, then capture:
```ts
if (labelEditModeRef.current) {
  setLabelEditMode(false)
  // wait two frames: one for React commit (LabelLayer mounts), one for Konva paint
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
}
const dataUrl = stage.toDataURL({ pixelRatio })
```
`labelEditModeRef` already exists and mirrors `labelEditMode` (`index.tsx:153–156`) — read it (not the closure). Leaving edit mode is acceptable UX (the spec treats export as a terminal step) and the labels persist as static Konva text. **Acceptable alternative** if you'd rather not change mode: render the Konva `LabelLayer` unconditionally for the capture (more invasive to `Canvas.tsx`). Pick one, make it actually work, and record the choice in Completion Notes. Display-mode export (the default) needs no special handling — labels are already on the stage.

### Canvas is not tainted — `toDataURL` will work

The source image is loaded with `crossOrigin = "anonymous"` from the **same-origin** `/api/image?id=` route (`index.tsx:179–198`). Same-origin + anonymous CORS means the Konva canvas is **not tainted**, so `stage.toDataURL()` succeeds (a cross-origin taint would throw a `SecurityError`). No action needed — just don't introduce a cross-origin image source.

### Stage ref lifting — the wiring

Today `stageRef` is a **local** `useRef` inside `Canvas.tsx:60`, used only by the cursor-reset effect (`Canvas.tsx:66–71`). The export handler lives in `EditorShell` (it needs `canvasLayoutRef`, `displaySize`, and `labelEditMode` — all already there). So: create the ref in the shell, pass it down, and have `Canvas` use the passed ref for **both** `<Stage ref={...}>` and its existing cursor effect (the effect logic is unchanged — it just reads the prop ref instead of a local one). This is the same "owner holds the ref, child attaches it" pattern. `react-konva`'s `<Stage ref>` resolves to the underlying `Konva.Stage` (which exposes `.toDataURL()` and `.container()`).

### Data URL → JPEG on the server

`stage.toDataURL()` returns a **PNG** data URL by default (`data:image/png;base64,...`). The route strips the prefix, base64-decodes to a `Buffer`, and pipes it through `sharp(buffer).jpeg({ quality: 95 }).toBuffer()` → returns `image/jpeg`. PNG→JPEG via Sharp avoids the double-JPEG-artifact path and is the same Sharp usage already proven in `app/api/upload/route.ts:28` (`.jpeg({ quality: 95 })`). Body size: a 1600px-wide PNG base64 is a few MB; App-Router Route Handlers stream the body and do **not** impose the old 1 MB pages-API `bodyParser` limit, so no `config` export is needed.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `app/api/export/route.ts` | 2-line stub returning `{ ok: true }` | **REPLACE** — `{ dataUrl }` → Sharp JPEG q95 → `image/jpeg` blob |
| `components/Editor/Canvas.tsx` | local `stageRef`; `<Stage ref={stageRef}>` | MODIFY — accept `stageRef` prop, attach it to `<Stage>`, drop the local ref |
| `components/Editor/index.tsx` | renders `<Canvas>` and `<ExportButton/>` (no props) | MODIFY — own `stageRef`; add `handleExport`; pass `stageRef` to `<Canvas>` and `onExport` to `<ExportButton>` |
| `components/ExportButton.tsx` | permanently-`disabled` placeholder | **REPLACE** — `"use client"`, `onExport` prop, `isExporting` loading state |
| `lib/download.ts` (+ `.test.ts`) | does not exist | NEW — `triggerDownload(blob, filename)` |
| `app/api/export/route.test.ts` | does not exist | NEW — route tests (mock Sharp) |
| `components/ExportButton.test.tsx` | does not exist | NEW — button + loading-state tests |

### Files NOT to touch

- `lib/canvas-to-916.ts` — read it for the dimension math; the layout is already correct. No change.
- `lib/swatch-layout.ts`, `lib/color-sample.ts`, `lib/styles.ts`, `lib/fonts.ts`, `lib/label-layout.ts`, `lib/drag-utils.ts` — irrelevant to export.
- `components/Editor/EyedropperLayer.tsx`, `LabelLayer.tsx`, `LabelEditOverlay.tsx`, `ContextMenu.tsx`, `PointPanel.tsx`, `LabelPanel.tsx` — they render into the stage/overlay already; export captures the stage as-is. (The only label concern is AC7, handled in `handleExport`, not in these files.)
- `app/api/upload/route.ts`, `app/api/image/route.ts`, `app/api/suggest/route.ts` — unrelated (read upload/suggest/image for **mock & Sharp patterns** only).
- `app/editor/page.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `styles.json` — untouched.
- `components/StylePicker.tsx`, `StyleThumbnail.tsx`, `components/LabelPanel.tsx` (the stray top-level one) — unrelated.

### Testing standards

- Vitest + RTL, **co-located** `*.test.ts(x)` next to the file under test (`docs/project-context.md`). jsdom env (`vitest.config.ts`).
- **API route tests:** mock `sharp` (and don't touch the filesystem). Follow `app/api/upload/route.test.ts` exactly for the `vi.mock("sharp", …)` shape and the `{ json: vi.fn().mockResolvedValue(...) } as any` request stub. Assert response `status`, `headers.get("Content-Type")`, and `Buffer.from(await res.arrayBuffer())` for the body (see `app/api/image/route.test.ts:73–83` for the binary-body assertion recipe).
- **`lib/download.ts`:** pure DOM helper — stub `URL.createObjectURL`/`revokeObjectURL` and spy on anchor `click`. No network.
- **`ExportButton`:** test the loading/disabled transition with a controlled (deferred) promise; assert it re-enables on both resolve and reject (AC6).
- **Mock-update discipline:** adding required props `Canvas.stageRef` and `ExportButton.onExport` will break `tsc` and any existing renders until threaded. `Canvas` has **no** existing `.test.tsx` render that passes all props as a unit besides `Canvas.test.tsx` — check it: if `Canvas.test.tsx` renders `<Canvas>`, add a `stageRef={{ current: null }}` (or `createRef()`); if it mocks `react-konva`, the new prop is inert but must still satisfy the type. Re-run `npx tsc --noEmit` after wiring (recurring 2.5→3.4 lesson: "update props/renders when you add a required prop").
- **Don't stand up `EditorShell`** for `handleExport` (3.3/3.4 precedent) — the three new test files cover server, browser-download, and button-UX respectively.

### Previous Story Intelligence (Epic 2–3)

- **Refs-not-closures / read live state from refs** (3.1 "styleRef is the live style"; 3.2/3.3/3.4): `handleExport` must read `canvasLayoutRef.current` and `labelEditModeRef.current`, **not** the render-closure `canvasLayout`/`labelEditMode`, so a stable `useCallback` always sees current values. These refs already exist (`index.tsx:134,153`).
- **"Update props when you add a required prop"** (every story 2.5→3.4): budget for threading `Canvas.stageRef` + `ExportButton.onExport` and fixing renders/`tsc`.
- **Extract the hard-to-test bit into `lib/`** (3.4 `lib/apply-to-all.ts` guidance): the DOM download dance → `lib/download.ts` so AC3 is unit-testable without `EditorShell`.
- **"Don't stand up the whole EditorShell"** for a focused behavior (3.3/3.4): applies to `handleExport`.
- **Sharp q95 precedent:** `app/api/upload/route.ts:28` already does `.jpeg({ quality: 95 })` — reuse the exact call/import.
- **Deferred items intentionally NOT addressed here** (`deferred-work.md`): `runSuggest` AbortController/sequence guard, module-global `pointIdCounter`, dense-edge swatch overlap, `detectBorderColor` perf, `/api/image` sync FS, stale context-menu coords. None are touched by export; do **not** opportunistically fix them (CLAUDE.md §3 surgical changes).

### Project Structure Notes

- New `lib/download.ts` sits beside the other `lib/*.ts` utilities (`canvas-to-916.ts`, `styles.ts`, etc.) — consistent with `docs/ARCHITECTURE.md:26–30`.
- New `app/api/export/route.test.ts` co-locates with the route it tests, matching `upload`/`suggest`/`image`.
- `ExportButton.tsx` stays at `components/` top level (it already lives there, `docs/ARCHITECTURE.md:24`); it is imported by `index.tsx:19`. No move.
- No `lib/types.ts` change, no new state container, no new dependency.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: JPEG Export & Download (lines 592–622)] — the 6 source acceptance criteria (FR24/FR25/FR26).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 (lines 140–144)] — Epic scope: export + cleanup; NFR5 (9:16 always), NFR8 (q95 @ 2×).
- [Source: docs/SPEC.md#Export (lines 170–177)] — JPEG q95, 9:16 at 2× original width, exact canvas state, download on click.
- [Source: docs/ARCHITECTURE.md#Export (lines 68–78)] — client `stage.toDataURL({ pixelRatio: 2 })` → POST `/api/export` → JPEG blob → browser download; v1 = client-side capture (server re-render deferred to v2).
- [Source: docs/DECISIONS.md (lines 9–10)] — why client-side `stage.toDataURL` over server re-render for v1.
- [Source: docs/UI.md#Right sidebar (lines 99–148)] — Export section is always present (default & selected & edit-mode panels all end with "Download 9:16 JPEG").
- [Source: lib/canvas-to-916.ts:7–14] — `canvasWidth = imageWidth`, `canvasHeight = round(imageWidth·16/9)` → the dimension math behind `pixelRatio = 2·canvasWidth/displayWidth` and the 1600×2844 worked example.
- [Source: components/Editor/Canvas.tsx:59,75–76] — `scale = displayWidth/canvasWidth` and the downscaled `<Stage>` — the reason `pixelRatio` must be `2/scale`, not `2`.
- [Source: components/Editor/Canvas.tsx:60,66–71] — local `stageRef` + cursor effect to convert to a passed-in prop ref.
- [Source: components/Editor/Canvas.tsx:136,145–155] — `LabelLayer` mounted only in display mode; `LabelEditOverlay` (HTML) in edit mode — the AC7 export gap.
- [Source: components/Editor/LabelLayer.tsx:20–44] — Konva `<Text>` labels that DO export (display mode).
- [Source: components/Editor/LabelEditOverlay.tsx:44–124] — HTML `<input>` labels that DO NOT export (edit mode).
- [Source: components/Editor/index.tsx:119–203] — `EditorShell`: `canvasLayoutRef` (134), `displaySize` (126,166–174), `labelEditMode`/`labelEditModeRef` (149,153–156), image loaded `crossOrigin="anonymous"` from `/api/image` (179,198) → no canvas taint.
- [Source: components/Editor/index.tsx:613–634] — `<Canvas>` render block (add `stageRef`).
- [Source: components/Editor/index.tsx:660–665] — right-`<aside>` Export `<section>` rendering `<ExportButton/>` (always visible; add `onExport`).
- [Source: components/ExportButton.tsx:1–11] — the placeholder to replace.
- [Source: app/api/upload/route.ts:1–2,21,28] — Sharp import + `.jpeg({ quality: 95 })` call to mirror; `NextResponse` usage.
- [Source: app/api/suggest/route.ts:26–30] — `try/catch` around `request.json()` → 400 pattern.
- [Source: app/api/upload/route.test.ts:3–14,16–20] — `vi.mock("sharp")` shape + `makeReq` request stub to mirror in the export route test.
- [Source: app/api/image/route.test.ts:73–83] — binary-body assertion (`Buffer.from(await res.arrayBuffer())`).
- [Source: _bmad-output/implementation-artifacts/3-4-apply-to-all-label-controls.md] — refs-not-closures, "update props when touched," "extract pure helper for testing," "don't stand up EditorShell," baseline 210 tests / 21 files.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — pre-existing deferred items NOT in this story's scope.
- [Source: docs/project-context.md] — testing standards (Vitest + RTL, co-located, `npm test`, `tsc --noEmit`), hydration rules, Tailwind v4 CSS-variable tokens.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

- `npx vitest run` → 25 files / 233 tests passing (baseline 21/210 → +3 new files, +1 updated render, +23 tests).
- `npx tsc --noEmit` → clean.

### Completion Notes List

- **Task 1 — `/api/export`:** Replaced the stub with `POST { dataUrl } → sharp.jpeg({ quality: 95 }).toBuffer() → image/jpeg`. Validates body JSON (400 "Invalid request body") and the `data:image/` prefix (400 "Invalid data URL"); 500 "Export failed" on a Sharp decode/encode error. No `.resize()`/`.extend()` — Sharp only re-encodes PNG→JPEG. **Note:** the response body is wrapped in `new Uint8Array(jpeg)` rather than the raw `Buffer` — Sharp's `toBuffer()` is typed `Buffer<ArrayBufferLike>`, which is not assignable to `BodyInit` under this tsconfig; `Uint8Array` is. (The `app/api/image` route passes a `readFileSync` buffer which happens to type-check; the Sharp return type does not.)
- **Task 2 — stage ref:** `Canvas` now takes a required `stageRef` prop and attaches it to `<Stage>`; the local `useRef` was removed. The existing cursor-reset effect reads the same passed-in ref unchanged. `Canvas.test.tsx` `makeProps` was given `stageRef: { current: null }` to satisfy the new required prop.
- **Task 3 — `handleExport`:** Computes `pixelRatio = (2 * layout.canvasWidth) / display.width` (= `2 / scale`) from `canvasLayoutRef`, not the render closure, per the refs-not-closures convention. **AC7 (label-edit gap):** if `labelEditModeRef.current`, calls `setLabelEditMode(false)` then `await`s two `requestAnimationFrame`s (React commit → Konva paint) so the Konva `LabelLayer` is mounted and captured. Throws on `!res.ok` so the button clears its loading state on failure.
- **Task 4 — `lib/download.ts`:** `triggerDownload(blob, filename)` — object URL + hidden `<a download>` + click + revoke. No `window.open` (AC3).
- **Task 5 — `ExportButton`:** Now `"use client"` with an `onExport` prop and an `isExporting` state. A `catch {}` swallows export errors (the button has no error UI in this story; the only requirement is that it re-enables — AC6) so the click handler does not surface an unhandled rejection.
- **Testing scope:** Per 3.3/3.4 precedent I did **not** stand up the whole `EditorShell` to test `handleExport`. The wiring is covered transitively — server side by `route.test.ts`, browser-download side by `download.test.ts`, button UX by `ExportButton.test.tsx`.
- **AC4 pixelRatio decision:** Implemented the computed `pixelRatio` (not the spec's literal `2`) as the story Dev Notes direct, because the stage is rendered downscaled and a literal `2` would fail the concrete dimension AC. Flagged in the story as a question for Miguel; the dimension AC (FR24/NFR8) governs.

### File List

- `eyedropper-web/app/api/export/route.ts` (REPLACED)
- `eyedropper-web/app/api/export/route.test.ts` (NEW)
- `eyedropper-web/components/Editor/Canvas.tsx` (MODIFIED — `stageRef` prop)
- `eyedropper-web/components/Editor/Canvas.test.tsx` (MODIFIED — `stageRef` in makeProps)
- `eyedropper-web/components/Editor/index.tsx` (MODIFIED — own `stageRef`, `handleExport`, wire `ExportButton`)
- `eyedropper-web/components/ExportButton.tsx` (REPLACED)
- `eyedropper-web/components/ExportButton.test.tsx` (NEW)
- `eyedropper-web/lib/download.ts` (NEW)
- `eyedropper-web/lib/download.test.ts` (NEW)

## Review Findings

_Code review 2026-06-29 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: all 7 ACs satisfied, no out-of-scope work. 7 findings dismissed as false positives (stale-displaySize closure — canvasLayout is fixed after load so the `[displaySize]` closure is always consistent; pixelRatio→Infinity — export size is viewport-invariant and the `<1024px` mobile guard blocks small viewports; JPEG transparency→black — the bg `<Rect>` fills the whole canvas so the PNG is opaque; swallowed error UI — per AC6; stageRef-not-in-deps — stable ref; rapid double-click — `setIsExporting(true)` flushes before the first await; unmount-during-export — React-benign)._

- [x] [Review][Patch] Add a request-body size guard to `/api/export` AND `/api/upload` — FIXED 2026-06-29: both routes reject `content-length > 50MB` with 413 before buffering; `/api/export` also caps the parsed `dataUrl` length. (resolved from decision: harden both image endpoints)
- [x] [Review][Patch] Tighten `/api/export` data-URL validation to match the strip regex — FIXED 2026-06-29: single regex `^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$` now both validates and captures the payload (rejects SVG / non-`;base64,` URLs before Sharp); zero-length buffers return 400.
- [x] [Review][Patch] Defer `URL.revokeObjectURL` until after the download dispatches — FIXED 2026-06-29: revocation moved to `setTimeout(…, 0)`; `lib/download.test.ts` updated to use fake timers and assert deferred revoke.
- [x] [Review][Defer] AC7 capture uses a fixed 2-frame `requestAnimationFrame` wait, not synchronized to Konva draw completion or web-font readiness [components/Editor/index.tsx:513-520] — deferred, refinement of a story-prescribed recipe (labels could rarely be missing/wrong-font on first paint or when the italic font is still loading; consider `await document.fonts.ready` + an explicit Konva `batchDraw`).
- [x] [Review][Defer] Very large uploads exceed the browser canvas size cap at 2× pixelRatio [components/Editor/index.tsx:507,520] — deferred, pre-existing (no dimension clamp at `/api/upload`); `toDataURL` returns `""` → POST `data:,` → 400 → silent export failure for huge source images.
- [x] [Review][Defer] `handleExport` (pixelRatio math for AC4, edit-mode toggle for AC7) has no automated test [components/Editor/index.tsx:498-529] — deferred, story-sanctioned ("don't stand up EditorShell"), but AC4 & AC7 are inspection-only; consider extracting the pixelRatio computation into a pure `lib/` fn to unit-test (mirrors the `lib/download.ts` precedent).

## Change Log

- 2026-06-29 — Story 4.1 implemented: `/api/export` (PNG data URL → JPEG q95 via Sharp), lifted Konva stage ref to `EditorShell`, `handleExport` capturing at computed pixelRatio (2× original width, 9:16) with label-edit-mode handling (AC7), `lib/download.ts` helper, and `ExportButton` wired with a loading state. Tests: 25 files / 233 passing; `tsc --noEmit` clean.
- 2026-06-29 — Code review (3 layers). All 7 ACs satisfied. 3 patches applied: 50MB body-size guard on `/api/export` + `/api/upload` (413), tightened `/api/export` data-URL regex (rejects SVG/non-base64, 400 on empty buffer), deferred `URL.revokeObjectURL`. 3 items deferred to `deferred-work.md`, 7 dismissed. Tests now 238 passing; `tsc --noEmit` clean. Status → done.
