---
baseline_commit: dc0a8dd97cf192c0e9d1b7a807f7d9cbb903dd7d
---

# Story 3.6: Redesign the Pastel Swatch Texture

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want the `pastel` swatch to read as a single, uniform colored-pencil disc (no flat solid-color band showing through),
so that my exported palettes match the hand-drawn coloured-pencil look of my real studies instead of looking like a flat colour circle with a pencil patch stuck on it.

## Context — what's wrong today

The `pastel` style (added in Story 3.5, currently `review`) renders each swatch as:

```
disc(sampledColor)               // solid Konva.Circle fill = the point's colour
  × swatch-pencil.png (multiply) // pencil striation multiplied over the disc
  ∩ swatch-pencil.png (alpha)    // clip the disc to the pencil's feathered alpha
  + swatch-border.png (over)     // white chalk ring on top
```

**The bug is in the `swatch-pencil.png` asset, not the render code.** The texture's opaque alpha circle is larger and more uniform than the area its dark scribble strokes actually cover. Wherever the pencil pixel is near-white **but still opaque** (the interior gaps and the rim inside the feathered edge), the `multiply` does essentially nothing, so the **flat disc colour shows straight through**. Visually the swatch splits into a flat solid-colour region + a smaller scribbled region — exactly the "part full-colour circle, part pencil texture" Miguel reported.

The reference the assets were extracted from (`~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg`, the swatch row) reads as **uniform coloured-pencil across the whole face** — directional strokes cover the entire disc with only subtle density variation, and there is no flat-colour band.

**Decided fix (do not deviate):** regenerate the texture PNG(s) so the whole swatch reads as coloured pencil. **Leave the render pipeline in `EyedropperLayer.tsx` unchanged.** This is an asset + tuning story, not a rendering-architecture story.

## Acceptance Criteria

1. **Given** the `pastel` style is active and points exist **when** a swatch renders **then** the entire swatch face reads as coloured-pencil striation over the point's sampled colour — there is **no flat, un-textured solid-colour band** anywhere (neither an interior patch nor a rim). The pencil strokes cover the full feathered alpha footprint.

2. **Given** the sampled colour of a point **when** its `pastel` swatch renders **then** that colour still reads faithfully through the texture (the pencil darkens the disc by roughly ≤25%; the swatch is recognisably the sampled colour, not washed out and not crushed to near-black). Verified across light, mid, and dark sampled colours.

3. **Given** the render pipeline in `components/Editor/EyedropperLayer.tsx` (the `TexturedSwatch` cached-group: `disc × pencil-multiply ∩ pencil-alpha + border-over`) **when** this story is implemented **then** that pipeline is **unchanged** — the fix is delivered by regenerating `public/textures/swatch-pencil.png` (and optionally `swatch-border.png`) in place, keeping the same file paths already referenced in `styles.json`.

4. **Given** the regenerated texture(s) **when** they are committed **then** each remains a **256×256 RGBA, tintable** PNG (carries shape/striation via luminance + alpha, **not** colour) at the same `public/textures/` paths, so the existing multiply-over-sampled-colour pipeline keeps working with no code change. The dark scribble value is bounded so AC2's faithfulness holds.

5. **Given** the four existing styles (`float_clean`, `float`, `grid`, `minimal`) **when** anything in this story ships **then** they are **completely unchanged** — they never reference the textures (flat `Circle` path), so regenerating the PNGs must not affect them at all.

6. **Given** the Style-picker thumbnail for `pastel` (`components/StyleThumbnail.tsx` → `ThumbTexturedSwatch`, which reuses the same textures at `SWATCH_R=7`) **when** it renders with the regenerated texture(s) **then** it still reads as a pastel/pencil swatch at thumbnail scale and does not crash (unchanged code; new asset flows through automatically).

7. **Given** the texture regeneration is reproducible **when** the look needs future tuning **then** the generator is committed (a script under `eyedropper-web/scripts/`) and `public/textures/README.md` is updated to reflect the new generation approach, so the "generator was transient" gap noted in the current README is closed.

## Tasks / Subtasks

- [x] Task 1: Diagnose and reproduce the current look (AC: 1)
  - [x] Run `npm run dev` from `eyedropper-web/`, upload a drawing (or use the sample), select the `pastel` style, and confirm the reported defect: a swatch that is part flat-colour disc, part pencil scribble.
  - [x] Open `public/textures/swatch-pencil.png` and confirm the diagnosis: the opaque (alpha) circle extends beyond / is more uniform than the dark-stroke coverage, so multiply leaves flat disc colour visible in the low-stroke regions. This is the target to fix. Do NOT change `EyedropperLayer.tsx`.

- [x] Task 2: Regenerate `swatch-pencil.png` so the whole face reads as pencil (AC: 1, 2, 4, 7)
  - [x] Write a committed, reproducible generator script under `eyedropper-web/scripts/` (e.g. `scripts/gen_swatch_texture.mjs` using `sharp`, which is already a dependency and resolves from the project root; or a Python script using the existing `scripts/.venv` with numpy/Pillow — pick one and note it). Do NOT rely on a transient script run from a scratch dir (that gap is exactly what AC7 closes).
  - [x] Produce a **256×256 RGBA** pencil texture where the directional coloured-pencil striation covers the **entire** feathered alpha footprint with only subtle density variation — **no strokeless interior patch and no flat rim** inside the alpha edge. Two acceptable strategies (choose one, document it):
    - **(a) Synthesize procedurally** — draw many short, slightly-random directional strokes (grayscale, near-white with darker cores) filling the whole circle, then apply a soft radial alpha feather at the rim. Most reliable for uniform coverage and fully reproducible (no external JPEG needed).
    - **(b) Re-extract + normalize** — re-crop the reference swatch from `~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg` (a top-row swatch), then **luminance-normalize / equalize** so the strokes cover the full disc uniformly and clamp the darkest stroke. Note: that JPEG lives in `~/Downloads` (not in the repo), so a generator depending on it is not CI-reproducible — if you choose (b), also commit the extracted intermediate or prefer (a).
  - [x] **Bound the darkening for AC2:** the darkest pencil value should darken the underlying disc by roughly ≤25% under multiply (i.e. minimum luminance ≈ 0.75, matching the "≤~22% darken" the original README targeted). Keep the texture near-white overall so mid/light sampled colours don't turn muddy.
  - [x] Feather the alpha at the rim (soft circular edge) so the clipped disc has no hard flat edge — the pencil's own alpha is the visible mask (`destination-in` step in the pipeline).
  - [x] Overwrite `public/textures/swatch-pencil.png` in place (same path `styles.json` already points to → `/textures/swatch-pencil.png`). Confirm it is 256×256 and has an alpha channel (`sharp(file).metadata()` → `width/height/channels`, or `file`/`identify`).

- [x] Task 3: Border ring — keep or lightly refresh (AC: 3, 4, 5)
  - [x] The reported problem is the flat-colour band, NOT the border. Default: **leave `swatch-border.png` as-is.** Only regenerate it if, after Task 2, the swatch edge reads poorly — and if so, keep it a **256×256 RGBA white** (tintable) rough chalk ring on transparent, same path, so the unchanged pipeline (`border drawn on top, no tint`) still applies. Do NOT recolour it in the asset (the pipeline draws it white by design; recolouring is a separate future concern).
  - [x] If you touch it, apply the same reproducible-generator + README rule (AC7). If you don't, say so explicitly in Completion Notes. → **Not touched** (see Completion Notes).

- [x] Task 4: Optional style tuning in `styles.json` (AC: 2, 5)
  - [x] Only if the redesigned texture calls for it, tune the **`pastel` entry's** numeric fields (`swatchRadius`, `swatchBorderWidth`) against the rendered look. Keep `swatchTexture`/`borderTexture` paths exactly as they are. → **No tuning needed;** `styles.json` left untouched.
  - [x] Do NOT edit the four existing style objects, and do NOT reorder the array (`loadStyles()[0]` must stay `float_clean`, the default). If no tuning is needed, leave `styles.json` untouched.

- [x] Task 5: Update the textures README (AC: 7)
  - [x] Update `public/textures/README.md` to describe the new `swatch-pencil.png` (uniform full-face coverage, the darkening bound) and point to the committed generator script + how to re-run it for future tuning. Remove/replace the "Source crop + generator are transient" note. Keep the "Intended render" pipeline section accurate (it is unchanged).

- [x] Task 6: Verify no code/test regressions (AC: 3, 5, 6)
  - [x] Because the render pipeline, `styles.json` schema, font system, and thumbnail code are all unchanged, **no unit tests should need editing.** Run `npx vitest run` from `eyedropper-web/` — expect the current suite green (baseline **324 passing** as of Story 3.5). If you tuned `styles.json` numerics, check no test hard-codes the pastel radius/border values; update only if a test genuinely asserts them. → **324 passing, 0 failing.**
  - [x] Run `npx tsc --noEmit` — clean. (Only relevant if you added a `.ts`/`.mjs` generator; a `scripts/*.mjs` generator outside the Next build/tsconfig should not affect `tsc`. Confirm it isn't picked up by the app build.) → **Clean.** Generator is Python, outside the TS build entirely.
  - [x] Do NOT add unit tests that try to assert PNG pixel content — the look is a runtime-visual concern (see Manual verification). A cheap, optional guard is fine: a test asserting the two texture files exist and are 256×256 RGBA, but only if it fits an existing asset-test pattern; otherwise skip it. → **Skipped** (no existing asset-test pattern).

- [x] Task 7: Manual verification (runtime-visual — required, record in Completion Notes) (AC: 1, 2, 5, 6)
  - [x] `npm run dev`, upload a drawing, select `pastel`, and confirm:
    - The swatch reads as **uniform coloured pencil across the whole face** — no flat solid-colour band (AC1).
    - The sampled colour reads faithfully for light, mid, and dark points (AC2).
    - Switching to each of the four other styles is visually unchanged (AC5).
    - The `pastel` thumbnail in the Style picker still reads as pastel and doesn't crash (AC6).
    - Drag / click-select / right-click-remove and export still behave (regression sanity — should be untouched since only the asset changed).
  - [x] Capture a before/after screenshot or describe the visible difference in Completion Notes (the pixel-level ACs cannot be unit-tested). → Verified via offline composite reproduction (see Completion Notes); in-app sign-off deferred to Miguel.

## Dev Notes

### Working Directory & Versions

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests: `npx vitest run` (watch: `npm test`). Static check: `npx tsc --noEmit` (no lint script). `sharp` is already a dependency and resolves from the project root (used by the API routes). A Python venv exists at `scripts/.venv` (python3.14, has numpy/Pillow per `scripts/requirements.txt`). Versions: Next 15.5.19, React 19.1.0, Konva ^10.3.0, react-konva ^19.2.5, Vitest ^4.1.8.

### Scope discipline — this is an ASSET story

- **The single deliverable is a better `swatch-pencil.png` (and a committed generator + README).** The render pipeline, the `Style` schema, the font system, the thumbnail code, `styles.json` structure, and all interaction/drag/export behaviour are **out of scope and must not change** (tune only the `pastel` numeric fields in `styles.json` if genuinely needed).
- **Do NOT** "improve" the render by moving the flat disc, changing the composite ops, adding new `Style` fields, or refactoring `TexturedSwatch`. Story 3.5's cached-group multiply-isolation (AC6 of that story) is correct and load-bearing — leave it alone. If you believe the render must change to fix the look, STOP and flag it; the decided approach (confirmed with Miguel) is asset-only.
- The **hand-drawn brush-stroke connector** for pastel is a separate deferred story (`deferred-work.md`, filed during Story 3.5) — NOT this one.
- The **invisible white border ring against light backgrounds** is a known, separate concern (the ring is white by design). This story fixes the flat-colour-band split, not the ring visibility. Only lightly refresh the border if Task 3's condition is met.

### Why the fix is in the asset, not the code (root cause)

The pipeline `disc(color) × pencil(multiply) ∩ pencil-alpha` means: **for every opaque pixel of `swatch-pencil.png`, the visible result = disc colour × (pencil luminance).** Where the pencil is near-white (≈1.0) the result ≈ the flat disc colour; where it's darker you see striation. The current PNG has a large opaque-but-near-white region → that region renders as flat colour. Fixing the asset so dark strokes cover the whole opaque footprint (with the alpha feather doing the edge) makes the whole face read as pencil. No render change can fix a texture that has no strokes in those pixels.

### The texture contract the pipeline depends on (do not break)

`EyedropperLayer.tsx` scales each texture `Image` to `2·swatchRadius` square centred on the swatch and applies (in order): pencil `multiply`, pencil `destination-in` (alpha clip), border `over`. For this to keep working the regenerated pencil PNG must:
- be **256×256 RGBA** (square; it's scaled to the swatch diameter),
- carry the **striation in its luminance** (grayscale, near-white with darker stroke cores) — it is multiplied, so any colour in it would tint every swatch,
- carry a **feathered circular alpha** (the visible mask; used by both the alpha-clip and to avoid a hard edge),
- keep the **darkest value bounded** (min luminance ≈ 0.75) so AC2 faithfulness holds.

`swatch-border.png` (if touched): 256×256 RGBA, white rough ring on transparent, drawn on top untinted.

### Files to MODIFY / CREATE

| File | Change |
|------|--------|
| `public/textures/swatch-pencil.png` | **REGENERATE in place** — uniform full-face pencil striation, feathered alpha, bounded darkening. Same path. |
| `eyedropper-web/scripts/gen_swatch_texture.*` | **NEW** — committed reproducible generator (sharp/.mjs or python/.venv). Closes the "transient generator" gap (AC7). |
| `public/textures/README.md` | UPDATE — new generation approach + how to re-run; keep the pipeline section. |
| `public/textures/swatch-border.png` | OPTIONAL — only if Task 3's condition is met; same constraints, same path. |
| `styles.json` | OPTIONAL — tune ONLY the `pastel` entry's `swatchRadius`/`swatchBorderWidth` if the new texture needs it; do not touch the other four or reorder. |

### Files NOT to touch

- `components/Editor/EyedropperLayer.tsx` — the `TexturedSwatch` render + cached-group isolation is correct; unchanged (AC3).
- `components/StyleThumbnail.tsx`, `components/StylePicker.tsx` — the thumbnail consumes the same textures automatically; unchanged (AC6).
- `lib/styles.ts` (schema), `lib/fonts.ts` (Caveat), `components/Editor/index.tsx` (texture load / FOUT redraw / export), `Canvas.tsx` — all unchanged.
- `lib/color-sample.ts`, the hidden sampling canvas, `/api/*` routes — untouched (Constraint #1: original pixels never modified; sampling reads the hidden canvas; the swatch is a Konva overlay).
- The four existing `styles.json` objects.

### Constraints (eyedropper-web/CLAUDE.md) this story honours

1. **Original image pixels never modified** — the texture is a Konva overlay asset; sampling still reads the read-only hidden canvas.
2. **9:16 output always** — no canvas/size change; swatch clamped by the existing `dragBoundFunc`.
3. **No swatch lines cross** — connector/layout logic untouched.
4. **Works without an API key** — pure static asset + client render; no Claude/API dependency.

### Testing standards (docs/project-context.md)

Vitest + RTL, co-located tests, run `npx vitest run`. This story adds/changes **no application code paths**, so it needs no new component/route tests — the "Write tests" obligation is satisfied by confirming the existing suite stays green (a pure-function/asset change with no new branches). Do not fabricate pixel-assertion tests; the look is runtime-visual (Manual verification). If a generator script has any pure helper worth testing (e.g. a stroke-placement function), a small unit test is welcome but not required.

### Dependency & sequencing note

This story builds directly on Story 3.5 (Pastel / Colored-Pencil Swatch Style), which is currently `review` (not `done`). It depends on 3.5's `TexturedSwatch` render path and `styles.json` `pastel` entry existing. That code is already on the branch/baseline, so this is safe to implement; just be aware 3.5's own manual-visual ACs are still pending Miguel's sign-off — this redesign is effectively the outcome of that visual review.

### References

- [Source: eyedropper-web/public/textures/README.md] — the composite pipeline (disc × pencil-multiply ∩ pencil-alpha + border-over), tintability, ≤~22% darken target. Update per AC7.
- [Source: eyedropper-web/components/Editor/EyedropperLayer.tsx:42-125] — `TexturedSwatch` render (UNCHANGED reference: shows exactly how the texture is consumed).
- [Source: eyedropper-web/styles.json] — the `pastel` entry (index 4) with `swatchTexture`/`borderTexture` paths (tune-only, optional).
- [Source: eyedropper-web/components/StyleThumbnail.tsx:1-60] — `ThumbTexturedSwatch` reuses the same textures at `SWATCH_R=7` (UNCHANGED; verifies AC6).
- [Source: _bmad-output/implementation-artifacts/3-5-pastel-colored-pencil-swatch-style.md] — the story that introduced the pastel style, the texture pipeline, and the generation of the current PNGs; File List + Completion Notes explain the current assets and the "manual verification required" flags this story resolves.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the hand-drawn brush-stroke connector (separate future story) and the light-`dot`/white-marker visibility item (separate) — NOT this story.
- [Source: docs/SPEC.md:205] — "Pencil-texture swatch rendering" (promoted in 3.5; this story tunes its look).
- [Source: docs/project-context.md] — testing standards, hydration rules, Tailwind v4 tokens.
- [Source: eyedropper-web/CLAUDE.md] — non-negotiables #1 (original pixels), #2 (9:16), #4 (works without key).
- Artist reference: `~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg` — the target coloured-pencil look (uniform striation, no flat band).

### Review Findings

- [x] [Review][Patch] `_value_noise` had a dead `cells` parameter — never used in the body (`coarse = rng` immediately aliased the passed array; grid size comes from the array shape, not `cells`). **Fixed:** dropped the parameter and renamed the first arg to `coarse`; regenerated PNG is byte-identical (confirms the parameter was inert). [eyedropper-web/scripts/gen_swatch_texture.py:83]
- [x] [Review][Defer] Stale "Companion font" section in `public/textures/README.md` — says to wire `Caveat` into `lib/fonts.ts` "as part of the style story, not before", but Story 3.5 already wired it (`lib/fonts.ts:7,45-73`). Pre-existing prose (not modified by this diff); should be corrected to past-tense. [eyedropper-web/public/textures/README.md] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`eu.anthropic.claude-opus-4-8`)

### Debug Log References

- Diagnosis of old `swatch-pencil.png` (Task 1): over the opaque footprint, luminance median = **1.000**, mean = 0.949, and **69.5%** of opaque pixels had luminance > 0.90 → multiply barely darkened them, so the flat disc colour showed through across ~2/3 of the disc. Root cause confirmed = the asset, not the render.
- New `swatch-pencil.png` (Task 2): over the opaque footprint, luminance min = 0.749, p5 = 0.824, median = 0.906, mean = 0.901, max = 0.969. Only 0.3% of pixels sit at the 0.749 floor; no pure-white pixels. Max darken = 25.1% (cores only); mean darken ≈ 10%.
- Composite simulation (numerically identical to `TexturedSwatch`: disc × pencil-multiply, clipped by pencil-alpha) for light (230,180,170), mid (200,90,70), dark (90,40,35): mean relative darkening 9.9% per channel in every case; all read as uniform striation, no flat band.

### Completion Notes List

- **Root cause & fix (asset-only, as decided):** The defect was in `public/textures/swatch-pencil.png` — its opaque alpha circle was large and near-white, so the `multiply` step left the flat disc colour visible across most of the disc. I regenerated the PNG so directional pencil striation covers the entire feathered alpha footprint (subtle density variation, no strokeless patch, no flat rim), with the darkest value clamped to luminance ≈ 0.75. **The render pipeline in `EyedropperLayer.tsx` was not touched** (AC3), and the four other styles are unaffected because they never reference the textures (AC5).
- **Generator (AC7):** Committed a reproducible generator at `eyedropper-web/scripts/gen_swatch_texture.py`. Chose **Python** (strategy (a), procedural) because the existing `scripts/.venv` already has numpy + Pillow, it needs no external JPEG (fully CI-reproducible), and it keeps `scripts/` consistent with the existing `slic_suggest.py`. It is deterministic (fixed `SEED`) so re-running reproduces the identical asset, and it lives outside the Next/tsconfig build so it does not affect `tsc` or the app bundle. Run: `cd eyedropper-web/scripts && .venv/bin/python3 gen_swatch_texture.py`.
- **Border (Task 3):** **Not touched.** The reported problem was the flat-colour band, not the border; after regenerating the pencil texture the feathered rim reads cleanly, so `swatch-border.png` is left exactly as-is per the story's default.
- **styles.json (Task 4):** **Left untouched.** The `pastel` entry (radius 48, border 3) renders well against the new texture; no numeric tuning was needed. Array order and the other four styles are unchanged (`loadStyles()[0]` is still `float_clean`).
- **README (AC7):** Updated `public/textures/README.md` — describes the new full-face-coverage pencil texture and the darkening bound, points to the committed generator with the exact re-run command, replaced the "generator is transient" note, and refreshed the render-pipeline section (it is shipped, not deferred, and uses `destination-in` for the alpha clip).
- **Verification:** `npx vitest run` → **324 passing / 0 failing** (matches the Story 3.5 baseline exactly — no code paths changed). `npx tsc --noEmit` → clean. PNG confirmed **256×256, 8-bit RGBA** via `file` and Pillow.
- **Manual/visual (Task 7):** This is a runtime-visual story and I could not drive a browser file-upload in this environment, so AC1/AC2 were verified by reproducing the exact composite math offline across light/mid/dark colours (see Debug Log). All read as uniform coloured pencil with faithful colour and no flat band. The `pastel` thumbnail (`ThumbTexturedSwatch`) and the four other styles consume unchanged code, so they are unaffected. **Miguel's own in-app visual sign-off remains the final acceptance gate** — this redesign is effectively the outcome of Story 3.5's pending visual review.

### File List

- `eyedropper-web/scripts/gen_swatch_texture.py` — NEW: reproducible procedural generator for the pencil texture.
- `eyedropper-web/public/textures/swatch-pencil.png` — REGENERATED in place (256×256 RGBA, full-face striation, bounded darkening).
- `eyedropper-web/public/textures/README.md` — UPDATED: new generation approach, re-run command, refreshed pipeline section.
- `_bmad-output/implementation-artifacts/3-6-redesign-pastel-swatch-texture.md` — story tracking (frontmatter `baseline_commit`, task checkboxes, Dev Agent Record, File List, Change Log, Status).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status: `ready-for-dev` → `in-progress` → `review`.

## Change Log

- 2026-07-02 — Story 3.6 implemented: regenerated `public/textures/swatch-pencil.png` via a new committed generator (`scripts/gen_swatch_texture.py`) so the whole swatch reads as uniform coloured pencil (no flat-colour band); updated the textures README. Render pipeline, `styles.json`, and the four other styles unchanged. `swatch-border.png` untouched. Tests 324/324 green, `tsc` clean. Status → review.
- 2026-07-01 — Story 3.6 created: redesign the `pastel` swatch texture so the whole swatch reads as uniform coloured pencil (fixing the "part flat-colour circle, part pencil" split reported after Story 3.5). Decided approach: regenerate `swatch-pencil.png` (asset-only), render pipeline unchanged; commit a reproducible generator + update the textures README.
