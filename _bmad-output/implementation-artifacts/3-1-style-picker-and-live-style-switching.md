# Story 3.1: Style Picker & Live Style Switching

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want to pick from 4 built-in annotation styles and see the canvas update instantly,
so that I can choose the visual look that best suits my drawing before exporting.

## Acceptance Criteria

1. **Given** the editor loads **when** the left sidebar Style section renders **then** it shows a horizontal thumbnail strip with one 60×80px preview per style: `float_clean`, `float`, `grid`, `minimal`; the active style is highlighted with the accent color border.

2. **Given** the style thumbnails render **when** they are generated **then** each is a miniature preview showing the connector type and swatch/marker style at a glance.

3. **Given** I click a style thumbnail **when** the selection changes **then** the Konva canvas immediately redraws all connectors, swatch borders, and markers using the new style's properties (connector type, colors, widths, marker style) without a page reload.

4. **Given** `styles.json` is loaded **when** `lib/styles.ts` parses it **then** all 4 style objects are typed and available with the full schema: `swatchRadius`, `swatchBorderColor`, `swatchBorderWidth`, `connectorType`, `connectorColor`, `connectorWidth`, `markerStyle`, `markerColor`, `labelPosition`.

## Tasks / Subtasks

- [x] Task 1: Make style switchable in `EditorShell` (`components/Editor/index.tsx`) (AC: 3)
  - [x] Change `const [style] = useState<Style>(() => loadStyles()[0])` (line 132) to include a setter: `const [style, setStyle] = useState<Style>(() => loadStyles()[0])`.
  - [x] Add an effect that keeps `styleRef` in sync with the live `style` value: `useEffect(() => { styleRef.current = style }, [style])`. **This is load-bearing** — `styleRef.current.swatchRadius` is read by the swatch drag handlers (`index.tsx:288, 307`), and `minimal` has `swatchRadius: 40` vs `48` for the others. Without the sync, dragging a swatch after switching to/from `minimal` clamps with the wrong radius. (`styleRef` is currently initialized once and never updated — that was fine when style was immutable; it no longer is.)
  - [x] Add `handleSelectStyle = useCallback((next: Style) => setStyle(next), [])`.
  - [x] After switching style, the swatch positions do NOT need re-layout for the 3 styles sharing `swatchRadius: 48`; for `minimal` (40) the existing rendered positions remain valid (swatches stay within bounds since 40 < 48). Do NOT call `assignSwatchLayout` on style change — radius change alone keeps the no-crossing order intact and the spec does not ask for a re-layout. (If you observe a swatch poking past the edge when switching to a larger radius, that is out of scope here — all 4 styles are ≤48; note it in Completion Notes rather than adding a re-layout.)

- [x] Task 2: Implement `StylePicker` component (`components/StylePicker.tsx`) (AC: 1, 2)
  - [x] Replace the stub (`export default function StylePicker() { return <div>StylePicker</div> }`) with a real `"use client"` presentational component. Props: `{ styles: Style[]; activeStyleName: string; onSelect: (style: Style) => void }`.
  - [x] Render a horizontal strip (`flex gap-2 overflow-x-auto`) of one `<button>` per style. Each button contains a 60×80px `StyleThumbnail` (Task 3) above the style `name`.
  - [x] The button whose `style.name === activeStyleName` gets the accent-color border (`border-[var(--color-accent)]`); the others get `border-[var(--color-border)]`. Mirror the active-state pattern from the Tools Select/Add toggle and `PointPanel` side buttons (`aria-pressed={style.name === activeStyleName}` for a clean test hook).
  - [x] Clicking a button calls `onSelect(style)`.
  - [x] Keys: use `style.name` as the React `key` (names are unique in `styles.json`).

- [x] Task 3: Build the 60×80 `StyleThumbnail` preview from the real sample image (AC: 2)
  - [x] Render a miniature 60×80 Konva preview of the real sample drawing at `public/sample-drawing.jpg` (ALREADY in the repo — do NOT create it) annotated with a few fixed sample points, drawn using the SELECTED style's props. See Dev Notes "Thumbnail approach" for the exact recipe — it reuses the real `EyedropperLayer` renderer at thumbnail scale so the preview is literally what the canvas will produce.
  - [x] The preview must visibly distinguish the 4 styles by connector type (curved / straight / none) and marker style (ring / dot / none) — which it does automatically, because it renders through the same style-driven `EyedropperLayer`.
  - [x] Implement as a sibling `StyleThumbnail.tsx` in the `components/` root next to `StylePicker.tsx` (NOT under `components/Editor/`).
  - [x] Load the sample image ONCE (shared across all 4 thumbnails) — see Dev Notes for the `new window.Image()` load pattern; render nothing (or a neutral placeholder box) until it loads to avoid an SSR/hydration mismatch (per `docs/project-context.md` hydration rules: browser-only state initialized as `null` + `useEffect`).

- [x] Task 4: Wire `StylePicker` into the left sidebar Style section (`components/Editor/index.tsx`) (AC: 1, 3)
  - [x] Replace the Style `<section>` stub (lines 514–519, the `<p>Coming soon</p>`) with `<StylePicker styles={...} activeStyleName={style.name} onSelect={handleSelectStyle} />`, keeping the existing `<h3>Style</h3>` heading.
  - [x] Source the styles list once: `const styles = useMemo(() => loadStyles(), [])` (or reuse the same `loadStyles()` call already used to init state — do NOT call `loadStyles()` inline in render every frame). Import `StylePicker` at the top alongside the other component imports.

- [x] Task 5: Implement the `markerStyle: "dot"` branch in `EyedropperLayer.tsx` (AC: 3)
  - [x] Currently the marker block (lines 151–190) is gated only by `style.markerStyle !== "none"` and always draws a hollow ring (`radius={12} fill={undefined} stroke={style.markerColor} strokeWidth={2}`). The `grid` style declares `markerStyle: "dot"` but renders identically to a ring — this is the deferred item from the Story 2.3 review (see deferred-work.md). AC3 requires markers to redraw "using the new style's properties (... marker style)", so the `dot` branch must now render distinctly.
  - [x] Make the rendered marker depend on `style.markerStyle`: `"ring"` → hollow ring (current behavior, unchanged); `"dot"` → a small FILLED dot (e.g. `radius={6} fill={style.markerColor} strokeWidth={0}`); `"none"` → not rendered (current behavior — keep the `style.markerStyle !== "none"` guard). Keep ALL existing marker handlers (drag, hover=`move`, contextMenu, click-to-select with `cancelBubble`) on whichever circle is drawn — the dot must remain draggable/selectable exactly like the ring. The ONLY difference between ring and dot is `radius`, `fill`, and `strokeWidth`; everything else (position `markerX/markerY`, draggable, the `interactionMode === "select"` spread) is shared. See Dev Notes for the minimal-diff shape.
  - [x] Do NOT add `markerRadius`/`markerStrokeWidth` to the `Style` interface or `styles.json` — those fields are not in the AC4 schema and are out of scope. Hardcode the ring (12/2) and dot (6/0) dimensions as today's ring values are hardcoded.

- [x] Task 6: Write tests (AC: all)
  - [x] `StylePicker.test.tsx` (NEW, in `components/`): plain RTL (no Konva). Render with `loadStyles()` and an `activeStyleName`. Assert: 4 buttons render (one per style name `float_clean`/`float`/`grid`/`minimal`); the button matching `activeStyleName` has `aria-pressed="true"` and the others `"false"`; clicking a non-active button calls `onSelect` with that full style object; the active button has a distinguishing accent class (assert the className contains the accent token or via `aria-pressed`). Mock or render `StyleThumbnail` — if SVG, it renders inline and needs no mock.
  - [x] `StyleThumbnail.test.tsx` (NEW, co-located): mock `react-konva` to DOM elements (same precedent as `EyedropperLayer.test.tsx`). Assert per-style differentiation lightly: connector element present for `curved`/`straight` and absent for `none` (`grid`); marker filled (dot) vs hollow (ring) vs absent (none). Pass a stub `HTMLImageElement` (or `null`) as the loaded image prop — assert the neutral placeholder renders when the image prop is `null`. Keep it light — presence/shape, not pixel geometry.
  - [x] `EyedropperLayer.test.tsx` (MODIFY): the `Circle` mock already records props as `data-*` attributes. Add tests: with a `markerStyle: "ring"` style the marker Circle has a non-filled stroke ring; with a `markerStyle: "dot"` style the marker Circle is filled (`data-fill` = `markerColor`, not undefined) and has the dot radius; with `markerStyle: "none"` no marker Circle renders (existing pattern — `grid`/`minimal` styles). Build the variant styles with `{ ...loadStyles()[0], markerStyle: "dot" }` etc. Extend the `Circle` mock to expose `radius` as `data-radius` if not already, so the dot/ring radius can be asserted.
  - [x] No new `EditorShell` integration test needed for style switching — the wiring is covered by `StylePicker` (selection callback) + `EyedropperLayer` (renders per style) component tests, consistent with the Story 2.7 precedent ("don't stand up the whole EditorShell just to test selection"). `handleSelectStyle` is a thin `setStyle`.
  - [x] Run `npm test` — all tests pass, no regressions (baseline: 156 passing as of Story 2.7; net new = StylePicker + thumbnail + EyedropperLayer marker tests).
  - [x] Run `npx tsc --noEmit` — clean. `StylePicker`'s new props are a NEW component (no existing call sites break), but the `EyedropperLayer.test.tsx` mock/`DEFAULT_PROPS` may need the extended `Circle` mock — update it so existing tests stay green (the recurring Story 2.5/2.6/2.7 "update mocks when you touch them" lesson).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests run with `npm test` from that directory. Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8, @testing-library/react ^16.3.2.

### What already exists (do NOT rebuild)

The style *infrastructure* is already complete from earlier stories — this story is the **picker UI + making the selection live + the `dot` marker branch**. Specifically:

| Already done | Where | Implication for this story |
|---|---|---|
| `Style` interface (9 fields) + `loadStyles(): Style[]` | `lib/styles.ts` | AC4 is **already satisfied** by existing code. Do NOT rewrite `lib/styles.ts`. Just confirm the parse is typed (it is: `import stylesJson from "../styles.json"; return stylesJson as Style[]`). |
| `styles.json` with all 4 styles + full schema | `styles.json` (project root, NOT under `lib/`) | Do NOT edit. Imported directly (build-time bundle), no fetch, no API route. |
| `EditorState.style: Style` + `EyedropperPoint`/`LabelDefaults` types | `lib/types.ts` | Do NOT touch. Note: `EditorState` is the *type*, NOT the runtime container — `EditorShell` uses discrete `useState` hooks (same as Story 2.7). Style lives in its own `useState`, not an `EditorState` object. |
| `style` threaded `EditorShell → Canvas → EyedropperLayer` | `index.tsx:546`, `Canvas.tsx` props, `EyedropperLayer.tsx:13,59,75` | The plumbing exists. EyedropperLayer already reads `style.swatchRadius/swatchBorderColor/swatchBorderWidth/connectorType/connectorColor/connectorWidth/markerColor`. You're ONLY adding the picker, the setter, and the `dot` marker branch. |
| Swatch + connector already fully style-driven | `EyedropperLayer.tsx:85–148` | Switching `style` ALREADY re-renders connectors and swatches correctly (curved/straight/none connector, swatchRadius, borders). The only marker gap is `dot`. |

### `styles.json` — the 4 styles (reference, do not edit)

```
name         swatchRadius  swatchBorder        connectorType  connectorColor/W   markerStyle  labelPosition
float_clean  48            #ffffff / 3         curved         #1e1e1e / 2        ring         none
float        48            #ffffff / 3         curved         #1e1e1e / 2        ring         beside
grid         48            #ffffff / 3         none           #1e1e1e / 2        dot          below
minimal      40            #ffffff / 2         straight       #1e1e1e / 1        none         none
```

Default (initial) style is `loadStyles()[0]` = `float_clean`. `labelPosition` is NOT used on the canvas in this story (it drives label rendering in Story 3.2+); ignore it for picker/canvas purposes here.

### Files to MODIFY / CREATE

| File | Current state | This story's change |
|------|---------------|---------------------|
| `components/StylePicker.tsx` | Stub: `return <div>StylePicker</div>` | IMPLEMENT — horizontal 60×80 thumbnail strip; active highlighted; `onSelect` callback |
| `components/StyleThumbnail.tsx` | does not exist | NEW — 60×80 Konva preview of `public/sample-drawing.jpg` rendered with the style's props |
| `components/StyleThumbnail.test.tsx` | does not exist | NEW — per-style connector/marker differentiation tests (react-konva mocked) |
| `public/sample-drawing.jpg` | ALREADY committed (300×400 artist hand drawing) | Used as the thumbnail base — do NOT regenerate/replace |
| `components/StylePicker.test.tsx` | does not exist | NEW — picker render + selection + active-highlight tests |
| `components/Editor/index.tsx` | `const [style] = useState(...)`; `styleRef` init-once; Style section = "Coming soon" stub | Add `setStyle` + `styleRef` sync effect + `handleSelectStyle`; render `<StylePicker>` in the Style section |
| `components/Editor/EyedropperLayer.tsx` | Marker always hollow ring (12/2), gated `!== "none"` | Branch on `markerStyle`: ring (hollow 12/2) vs dot (filled 6/0) vs none |
| `components/Editor/EyedropperLayer.test.tsx` | Circle mock records `data-*`; `DEFAULT_PROPS.style = loadStyles()[0]` | Add marker ring/dot/none tests; extend Circle mock with `data-radius` if needed |

### Files NOT to touch

- `lib/styles.ts` — AC4 already satisfied; the `Style` type and `loadStyles()` are correct.
- `styles.json` — do not add fields; the AC4 schema is exactly the 9 existing fields.
- `lib/types.ts` — `EditorState.style` already typed; do NOT introduce a runtime `EditorState` object.
- `components/Editor/Canvas.tsx` — `style` prop already threaded; no change.
- `lib/swatch-layout.ts`, `lib/color-sample.ts`, `lib/drag-utils.ts` — unchanged; do NOT re-run layout on style change (see Task 1 note).
- The Suggest / Tools / Labels sidebar sections and `PointPanel` / `ExportButton` — only the Style `<section>` changes.

### Out of scope — explicitly deferred to future stories

The artist confirmed two adjacent ideas that are NOT part of this story — do NOT build them here (they each warrant their own story; tracked in `deferred-work.md`):
1. **User-uploaded custom styles** — letting the artist add/edit styles via the UI (beyond the 4 built-ins in `styles.json`). SPEC explicitly lists "Uploading custom styles via UI" as a non-goal (SPEC.md:204). Future story.
2. **Free-floating, push-aside swatches** — the artist wants swatches to be draggable to ANY position (not snapped to an edge), and on collision to "push" neighbours aside rather than the current "stay only if no overlap, else redistribute" behavior. This reworks the swatch drag/layout model (`swatch-layout.ts`, the `handleSwatchDrag*` handlers, `getSwatchPos`) and is a significant change — a separate story. For 3.1, leave the existing edge-snapped swatch dragging from Stories 2.5/2.7 exactly as-is.

### `EditorShell` changes (AC 3) — exact shape

Current (lines 132–133):
```typescript
const [style] = useState<Style>(() => loadStyles()[0])
const styleRef = useRef<Style>(style)
```

Change to (add setter + keep ref synced):
```typescript
const styles = useMemo(() => loadStyles(), [])
const [style, setStyle] = useState<Style>(() => styles[0])
const styleRef = useRef<Style>(style)
useEffect(() => {
  styleRef.current = style
}, [style])

const handleSelectStyle = useCallback((next: Style) => {
  setStyle(next)
}, [])
```

`useMemo`/`useEffect`/`useCallback` are already imported (`index.tsx:3`). The `styleRef` sync effect is the critical correctness fix: the swatch drag handlers read `styleRef.current.swatchRadius` (`index.tsx:288, 307`) and must see the live radius after a switch (only `minimal` differs at 40, but that's enough to break the clamp).

Sidebar Style section (lines 514–519) — replace the placeholder, keep the heading:
```tsx
<section>
  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
    Style
  </h3>
  <StylePicker styles={styles} activeStyleName={style.name} onSelect={handleSelectStyle} />
</section>
```

### `markerStyle: "dot"` branch (AC 3) in `EyedropperLayer.tsx` — minimal diff

The marker is one `<Circle>` today (lines 151–190). The ring/dot difference is ONLY `radius`/`fill`/`strokeWidth`; every handler and the `interactionMode === "select"` spread stay identical. Compute the three visual props before the JSX, keep one `<Circle>`:

```tsx
{style.markerStyle !== "none" && (() => {
  const isDot = style.markerStyle === "dot"
  return (
    <Circle
      x={markerX}
      y={markerY}
      radius={isDot ? 6 : 12}
      fill={isDot ? style.markerColor : undefined}
      stroke={style.markerColor}
      strokeWidth={isDot ? 0 : 2}
      draggable={interactionMode === "select"}
      onContextMenu={/* unchanged */}
      {...(interactionMode === "select" && { /* unchanged: onClick, hover, drag */ })}
    />
  )
})()}
```

(An IIFE keeps the diff tight; alternatively hoist `isDot`/`markerRadius`/`markerFill`/`markerStrokeWidth` consts above the `return (` of the `.map` callback. Either is fine — match the file's style.) Do NOT duplicate the marker into two separate `<Circle>` blocks; that would fork the drag/select handlers and invite drift.

Known related deferred item (do NOT need to fix here unless trivial): the ring marker has `fill={undefined}`, so only the 2px stroke annulus is hittable (clicking the empty center won't grab) — deferred-work.md, Story 2.4. The `dot` (filled) does not have this problem. Leave the ring's hit area as-is unless you add a `hitStrokeWidth`; out of scope.

### Thumbnail approach (AC 2) — render the REAL sample image at thumbnail scale

**Decision:** Each 60×80 thumbnail is a miniature Konva render of a **real sample drawing** (`public/sample-drawing.jpg`) annotated with a few fixed color points, drawn through the SAME style-driven renderer the editor uses. This matches the SPEC wording literally ("a 60×80px miniature preview rendered ... from a sample image") and guarantees the thumbnail is exactly what that style produces on the canvas.

**The sample asset already exists:** `public/sample-drawing.jpg` (300×400, a cropped artist hand drawing with rich varied skin tones — ideal for showing color points). It is committed. Do NOT regenerate or replace it. Reference it as `/sample-drawing.jpg`.

Recipe:
- A small `<Stage>` (60×80) per thumbnail (or one shared offscreen render — simplest is a `<Stage width={60} height={80}>` per style button). Draw: a `<KonvaImage>` of the sample at `cover`/`contain` fit filling the 60×80, then a small set of **fixed sample points** (hardcode ~3–4 `{x, y, color}` in thumbnail-pixel space — pick points over the hand at distinct skin tones) rendered via the style's connector + swatch + marker rules.
- **Reuse the real rendering rules, do not re-derive them.** The cleanest path: render `<EyedropperLayer>` inside the thumbnail Stage with a tiny fixed `points` array, the chosen `style`, a small `swatchRadius`-appropriate layout, `interactionMode="select"` but with **no-op handlers** (the thumbnail is non-interactive). EyedropperLayer already draws connector-per-`connectorType`, swatch-per-`swatchRadius/border`, and (after Task 5) marker-per-`markerStyle` — so the thumbnail differentiates all 4 styles for free. If wiring EyedropperLayer into a 60×80 stage proves fiddly (it expects canvas-space swatch positions via `swatchOrder`/`swatchSide` + `assignSwatchLayout`), it is acceptable to draw a SMALL purpose-built preview inside the thumbnail Stage that reads the same `style` fields directly (`connectorType`, `connectorColor`, `connectorWidth`, `swatchRadius`, `swatchBorderColor`, `swatchBorderWidth`, `markerStyle`, `markerColor`) — but it MUST read them from the style object, never hardcode per-style branches. Document whichever path you take in Completion Notes.
- Swatches at this scale: use a reduced radius (the real `swatchRadius` of 40–48 would dwarf a 60px-wide thumbnail). Scale the swatch radius down proportionally (e.g. `swatchRadius * 60 / canvasWidthAtFullScale`, or just a fixed small `r≈8` with `border` from the style) — the point is the connector type + marker style + relative swatch size read "at a glance", not pixel fidelity.

**Image loading (hydration-safe):** load the sample image ONCE and share it. Per `docs/project-context.md` hydration rules, browser-only objects must be created in `useEffect`, initialized `null`, with an early return until ready:
```tsx
const [sampleImg, setSampleImg] = useState<HTMLImageElement | null>(null)
useEffect(() => {
  const im = new window.Image()
  im.src = "/sample-drawing.jpg"
  im.onload = () => setSampleImg(im)
}, [])
// render a neutral 60×80 placeholder box (bg-[var(--color-border)]) until sampleImg loads
```
Load it ONCE at the `StylePicker` level and pass the loaded `HTMLImageElement` down to each `StyleThumbnail` (4 thumbnails sharing one decoded image), NOT four independent loads.

**Testing note:** Konva/`window.Image` don't run in jsdom cleanly. Follow the existing `EyedropperLayer.test.tsx` precedent — mock `react-konva` to DOM elements (Stage/Layer/Image/Circle/Line → `<div data-*>`). For `StyleThumbnail`, either mock react-konva the same way and assert the per-style elements (connector line/path present-or-absent, marker filled/hollow/absent), or keep the thumbnail's style-differentiation logic in a tiny pure helper and unit-test that. Do NOT attempt a real Konva render in tests.

### `StylePicker.tsx` styling — match existing sidebar patterns

Mirror the left-sidebar section conventions already in `index.tsx`:
- Active-highlight pattern (from Tools Select/Add toggle, `index.tsx` ~491/501, and `PointPanel` side buttons): active = accent border (and optionally accent bg); inactive = `border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]`. For thumbnails, the accent **border** (not a full bg fill) is the right highlight so the preview stays readable: `border-2 border-[var(--color-accent)]` when active vs `border border-[var(--color-border)]` when not.
- Tailwind v4 — no config file; arbitrary values with CSS variables: `bg-[var(--color-sidebar)]`, `border-[var(--color-accent)]`, `text-[var(--color-text-secondary)]`. Tokens in `app/globals.css` (`--color-accent: #c4956a`, `--color-border: #e8e5e0`, etc.).
- New components start with `"use client"`. `StylePicker` is presentational (no Konva) — like `PointPanel`/`ContextMenu`.
- Strip is horizontal: `flex gap-2 overflow-x-auto` (sidebar is only ~200px wide, so the 4×60px thumbnails will scroll — that matches SPEC "horizontal scroll of thumbnail previews"). Show the style name under each thumbnail in small text (`text-[10px]` / `text-xs`), or as the button's accessible label.
- Use `aria-pressed={style.name === activeStyleName}` on each button — clean semantic test hook for "which is active" (same convention as `PointPanel`'s side buttons in Story 2.7).

### Test guidance

**`StylePicker.test.tsx`** (NEW, plain RTL — no Konva, the picker is pure HTML/SVG):
- `render(<StylePicker styles={loadStyles()} activeStyleName="float_clean" onSelect={fn} />)`.
- 4 buttons, one per name; the `float_clean` button `aria-pressed="true"`, others `"false"`.
- Click the `grid` button → `onSelect` called once with the full `grid` style object (assert `.name === "grid"`).
- Active button carries the accent-border class (assert className substring or rely on `aria-pressed`).
- If thumbnails are SVG, they render inline — assert per-style differentiation lightly: e.g. the `grid` thumbnail has no connector element (`connectorType: "none"`) and a filled dot marker; `float_clean` has a curved `<path>` and a hollow ring; `minimal` has a `<line>` and no marker. Query within each button.

**`EyedropperLayer.test.tsx`** (MODIFY) — react-konva is mocked to DOM elements that record props as `data-*` (see the existing `Circle`/`Line` mocks). Marker = `circles[circles.length - 1]` per the existing index convention (swatch = `circles[0]`). Extend the `Circle` mock to expose `data-radius` if it doesn't already. Add:
- ring style (`loadStyles()[0]`, `markerStyle: "ring"`): marker Circle present, `data-fill` is empty/undefined (hollow), `data-radius="12"`.
- dot style (`{ ...loadStyles()[0], markerStyle: "dot" }`): marker Circle present, `data-fill` = `markerColor`, `data-radius="6"`.
- none style (`{ ...loadStyles()[0], markerStyle: "none" }`): only the swatch Circle renders, no marker (the `grid`/`minimal` real styles also hit this).
- Keep the existing swatch/connector/drag/select tests green — they already parametrize on `style` via `DEFAULT_PROPS.style`.

Per `docs/project-context.md`: Vitest + RTL, co-located `*.test.tsx`. No `lint` script — `npx tsc --noEmit` is the static check.

### Project Structure Notes

- `StylePicker.tsx` lives at `components/` root (top-level), NOT under `components/Editor/` — ARCHITECTURE.md explicitly lists it there: `components/StylePicker.tsx # Horizontal style thumbnail scroll` (line 23), as a sibling of `Upload.tsx`/`ExportButton.tsx`. (Contrast `PointPanel.tsx`, which is editor-local under `components/Editor/`. Follow ARCHITECTURE.md for `StylePicker`.) An optional `StyleThumbnail.tsx` goes alongside it at `components/`.
- No new `lib/` helper — the style data layer (`loadStyles`, `Style`) already exists. Do NOT add a parallel styles module.
- No conflicts with the unified structure detected.

### Previous Story Intelligence (Story 2.7 + earlier reviews)

- **Don't trust `selectedPointId` directly** after a re-suggest — but selection is orthogonal to style; switching style does NOT touch points or selection. Leave selection state alone.
- **Update all mocks/`DEFAULT_PROPS` when you touch a tested component** (recurring 2.5/2.6/2.7 lesson) — if you extend the `EyedropperLayer.test.tsx` `Circle` mock, keep every existing test green and re-run `npx tsc --noEmit`.
- **`cancelBubble` on shape clicks is load-bearing** (2.7) — the marker's select `onClick` sets `e.cancelBubble = true`. When you refactor the marker into ring/dot, preserve this exactly; do not drop it.
- **Deferred item resolved here:** `markerStyle: "dot"` rendered identically to `ring` (deferred-work.md, Story 2.3 review) — Task 5 closes it. After this story, update deferred-work.md to note it as resolved (or mention in Completion Notes).
- **HMR `pointIdCounter` reset** and **`runSuggest` blind replace** remain deferred and are not relevant to style switching.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Style Picker & Live Style Switching] — the 4 acceptance criteria (FR17, FR18).
- [Source: docs/SPEC.md#Style System (lines 120–150)] — style schema, the 4 built-in styles table, "Style picker: horizontal scroll of thumbnail previews. Selected style is highlighted."
- [Source: docs/SPEC.md#Style thumbnails (line 152–154)] — "Each style thumbnail is a 60×80px miniature preview rendered at app load time (static, from a sample image). Shows the connector and swatch style at a glance." (Sample image now committed at `public/sample-drawing.jpg` — see Thumbnail approach.)
- [Source: docs/UI.md#Style (lines 55–60)] — left sidebar Style: horizontal thumbnail strip `[ float_clean ] [ float ] [ grid ] [ minimal ]`, selected highlighted.
- [Source: docs/ARCHITECTURE.md:23] — `components/StylePicker.tsx # Horizontal style thumbnail scroll` (top-level component placement).
- [Source: lib/styles.ts] — `Style` interface (9 fields) + `loadStyles()`; AC4 already satisfied. Do not rewrite.
- [Source: styles.json] — the 4 styles; do not edit.
- [Source: components/Editor/index.tsx:132–133] — `style` state + `styleRef` (make switchable; sync the ref).
- [Source: components/Editor/index.tsx:288,307] — swatch drag handlers reading `styleRef.current.swatchRadius` (why the ref must stay synced).
- [Source: components/Editor/index.tsx:514–519] — Style section stub to replace.
- [Source: components/Editor/index.tsx:546] — `style={style}` already passed to `<Canvas>`.
- [Source: components/Editor/EyedropperLayer.tsx:85–148] — connector + swatch already fully style-driven (no change needed).
- [Source: components/Editor/EyedropperLayer.tsx:151–190] — marker block; add the `dot` branch.
- [Source: components/Editor/PointPanel.tsx] — presentational-component + `aria-pressed` active-highlight precedent for `StylePicker`.
- [Source: _bmad-output/implementation-artifacts/2-7-point-selection-and-right-panel-state.md] — Story 2.7: `aria-pressed` highlight pattern, "don't stand up EditorShell to test," "update mocks when touched."
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Story 2.3 review] — `markerStyle: "dot"` renders identically to ring; "Implement the dot branch when Story 3.1 exposes style switching" — closed by Task 5.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`eu.anthropic.claude-opus-4-8`)

### Debug Log References

- Baseline test run before changes: 156 passing (14 files).
- Final test run: 169 passing (16 files) — net new 13 tests (5 StylePicker + 4 StyleThumbnail + 4 EyedropperLayer marker).
- `npx tsc --noEmit`: clean (no errors).

### Completion Notes List

- **Task 1 (style switchable):** Added `const styles = useMemo(() => loadStyles(), [])`, `setStyle`, the `styleRef` sync effect (`useEffect(() => { styleRef.current = style }, [style])`), and `handleSelectStyle`. The ref-sync is the load-bearing correctness fix so the swatch drag clamp reads the live `swatchRadius` after a switch. Did NOT call `assignSwatchLayout` on style change per the task note (all 4 radii ≤48; switching to/from `minimal` (40) keeps rendered positions in-bounds). No out-of-bounds swatch observed.
- **Task 2 (StylePicker):** Presentational `"use client"` component. Loads `/sample-drawing.jpg` ONCE via `new window.Image()` in `useEffect` (hydration-safe, initialized `null`) and passes the decoded element down to all 4 thumbnails. Uses a constant `border-2` with only the *color* toggling on active (accent vs border token) to avoid a 1px layout shift on selection. `aria-pressed` on each button.
- **Task 3 (StyleThumbnail):** Chose the **purpose-built small-preview path** (explicitly permitted by Dev Notes) over wiring the full `EyedropperLayer` into a 60×80 stage — `EyedropperLayer` expects canvas-space swatch positions from `assignSwatchLayout`/`swatchOrder`/`swatchSide`, which is awkward at thumbnail scale. The preview reads ONLY style fields (`connectorType/connectorColor/connectorWidth`, `swatchBorderColor/swatchBorderWidth`, `markerStyle/markerColor`) — never hardcodes per-style branches — and mirrors EyedropperLayer's connector/swatch/marker rules at reduced radii (swatch r=7, ring r=4/dot r=2.5). The sample image is 300×400 = exactly the 60×80 (0.75) aspect ratio, so it fills with no distortion. Renders a neutral `bg-[var(--color-border)]` placeholder box until the shared image loads.
- **Task 4 (wire-in):** Replaced the Style section "Coming soon" stub with `<StylePicker styles={styles} activeStyleName={style.name} onSelect={handleSelectStyle} />`, keeping the `<h3>Style</h3>`.
- **Task 5 (dot branch):** Single `<Circle>` kept; branched `radius`/`fill`/`strokeWidth` inline on `style.markerStyle === "dot"` (dot: 6 / markerColor / 0; ring: 12 / undefined / 2). The `style.markerStyle !== "none"` guard, all drag/hover/contextMenu handlers, and the `cancelBubble` click-to-select are unchanged and shared — the dot is draggable/selectable exactly like the ring. No new `Style`/`styles.json` fields. Resolved the Story 2.3-review deferred item; updated `deferred-work.md` to mark it RESOLVED.
- **Files NOT touched** (per Dev Notes): `lib/styles.ts`, `styles.json`, `lib/types.ts`, `Canvas.tsx`, layout/sampling libs. AC4 was already satisfied by existing `lib/styles.ts` — confirmed, not rewritten.

### File List

- `components/Editor/index.tsx` (MODIFIED) — `useMemo` import; `styles` memo + `setStyle` + `styleRef` sync effect; `handleSelectStyle`; `StylePicker` import + render in Style section.
- `components/Editor/EyedropperLayer.tsx` (MODIFIED) — marker `<Circle>` branches ring/dot on `style.markerStyle`.
- `components/StylePicker.tsx` (IMPLEMENTED, was stub) — horizontal thumbnail strip, shared sample-image load, active-highlight + `aria-pressed`.
- `components/StyleThumbnail.tsx` (NEW) — 60×80 Konva preview driven by style fields; placeholder until image loads.
- `components/StylePicker.test.tsx` (NEW) — 5 tests: button count/names, active `aria-pressed`, accent class, `onSelect` payload, thumbnail wiring.
- `components/StyleThumbnail.test.tsx` (NEW) — 4 tests: placeholder when `sampleImg` null, per-style connector/marker differentiation (float_clean/grid/minimal).
- `components/Editor/EyedropperLayer.test.tsx` (MODIFIED) — `Circle` mock exposes `data-radius`; added ring/dot/none marker + dot-draggable tests.
- `_bmad-output/implementation-artifacts/deferred-work.md` (MODIFIED) — marked the Story 2.3 `markerStyle: "dot"` item RESOLVED.

### Change Log

- 2026-06-15: Implemented Story 3.1 — Style Picker & Live Style Switching. Made `EditorShell` style switchable with synced `styleRef`; implemented `StylePicker` + new `StyleThumbnail` preview; added the `markerStyle: "dot"` branch in `EyedropperLayer`. 13 new tests (169 passing total), tsc clean.

## Review Findings

_Code review 2026-06-15 — 3 adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 4 ACs verified satisfied; tsc clean, 169 tests pass. 9 findings dismissed as noise/false-positive._

- [x] [Review][Patch] Sample-image load has no `onerror` and no effect cleanup [components/StylePicker.tsx:19-23] — FIXED 2026-06-15 (added cleanup nulling `onload`; tsc clean, StylePicker tests pass). — `new window.Image()` in the load effect has no `onerror` (a 404 leaves all 4 thumbnails as placeholders forever) and no cleanup nulling `onload` (setState-after-unmount, a silent no-op in React 19). Low severity — the asset is a committed static file so the 404 path isn't reachable today — but it's new code with a trivial unambiguous fix (add `onerror`, null the handlers in a cleanup return).
- [x] [Review][Defer] Switching to a larger-radius style clips a swatch ≤8px past the canvas edge and can overlap neighbours ≤16px until the next drag [components/Editor/index.tsx:391 (handleSelectStyle), EyedropperLayer.tsx:32,103] — `handleSelectStyle` only calls `setStyle`; `swatchOrder` (clamped under the old radius) is not re-clamped. `minimal`(r=40)→`float`(r=48): a swatch at `swatchOrder = canvasHeight − 40` renders with r=48, so its bottom is `canvasHeight + 8` and gets clipped by the canvas bitmap (Konva doesn't clip, the `<canvas>` does). Adjacent swatches laid out ≥2·40 apart can overlap by up to 16px after the switch. **Story line 33 pre-authorized deferring this** (don't add a re-layout in 3.1) — BUT its stated justification ("40 < 48 keeps positions in-bounds") is backwards: the clip happens *because* the radius grows relative to the smaller-radius clamp, and the dev's Completion Note "No out-of-bounds swatch observed" is incorrect (the minimal→larger extreme case wasn't tested). Deferred per the story's explicit scoping; clean fix later is to re-clamp `swatchOrder` to `[r, edge−r]` (or call `assignSwatchLayout`) inside `handleSelectStyle` when the radius changes.
- [x] [Review][Defer] New filled `dot` marker is near-invisible on light areas [styles.json `grid`, EyedropperLayer.tsx:156] — all 4 styles use `markerColor: "#ffffff"`; the new `dot` branch draws a 6px white filled circle with no stroke (unlike the ring, whose dark surrounding shape stays legible). On light regions of a drawing the dot can vanish. AC-compliant (renders the style's `markerColor`) and the fix needs `styles.json`, which was out of scope for 3.1 — deferred as a UX note for a future style-tuning story.
