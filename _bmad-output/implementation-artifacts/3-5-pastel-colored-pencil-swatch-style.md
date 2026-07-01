---
baseline_commit: 560de0d94d02f14a50f4a6b11dce14ba696562f9
---

# Story 3.5: Pastel / Colored-Pencil Swatch Style

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want a built-in "pastel" annotation style that renders each swatch as a colored-pencil scribble inside a rough chalk ring (with a matching handwriting label font),
so that my exported palettes match the hand-drawn look of my real annotated studies instead of looking like flat digital circles.

## Acceptance Criteria

1. **Given** the left-sidebar Style picker renders **when** it lists the built-in styles **then** a fifth style, `pastel`, appears in the strip alongside `float_clean`, `float`, `grid`, `minimal`, is selectable, and highlights with the accent border when active — exactly like the existing four (Story 3.1 behavior, unchanged).

2. **Given** `styles.json` is loaded **when** `lib/styles.ts` parses it **then** all five styles are typed against the extended `Style` schema; the four existing styles parse and render **unchanged** (the new texture fields are optional/absent on them), and the `pastel` entry carries `swatchTexture: "/textures/swatch-pencil.png"` and `borderTexture: "/textures/swatch-border.png"`.

3. **Given** the `pastel` style is active and points exist **when** `EyedropperLayer` renders a swatch **then** it draws the textured swatch per the `public/textures/README.md` pipeline — a disc filled with the point's **sampled color**, the `swatch-pencil` texture multiplied over it and clipped to the pencil's feathered alpha, and the `swatch-border` chalk ring drawn on top — instead of the flat-fill `Circle`. The point's sampled color reads through faithfully (the pencil darkens ≤~22%).

4. **Given** any of the four existing styles is active **when** `EyedropperLayer` renders a swatch **then** it uses the current flat-fill `Circle` + crisp stroke path (no texture fields present → fall back). No visual or behavioral change to the existing styles.

5. **Given** the `pastel` textured swatch is on the canvas **when** the user drags, selects (click), or removes (right-click) it, and when the canvas is exported **then** all of these behave identically to a flat swatch: the swatch is draggable and clamped to the 9:16 canvas via the same `dragBoundFunc`, selectable via `onClick` (`cancelBubble`), removable via `onContextMenu`, and appears correctly in the exported JPEG. Hidden-canvas color sampling and the original image pixels are untouched.

6. **Given** the multiply/alpha compositing of the textured swatch **when** it renders over the drawing **then** the composite is isolated to the swatch itself and does NOT tint or erase the underlying photo or neighbouring swatches (the textured swatch renders inside a cached, isolated Konva `Group`).

7. **Given** `lib/fonts.ts` **when** the font system loads **then** `Caveat` (from `next/font/google`, upright marker/handwriting) is available: registered at module scope, included in `fontVariables` (attached to `<body>` via `app/layout.tsx`), and present in `FONT_OPTIONS` so it is selectable in the per-label font dropdown and resolvable by `resolveFontFamily`.

8. **Given** a webfont finishes loading after Konva has already rasterized text (FOUT) **when** `document.fonts.ready` resolves **then** the Konva stage redraws once so canvas labels (including `Caveat`) repaint in the correct font rather than staying on the fallback until an unrelated re-render.

9. **Given** the Style picker thumbnails render **when** the `pastel` thumbnail is generated **then** it visibly reflects the pastel style at thumbnail scale (textured/rough swatch appearance rather than a flat disc) using the same shared sample image, and renders without error when the texture images have not yet loaded (neutral fallback, no crash).

## Tasks / Subtasks

- [x] Task 1: Extend the `Style` schema with optional texture fields (AC: 2, 4)
  - [x] In `lib/styles.ts`, add two OPTIONAL fields to the `Style` interface: `swatchTexture?: string` and `borderTexture?: string` (public paths, e.g. `/textures/swatch-pencil.png`). Keep every existing field exactly as-is. Because they are optional, the four existing `styles.json` entries remain valid with no edits to their objects.
  - [x] Do NOT add a `connectorType` variant or any brush-stroke connector field — the hand-drawn curved-arrow connector is explicitly OUT of scope for this story (see Dev Notes "Out of scope"). `pastel` reuses the existing `"curved"` connector.
  - [x] `loadStyles()` stays a plain `stylesJson as Style[]` cast — no runtime validation added (consistent with Story 3.1: "AC4 already satisfied … do NOT add a parallel styles module").

- [x] Task 2: Add the `pastel` built-in style to `styles.json` (AC: 1, 2, 3)
  - [x] Append a 5th object to the array (order matters only for picker display; `loadStyles()[0]` = `float_clean` must remain the default — do NOT insert `pastel` at index 0). Suggested values (tune the numeric ones against the rendered look; the two texture paths are fixed):
    ```json
    {
      "name": "pastel",
      "swatchRadius": 48,
      "swatchBorderColor": "#ffffff",
      "swatchBorderWidth": 3,
      "connectorType": "curved",
      "connectorColor": "#1e1e1e",
      "connectorWidth": 2,
      "markerStyle": "ring",
      "markerColor": "#ffffff",
      "labelPosition": "beside",
      "swatchTexture": "/textures/swatch-pencil.png",
      "borderTexture": "/textures/swatch-border.png"
    }
    ```
  - [x] `swatchBorderColor`/`swatchBorderWidth` are still parsed but the textured path draws the chalk-ring **image** for the border, not the crisp stroke — keep them present (schema completeness / thumbnail fallback) but note they are not used for the ring in the textured render (see Task 3). `labelPosition: "beside"` pairs the style with visible labels (the pastel look is a labeled palette); `Caveat` is available as a font but is NOT forced as the style's label font (font is a per-label control, Story 3.3) — do NOT add a per-style font field.

- [x] Task 3: Render the textured swatch in `EyedropperLayer.tsx` (AC: 3, 4, 5, 6)
  - [x] Load the two texture images ONCE and share them (they are the same for every pastel swatch). Follow the hydration-safe pattern used for the sample image (`StylePicker.tsx:16-24` and `index.tsx:238-262`): `new window.Image()` in a `useEffect`, state initialized `null`, `onload`/`onerror` handlers, cleanup nulls the handlers. **Decide the load site:** loading inside `EyedropperLayer` is acceptable, but preferred is to load them where the other browser-image lifecycle lives so the layer stays presentational — see Dev Notes "Where to load the textures". Whichever site, pass the two decoded `HTMLImageElement | null` into `EyedropperLayer` (new props, e.g. `pencilTexture`, `borderTexture`).
  - [x] Branch the swatch render on `style.swatchTexture`:
    - **Falsy (existing four styles)** → the current flat `<Circle>` path, byte-for-byte unchanged (AC4). Do NOT refactor it into a shared abstraction that changes its output.
    - **Truthy (pastel)** → render the textured swatch per `public/textures/README.md`:
      ```
      disc(p.color)                         // Konva.Circle fill = sampled color, no stroke
        × swatch-pencil  (multiply)         // Konva.Image, globalCompositeOperation="multiply"
        ∩ swatch-pencil  (alpha)            // clip the multiply to the pencil's feathered alpha
        + swatch-border  (over)             // Konva.Image chalk ring on top, drawn as-is (no tint)
      ```
  - [x] **CRITICAL — isolate the compositing (AC6).** Konva's `globalCompositeOperation` composites against the whole layer canvas beneath the node (the drawing photo + other swatches), NOT just this swatch's disc. Rendering the multiply/alpha-clip directly onto the shared layer would tint/erase the photo. Wrap the disc + pencil-multiply + border for a single swatch in its own `<Group>` and **cache it** (`group.cache()` via a ref + `useEffect`, or the react-konva idiom) so the composite ops resolve within the group's offscreen buffer, then the cached group composites cleanly onto the layer. Document the exact isolation mechanism you use in Completion Notes. Verify manually (see Task 6 manual-verify note) that the photo behind and neighbouring swatches are NOT tinted.
  - [x] The alpha-clip: the pencil texture already carries a feathered circular alpha, so multiplying it over the disc and drawing it with its own alpha yields the feathered edge. If a hard disc edge shows through, clip the group/disc to the pencil alpha (e.g. draw the disc, then the pencil `Image` with `multiply`, and rely on the pencil alpha as the visible mask; or use a `clipFunc`/destination-in inside the cached group). Keep the disc radius = `style.swatchRadius`; scale both texture `Image`s to `2*swatchRadius` square centered on the swatch position.
  - [x] **Preserve every swatch interaction on the textured swatch (AC5).** The drag (`draggable`, `dragBoundFunc`, `onDragMove`, `onDragEnd`), select (`onClick` with `e.cancelBubble = true`), remove (`onContextMenu`), and hover-cursor handlers currently live on the flat `<Circle>` (`EyedropperLayer.tsx:104-157`). For the textured swatch, attach these to the wrapping `<Group>` (or a transparent hit `Circle` of radius `swatchRadius` inside it) so the whole swatch stays draggable/selectable/removable exactly as today. Do NOT fork the handler logic — factor the shared handler props once and spread them onto whichever node (flat `Circle` vs textured `Group`) is rendered, so the two paths cannot drift. `interactionMode === "select"` gating is identical.
  - [x] If either texture image is still `null` (not yet loaded) while `pastel` is active, fall back to the flat `<Circle>` render for that frame (so a swatch is always visible and interactive) — the textured render swaps in on load. No crash, no invisible/undraggable swatch.

- [x] Task 4: Wire `Caveat` into `lib/fonts.ts` (AC: 7)
  - [x] Import `Caveat` from `next/font/google` at module scope (build-time analyzed — literal args only, same as the existing five). Register it: `const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" })` (add a `weight` only if the type requires it; `Caveat` is a variable font — match the pattern of the neighbours).
  - [x] Append `caveat.variable` to the `fontVariables` array (so `app/layout.tsx`, which spreads `fontVariables` onto `<body>`, registers the `@font-face`). No change needed in `layout.tsx` — it already does `${fontVariables.join(" ")}`.
  - [x] Append `{ label: "Caveat", family: caveat.style.fontFamily }` to `FONT_OPTIONS`. Placement in the list: append at the end (after "System") — do NOT reorder the existing six, since Story 3.3 AC7 pins their order and `resolveFontFamily` matches by `label`. Confirm `resolveFontFamily("Caveat")` returns the resolved family.
  - [x] Do NOT change the default label font or `LabelDefaults` — Caveat is an available option, opt-in per label (Story 3.3 per-label control), not a forced default.

- [x] Task 5: Add a `document.fonts.ready` Konva redraw (AC: 8)
  - [x] Adding `Caveat` (and the other `display: "swap"` fonts) means Konva may rasterize label `Text` before the webfont swaps in (FOUT) — Konva does not auto-reflow on `@font-face` swap. Add a ONE-shot redraw: in `components/Editor/index.tsx`, an effect that awaits `document.fonts.ready` and then forces a Konva redraw of the stage (`stageRef.current?.getLayers().forEach(l => l.batchDraw())`, or `stageRef.current?.batchDraw()`). Guard for SSR/jsdom: `if (typeof document === "undefined" || !document.fonts) return`. Fire once on mount (deps `[]`); it is cheap and idempotent.
  - [x] This also de-risks the deferred Story 4.1 export-font finding (labels rasterizing in the fallback font before export). Note in Completion Notes that this partially addresses that item; the full `await document.fonts.ready` before `toDataURL` in `handleExport` is a smaller separate concern — add it to `handleExport` too if trivial (`await document.fonts.ready` right before the existing 2-frame wait), else leave the deferred-work.md item and note it.
  - [x] Keep the redraw minimal and self-contained — do NOT add a `FontFaceObserver` dependency (the existing deferred item explicitly rules that out).

- [x] Task 6: Render the `pastel` style in the thumbnail (AC: 9)
  - [x] The picker thumbnail (`components/StyleThumbnail.tsx`) draws a reduced-scale preview reading style fields directly (Story 3.1 "purpose-built small-preview path"). Teach it the textured swatch: when `style.swatchTexture` is set, draw the pencil+border textures at thumbnail scale (small `SWATCH_R`) instead of the flat `Circle`; else keep the current flat path. Reuse the SAME shared-once-loaded texture-image pattern (load the two textures once at the `StylePicker` level — where the sample image is already loaded — and pass them down, OR load in the thumbnail; prefer sharing with the sample-image load so there is one image-lifecycle site).
  - [x] The thumbnail is small (60×80, `SWATCH_R=7`) — the compositing-isolation concern is the same in principle, but if a full cached-group multiply is awkward at this scale, a faithful-enough approximation is acceptable for the thumbnail ONLY (e.g. draw the pencil texture tinted/multiplied over a small disc without a perfect alpha clip, plus the border image) — the thumbnail must "read as pastel at a glance", not be pixel-identical to the canvas. Document the thumbnail approach in Completion Notes.
  - [x] Guard the not-yet-loaded case: if the textures are `null`, render the existing flat thumbnail swatch (or the neutral placeholder if the sample image itself is null) — no crash (AC9).

- [x] Task 7: Write tests (AC: all)
  - [x] `lib/styles.test.ts` (MODIFY or ADD if absent): assert `loadStyles()` returns 5 styles; the `pastel` entry has `swatchTexture`/`borderTexture` set to the two `/textures/*.png` paths; the four existing styles have `swatchTexture` undefined (fallback path). Assert the four existing style objects are unchanged in their known fields (guards AC2/AC4 regression).
  - [x] `components/Editor/EyedropperLayer.test.tsx` (MODIFY): the react-konva mock renders shapes as DOM with `data-*` (Circle/Line/Group already mocked; ADD an `Image` mock rendering `<div data-testid="konva-image" data-image-src=... data-gco={globalCompositeOperation} />`, mirroring `Canvas.test.tsx:36`). Add tests:
    - With a flat style (`loadStyles()[0]`, no `swatchTexture`): swatch renders as a `Circle` with `data-fill = p.color` and the border stroke — the CURRENT tests must stay green (AC4 no-regression).
    - With the `pastel` style AND both texture props supplied: a disc `Circle` (fill = `p.color`) + a pencil `Image` with `data-gco="multiply"` + a border `Image` render; assert the pencil image has the multiply composite op and the border image is present.
    - With `pastel` but a texture prop `null`: falls back to the flat `Circle` (no `Image`) — no crash.
    - Interaction preservation: the textured swatch's draggable/click/contextMenu handlers are wired (assert `data-draggable`, the click sets `cancelBubble`, contextMenu calls `preventDefault`) — reuse the existing swatch-handler test helpers, pointed at the textured swatch's hit node.
    - Extend `DEFAULT_PROPS`/mock with the two new texture props (defaulting to `null` keeps every existing test on the flat path — the "update mocks when you touch them" lesson from Stories 2.5/2.6/2.7/3.1).
  - [x] `lib/fonts.test.ts` (MODIFY or ADD): assert `FONT_OPTIONS` includes `{ label: "Caveat", ... }`; the existing six options and their ORDER are unchanged (Caveat appended last); `resolveFontFamily("Caveat")` returns a non-empty family (not the raw label). If `next/font/google` is not resolvable under Vitest, mock it the way the existing font tests / `resolveFontFamily` tests do (check for an existing `lib/fonts.test.ts` first and follow its mock).
  - [x] `components/StyleThumbnail.test.tsx` (MODIFY): add a `pastel` case — with textures supplied, the thumbnail renders the textured swatch elements (pencil/border `Image`); with textures `null`, it renders the flat fallback and does not crash. Keep the existing four-style differentiation tests green (extend the mock/props with the new texture props defaulting to `null`).
  - [x] `components/StylePicker.test.tsx` (MODIFY): the strip now renders **5** buttons (add `pastel`); the `pastel` button is present, selectable (`onSelect` called with the `pastel` style object), and gets `aria-pressed`/accent when active. Update any hard-coded "4 buttons" assertion to 5.
  - [x] Do NOT attempt a real Konva canvas render, real font loading, or real `group.cache()` in jsdom — all Konva is mocked to DOM (existing precedent). The multiply-isolation (AC6) and the actual pencil-through-color fidelity are RUNTIME-only — verify them with a MANUAL check (see Dev Notes "Manual verification") and record the result in Completion Notes; they cannot be unit-tested.
  - [x] Run `npx vitest run` — all tests pass, no regressions (baseline: **306 passing** as of Story 5.3). Run `npx tsc --noEmit` — clean.

## Dev Notes

### Working Directory & Versions

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests: `npx vitest run` from that directory (watch mode: `npm test`). Static check: `npx tsc --noEmit` (there is NO lint script). Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8, @testing-library/react ^16.3.2. `@/` aliases the `eyedropper-web/` root (`vitest.config.ts`).

### Epic placement — flagged decision (read this)

This story is placed as **Story 3.5 under Epic 3 (Style System & Label Editing)**, a sibling of Stories 3.1–3.4. Rationale:
- Epic 3's charter is exactly "choose from built-in styles + label editing"; a new built-in style + the label font that pairs with it is squarely in-epic. Epic 3 is `in-progress` in `sprint-status.yaml`.
- `epics.md` does not pre-list a Story 3.5 — this is a **new story appended to an existing in-progress epic**, not a new epic. No new epic was invented (per the "flag the placement, don't silently invent scope" instruction).
- **This is NOT the deferred "user-uploaded / editable custom styles via UI" item** (SPEC.md:204 non-goal; tracked in `deferred-work.md`). That item is about editing styles *through the app UI*. This story only adds ONE more *built-in* style to `styles.json` + the minimal render/schema/font code it needs — the same shape of work as Story 3.1's four built-ins.
- It DOES promote the separate SPEC non-goal **"Pencil-texture swatch rendering"** (SPEC.md:205) — that line can be considered addressed by this story.

`sprint-status.yaml` will get a new `3-5-pastel-colored-pencil-swatch-style: ready-for-dev` entry under Epic 3.

### Resolved open questions (decided during story creation, 2026-07-01)

1. **Hand-drawn brush-stroke connector → OUT of scope.** `pastel` reuses the existing `"curved"` Konva `Line` connector (same as `float`/`float_clean`). The curved-arrow brush asset from the float example (`~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg`, Image 2) was NOT extracted and needs a separate asset + a new connector render path — a **sibling/follow-on story**, not this one. Do NOT add a textured-connector field or renderer here. Record it in `deferred-work.md` as a future story on completion.
2. **Konva webfont FOUT → handled here (Task 5).** Add a one-shot `document.fonts.ready` → `batchDraw()` redraw. This is the long-standing deferred item (deferred-work.md, Story 3.3 review); adding `Caveat` makes it more visible, so it is fixed in this story rather than deferred again.
3. **Chalk-ring border evenness → accept as-is.** `swatch-border.png` is naturally heavier bottom-right, faithful to the artist's hand-drawing. Ship it unchanged; do NOT normalize the ring. (If a future evenness pass is wanted, that is a texture-regeneration task noted in the textures README, not code.)

### What already exists (do NOT rebuild)

| Already done | Where | Implication |
|---|---|---|
| The two texture PNGs + README | `public/textures/swatch-pencil.png`, `swatch-border.png`, `README.md` | Assets are DONE. The story CONSUMES them. Do NOT regenerate, resize, or re-extract. `README.md` is the source of truth for the composite pipeline. |
| `sample-drawing.jpg` (thumbnail base) | `public/sample-drawing.jpg` (300×400) | Reused by the pastel thumbnail. Do NOT replace. |
| `Style` interface + `loadStyles()` | `lib/styles.ts` | EXTEND with two optional fields (Task 1). Do NOT rewrite. |
| The 4 styles | `styles.json` | APPEND a 5th; do NOT edit the existing four objects. |
| Style picker + live switching + thumbnails | `components/StylePicker.tsx`, `components/StyleThumbnail.tsx`, `index.tsx` style state (`:178-186`) | Adding a 5th style flows through automatically (picker maps over `loadStyles()`); you only teach the thumbnail + layer the textured branch. |
| Flat swatch + connector + marker render, fully style-driven, with all drag/select/remove handlers | `components/Editor/EyedropperLayer.tsx` | The fallback path (AC4). Branch a textured path beside it; reuse the handlers. |
| Browser-image load pattern (hydration-safe, onload/onerror, cleanup) | `index.tsx:238-262`, `StylePicker.tsx:16-24` | Copy this exact shape for the two textures. |
| Font system (5 Google fonts → `fontVariables` → `<body>`; `FONT_OPTIONS`; `resolveFontFamily`) | `lib/fonts.ts`, `app/layout.tsx`, `components/Editor/LabelLayer.tsx` | ADD `Caveat` following the identical pattern (Task 4). `layout.tsx` needs NO change (spreads `fontVariables`). |
| Konva `Image` render precedents | `Canvas.tsx:112` (`<KonvaImage>` for the drawing), `StyleThumbnail.tsx:56` (sample image) | Same `Image as KonvaImage` import + `image={...}` prop. For the pastel swatch you add `globalCompositeOperation` + group caching, which these don't use yet. |

### The texture render pipeline (AC3, AC6) — the hard part

From `public/textures/README.md` (source of truth):
```
disc(sampledColor)               // solid fill = the point's p.color
  × swatch-pencil.png (multiply) // pencil striation, darkens ≤~22% so tint stays faithful
  ∩ swatch-pencil.png (alpha)    // clip to the feathered circular alpha
  + swatch-border.png (over)     // rough white chalk ring on top, drawn as-is (no tint)
```
Both textures are 256×256 RGBA, TINTABLE (carry shape, not color). Scale each `Konva.Image` to a `2·swatchRadius` square centered on the swatch position (so radius 48 → 96×96 image; the pencil's feathered circle then matches the disc).

**The compositing trap (AC6 — do not skip):** In Konva, `globalCompositeOperation="multiply"` (and any alpha-clip like `destination-in`) composites the node against **everything already drawn on that layer's canvas** — i.e. the drawing photo and every earlier swatch — not just this swatch's disc. If you draw the pencil-multiply straight onto the shared `EyedropperLayer`, it will multiply into the photo and tint it. **Fix:** render one swatch's `disc + pencil(multiply) + border` inside its own `Konva.Group` and **cache** that group (`group.cache()`), which gives the group an isolated offscreen canvas; the composite ops resolve inside that buffer, and the finished group then draws onto the layer with normal (source-over) compositing. In react-konva, cache via a `ref` to the `Group` + a `useEffect`/`useLayoutEffect` that calls `.cache()` after the children mount and re-caches when `p.color`/`swatchRadius`/textures change. Confirm by eye that the photo and neighbours are untouched (see Manual verification).

Caching interacts with dragging: a cached group still drags (cache is in local coords). Re-cache on color/size/texture change, NOT on every drag frame. Keep the swatch's hit region correct — a cached group hit-tests on its cached shape; if hit detection is flaky, add a transparent `Circle` (radius `swatchRadius`, `fill` a fully-transparent color or use `hitFunc`) inside the group to guarantee the grab area, and put the drag/select/remove handlers on the group.

### Where to load the textures (Task 3)

Two options, both acceptable — pick one and note it:
- **(Preferred) Load in `EyedropperLayer` (or its parent `Canvas`/`index.tsx`) once, share across all pastel swatches.** Only pastel needs them; loading them unconditionally is fine (two small PNGs, ~24KB total) or gate the load on `style.swatchTexture` being present. Pass the two decoded `HTMLImageElement | null` down as props so the layer stays declarative and the test mock can inject stubs (mirrors how `StylePicker` loads the sample image once and passes it to `StyleThumbnail`).
- Loading them at `index.tsx` alongside the main image load (`:238-262`) co-locates the image-lifecycle and lets both the canvas layer and (if you route it) the thumbnail share one decode. Either way: hydration-safe (`useState<HTMLImageElement|null>(null)` + `useEffect` + `onload`/`onerror` + cleanup nulling handlers), and render the flat fallback until loaded.

Do NOT load textures with a bare module-level `new Image()` (SSR/hydration hazard — see `docs/project-context.md` hydration rules).

### Preserve the existing flat path exactly (AC4)

The four existing styles MUST render and behave identically to today. The safest shape: keep the current `<Circle>` block as the `else` branch untouched, and add an `if (style.swatchTexture && pencilTexture && borderTexture)` branch that renders the textured group. Factor the shared handler object ONCE:
```tsx
const swatchHandlers = interactionMode === "select" ? { onClick, dragBoundFunc, onMouseEnter, onMouseLeave, onDragMove, onDragEnd } : {}
// flat:   <Circle ... draggable={select} onContextMenu={...} {...swatchHandlers} />
// texture:<Group ref={...} draggable={select} onContextMenu={...} {...swatchHandlers}> ...disc, pencil(multiply), border... </Group>
```
so the two paths cannot drift (the recurring "don't fork the handlers" lesson from Story 3.1's marker ring/dot refactor). `onContextMenu` and `draggable` live on both directly (they're not gated by `interactionMode` the same way). Match the existing spread shape in `EyedropperLayer.tsx:116-156` precisely.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/styles.ts` | `Style` = 10 flat fields | ADD optional `swatchTexture?`, `borderTexture?` |
| `styles.json` | 4 styles | APPEND `pastel` (5th) with the two texture paths |
| `components/Editor/EyedropperLayer.tsx` | Flat `Circle` swatch only | ADD textured-swatch branch (cached group: disc + pencil-multiply + border), new texture props, shared handlers; flat path unchanged |
| `components/Editor/EyedropperLayer.test.tsx` | Circle/Line/Group mocked | ADD `Image` mock (`data-gco`), textured-swatch + fallback + interaction tests; extend `DEFAULT_PROPS` with texture props (`null`) |
| `lib/fonts.ts` | 5 fonts + System | ADD `Caveat`: import, `fontVariables`, `FONT_OPTIONS` (append last) |
| `lib/fonts.test.ts` | (verify exists) | ADD/EXTEND: Caveat in `FONT_OPTIONS`, order preserved, `resolveFontFamily("Caveat")` |
| `lib/styles.test.ts` | (verify exists) | ADD/EXTEND: 5 styles, pastel textures set, existing four unchanged |
| `components/StyleThumbnail.tsx` | Flat preview per style | ADD textured branch when `swatchTexture` set; textures `null` → flat fallback |
| `components/StyleThumbnail.test.tsx` | 4-style differentiation | ADD pastel textured + null-texture cases; extend mock/props |
| `components/StylePicker.tsx` + `.test.tsx` | Loads sample image once; strip maps styles | Likely no logic change (auto-picks up the 5th style); if it loads/【passes】textures to thumbnails, add that. Update test's button-count assertion 4→5 |
| `components/Editor/index.tsx` | style state; main image load; `handleExport` | ADD the `document.fonts.ready` → `batchDraw()` redraw effect (Task 5); possibly the shared texture load if loaded here; optional `await document.fonts.ready` in `handleExport` |

### Files NOT to touch

- `lib/types.ts` — `Style` is imported from `lib/styles.ts`; `EyedropperPoint`/label shape are unchanged. Textures are a Style concern, not a point concern.
- `app/layout.tsx` — already spreads `fontVariables`; adding to that array is enough. No JSX change.
- `lib/color-sample.ts`, the hidden sampling canvas, `/api/*` routes — untouched. Constraint #1 (original pixels never modified) and the export re-encode-only rule stand: the textured swatch is drawn only on the visible Konva stage, sampled color still comes from the read-only hidden canvas.
- `lib/swatch-layout.ts`, `drag-utils.ts` — swatch positioning/clamping is unchanged; the textured swatch uses the same `getSwatchPos` position and the same `dragBoundFunc` clamp (radius `style.swatchRadius`, which pastel sets to 48).
- The existing four `styles.json` objects — append only.

### Constraints (eyedropper-web/CLAUDE.md) this story must honor

1. **Original image pixels never modified** — textured swatch is a Konva overlay; sampling reads the hidden canvas; export re-encodes only. AC5.
2. **9:16 output always** — no canvas-size change; the swatch is clamped inside the 9:16 canvas by the existing `dragBoundFunc`.
3. **No swatch lines cross** — connector logic unchanged (pastel reuses `"curved"`); layout ordering untouched.
4. **Works without an API key** — pure client render + static assets; no Claude/API dependency. `pastel` is available offline like the other four.

### Manual verification (runtime-only ACs — required, record in Completion Notes)

Unit tests mock Konva to DOM and cannot verify pixels, compositing isolation, color fidelity, or font swap. After implementing, run `npm run dev`, upload a drawing, and confirm:
- Select `pastel`: swatches show the pencil scribble inside the chalk ring; the point's sampled color reads through (not washed out, not fully hidden). (AC3)
- The drawing photo behind the swatches and neighbouring swatches are NOT tinted/darkened by the multiply. (AC6 — the group-cache isolation working.)
- Drag a pastel swatch (stays in-bounds), click to select, right-click to remove — all behave like a flat swatch. (AC5)
- Enter label edit mode, set a label's font to `Caveat` — it renders in the handwriting font on canvas (may briefly show fallback then swap; the `document.fonts.ready` redraw should settle it). (AC7, AC8)
- Export the canvas (Download 9:16 JPEG) — the pastel swatches and Caveat labels appear correctly in the downloaded JPEG. (AC5, AC8)

### Previous Story Intelligence (Stories 3.1–3.4, 5.1–5.3 + reviews)

- **Story 3.1** established: extend, don't rewrite, the style layer; the thumbnail reads style fields directly (no per-style hardcoding); "don't fork the handlers" when adding a render variant (the ring/dot marker refactor kept ONE `Circle`). Mirror all three here for the textured swatch.
- **"Update all mocks/`DEFAULT_PROPS` when you touch a tested component"** (recurring 2.5/2.6/2.7/3.1 lesson) — adding texture props to `EyedropperLayer` means the `EyedropperLayer.test.tsx` mock and `DEFAULT_PROPS` must default them (to `null`) so every existing test stays green; add an `Image` mock. Re-run `npx tsc --noEmit`.
- **`cancelBubble` on the swatch/marker `onClick` is load-bearing** (2.7) — preserve it when moving handlers onto the textured group.
- **FOUT is a known deferred item** (deferred-work.md, Story 3.3 review & Story 4.1 review) — Task 5 addresses the canvas side (and partially the export side). Update those deferred entries (note "addressed in 3.5") on completion.
- **Free-swatch stale-`swatchSide` cosmetic bugs** (deferred-work.md, 5.1/5.2) are unrelated to this story — do NOT try to fix them here; leave the connector/label-offset geometry as-is.
- **Konva `onDragMove` write-back jitter** (deferred-work.md, 5.2 pass 2) is an existing pattern on the flat swatch — reuse the SAME `onDragMove`/`onDragEnd` write-back for the textured swatch (don't invent a new drag pattern); if the group jitters more than the circle, note it, don't rearchitect drag here.

### Project Structure Notes

- No new top-level component needed — the change is inside existing files (`EyedropperLayer`, `StyleThumbnail`, `styles`, `fonts`). No new `lib/` module (the style/font data layers already exist; extend them).
- `StyleThumbnail.tsx`/`StylePicker.tsx` stay at `components/` root (Story 3.1 convention, per ARCHITECTURE.md).
- Textures are served from `public/textures/` at the paths stored in `styles.json` (`/textures/swatch-pencil.png`, `/textures/swatch-border.png`) — public URL paths, loaded via `new window.Image()` like `/sample-drawing.jpg` and `/api/image`.
- No conflict with the unified structure.

### References

- [Source: eyedropper-web/public/textures/README.md] — the composite pipeline (disc × pencil-multiply ∩ pencil-alpha + border-over), tintability, ≤22% darken, companion font `Caveat`. **Source of truth for AC3/AC6.**
- [Source: docs/SPEC.md:205] — "Pencil-texture swatch rendering" listed as out-of-scope non-goal; this story promotes it. Distinct from [docs/SPEC.md:204] "Uploading custom styles via UI" (still deferred).
- [Source: docs/SPEC.md#Style System (lines 120–155)] — style schema + the built-in styles table + picker behavior.
- [Source: _bmad-output/implementation-artifacts/3-1-style-picker-and-live-style-switching.md] — style-system conventions, thumbnail approach, "don't fork handlers", "update mocks", hydration-safe image load, `aria-pressed` picker.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the "custom styles via UI" future story (NOT this), the Konva FOUT deferred item (Story 3.3 & 4.1 reviews — addressed in Task 5), the free-swatch stale-side cosmetic items (unrelated).
- [Source: lib/styles.ts:3-14] — `Style` interface to extend (add two optional fields).
- [Source: styles.json] — the 4 styles to append a 5th to.
- [Source: components/Editor/EyedropperLayer.tsx:103-199] — flat swatch `Circle` + all drag/select/remove handlers (fallback path + handler source to reuse); marker block (unchanged).
- [Source: components/Editor/Canvas.tsx:112, components/StyleThumbnail.tsx:56] — `Image as KonvaImage` render precedent.
- [Source: components/Editor/Canvas.test.tsx:36-42] — Konva `Image` mock precedent for tests.
- [Source: lib/fonts.ts:13-64] — font registration + `fontVariables` + `FONT_OPTIONS` + `resolveFontFamily` (add `Caveat`).
- [Source: app/layout.tsx] — `${fontVariables.join(" ")}` on `<body>` (no change needed).
- [Source: components/Editor/index.tsx:238-262] — hydration-safe browser-image load pattern; [:551-582] — `handleExport` (optional `document.fonts.ready`); [:178-186] — style state.
- [Source: docs/project-context.md] — testing standards (Vitest + RTL, co-located, add a "Write tests" task), hydration rules (browser-only objects in `useEffect`, init `null`), Tailwind v4 arbitrary-value tokens.
- [Source: eyedropper-web/CLAUDE.md] — non-negotiables #1 (original pixels), #2 (9:16), #3 (no crossing), #4 (works without key).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- `npx vitest run` → **324 passing / 0 failing** (baseline was 306; +18 new: 6 styles, 2 fonts, 7 EyedropperLayer pastel, +2 thumbnail, +1 picker — some counts overlap with modified assertions).
- `npx tsc --noEmit` → clean (after adding the two new texture props to `Canvas.test.tsx`'s `makeProps`).
- `npm run build` → **succeeds** (validates the `Caveat` `next/font/google` build-time import). NOTE: the build initially failed with a Turbopack error `Symlink scripts/.venv/bin/python3 is invalid, it points out of the filesystem root` — this is a PRE-EXISTING environmental issue (a local Python 3.14 venv symlink under `scripts/.venv`, scanned because `/api/suggest/route.ts` references `scripts/` via `DirAssetReference`), unrelated to this story's changes. Confirmed by temporarily moving `scripts/.venv` aside → build completes cleanly, then restored it.
- Dev-server smoke check: `/editor?id=…` returns HTTP 200 and `/textures/swatch-pencil.png` returns 200, no errors in the dev log.

### Completion Notes List

**Compositing isolation (AC6) — mechanism used:** Each pastel swatch is a `TexturedSwatch` react-konva `<Group>` positioned at the swatch centre, with children in group-local coords centred on (0,0): a solid disc `<Circle fill={p.color}>`, then the pencil `<Image globalCompositeOperation="multiply">`, then the pencil `<Image globalCompositeOperation="destination-in">` (clips disc+striation to the pencil's feathered circular alpha so the hard disc edge doesn't show), then the border `<Image>` drawn as-is. The Group is **cached** via a `groupRef` + `useLayoutEffect(() => group.cache(), [color, radius, pencil, border])` so all composite ops resolve inside the group's own offscreen buffer; the finished cached group then composites onto the layer with normal source-over — so the multiply/destination-in never touch the underlying photo or neighbouring swatches. Re-caches only on color/radius/texture change (NOT per drag frame; the cache is in local coords so drag still works). A jsdom guard (`typeof g.cache === "function"`) skips caching under the test mock.

**Don't-fork-the-handlers:** the drag/select/hover handlers are factored once into a `swatchHandlers` object (+ a shared `onSwatchContextMenu`) and spread onto whichever node renders — the flat `<Circle>` or the textured `<Group>` — so the two swatch paths cannot drift. The disc Circle inside the group is the opaque hit area (no separate transparent hit circle needed); hit-testing on the cached group works because the disc fills the swatch radius.

**Fallback (AC4):** `useTexture = !!(style.swatchTexture && pencilTexture && borderTexture)`. The four existing styles have no `swatchTexture`, so they always take the byte-for-byte-unchanged flat `<Circle>` path. Pastel also falls back to the flat Circle for the frame(s) before both textures decode (always visible + interactive), then swaps to textured on load.

**Texture load site:** loaded once in `components/Editor/index.tsx` (co-located with the main image lifecycle), passed down `Canvas → EyedropperLayer` as `pencilTexture`/`borderTexture` props (hydration-safe: `new window.Image()` in a `useEffect`, init `null`, cleanup nulls `onload`). The thumbnail path loads its own copy once at the `StylePicker` level (alongside the existing sample-image load) and passes them to `StyleThumbnail`.

**Thumbnail approach (AC9):** `StyleThumbnail` gets an internal `ThumbTexturedSwatch` that uses the SAME cached-group disc × pencil(multiply) ∩ pencil-alpha + border pipeline at `SWATCH_R=7` — not an approximation; the cache keeps it isolated at thumbnail scale too. When `swatchTexture` is set and both textures are loaded it renders the textured swatch; otherwise (textures still `null`, or a flat style) it renders the existing flat `<Circle>`; if the sample image itself is `null` it renders the existing neutral placeholder. No crash in any of these.

**Caveat font (AC7):** imported from `next/font/google` at module scope as a variable font (`subsets: ["latin"], variable: "--font-caveat", display: "swap"` — no weight/style, matching Inter's shape since Caveat only has the `normal` style), appended to `fontVariables` and to `FONT_OPTIONS` **last** (after "System") so the pinned Story 3.3 order is untouched. `app/layout.tsx` needed no change (it spreads `fontVariables`). Not forced as any style's label font — opt-in per label. Verified the `Caveat` `next/font` import compiles via a real `npm run build`.

**FOUT redraw (AC8):** one-shot `useEffect` in `index.tsx` awaits `document.fonts.ready` then `stageRef.current?.getLayers().forEach(l => l.batchDraw())`, guarded for SSR/jsdom (`typeof document === "undefined" || !document.fonts`), deps `[]`. No `FontFaceObserver`. Also added `await document.fonts.ready` right before `stage.toDataURL` in `handleExport`. Updated `deferred-work.md`: the Story 3.3 FOUT item is marked ADDRESSED; the Story 4.1 export-font item is marked PARTIALLY ADDRESSED (web-font-readiness half closed; the Konva-draw-completion-vs-2-RAF half remains deferred).

**Deferred follow-on filed:** the hand-drawn brush-stroke connector for pastel (out of scope per Dev Notes #1) is recorded in `deferred-work.md` as a future Epic 3 sibling story.

**Manual verification status (runtime-only ACs — REQUIRES MIGUEL'S EYES):** The pixel-level ACs cannot be unit-tested (Konva is mocked to DOM in jsdom). I verified everything unit-testable, confirmed `tsc`/`build`/dev-server all clean, but the following need a human visual check by uploading a real drawing and selecting `pastel`:
- AC3: pencil scribble inside the chalk ring, with the point's sampled color reading through (not washed out / not fully hidden).
- AC6: the photo behind the swatches and neighbouring swatches are NOT tinted/darkened by the multiply (i.e. the group-cache isolation is working at runtime).
- AC5: drag / click-select / right-click-remove behave like a flat swatch, and the swatch appears in the exported JPEG.
- AC7/AC8: setting a label's font to `Caveat` renders the handwriting font on canvas (settling after the `document.fonts.ready` redraw), and Caveat labels appear correctly in the exported JPEG.
These are flagged rather than claimed as verified.

### File List

- `eyedropper-web/lib/styles.ts` (M) — added optional `swatchTexture?`/`borderTexture?` to the `Style` interface.
- `eyedropper-web/styles.json` (M) — appended the 5th `pastel` style with the two texture paths.
- `eyedropper-web/lib/styles.test.ts` (A) — new: 5-style/pastel-textures/existing-unchanged assertions.
- `eyedropper-web/components/Editor/EyedropperLayer.tsx` (M) — `TexturedSwatch` cached-group render, `pencilTexture`/`borderTexture` props, factored shared swatch handlers, flat fallback.
- `eyedropper-web/components/Editor/EyedropperLayer.test.tsx` (M) — Image mock + interactive Group mock, texture props on `DEFAULT_PROPS` (null), 7 pastel tests.
- `eyedropper-web/components/Editor/Canvas.tsx` (M) — thread `pencilTexture`/`borderTexture` props through to `EyedropperLayer`.
- `eyedropper-web/components/Editor/Canvas.test.tsx` (M) — added the two texture props (null) to `makeProps` (tsc).
- `eyedropper-web/components/Editor/index.tsx` (M) — load the two textures once (hydration-safe), pass to `Canvas`; `document.fonts.ready → batchDraw` one-shot effect; `await document.fonts.ready` before export capture.
- `eyedropper-web/lib/fonts.ts` (M) — registered `Caveat`; added to `fontVariables` and `FONT_OPTIONS` (appended last).
- `eyedropper-web/lib/fonts.test.ts` (M) — mock Caveat; assert 7 options, order preserved, Caveat last, `resolveFontFamily("Caveat")`.
- `eyedropper-web/components/StyleThumbnail.tsx` (M) — `ThumbTexturedSwatch` cached-group textured branch + `pencilTexture`/`borderTexture` props; flat fallback.
- `eyedropper-web/components/StyleThumbnail.test.tsx` (M) — Group/Image mocks; pastel-with-textures and pastel-null-textures cases.
- `eyedropper-web/components/StylePicker.tsx` (M) — load the two textures once, pass down to each `StyleThumbnail`.
- `eyedropper-web/components/StylePicker.test.tsx` (M) — 4→5 button assertions; explicit pastel selectable/active test.
- `_bmad-output/implementation-artifacts/deferred-work.md` (M) — FOUT items updated (addressed / partially addressed); textured-connector future story added.

## Change Log

- 2026-07-01 — Story 3.5 implemented: added the `pastel` built-in textured-swatch style (colored-pencil scribble in a chalk ring), extended the `Style` schema with optional texture fields, rendered the textured swatch via a cached, composite-isolated Konva Group in both the canvas and the picker thumbnail, wired the `Caveat` handwriting font, and added a `document.fonts.ready` Konva redraw (canvas + export) to fix webfont FOUT. Tests: 306 → 324 passing; `tsc` clean; production build green.
