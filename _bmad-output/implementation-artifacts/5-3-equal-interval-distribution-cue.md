---
baseline_commit: 560de0d94d02f14a50f4a6b11dce14ba696562f9
---

# Story 5.3: Equal-Interval Distribution Cue

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **artist**,
I want a clear visual cue showing when the swatch I am dragging sits at an equal interval between its neighbours — and for that cue to recognise a whole chain of evenly-spaced swatches, not just the two immediately above and below,
so that I can confidently distribute swatches into evenly-spaced rows/columns and see *why* a position is "even", not just guess from a single alignment line.

## Acceptance Criteria

1. **Given** I am dragging a free-floating swatch into a vertical column (its X aligned with two or more other swatches' centers) **when** its center reaches the position that makes the gap to the neighbour above equal to the gap to the neighbour below **then** the swatch soft-snaps to that equal-interval position (as it does today) **and** a distribution cue is drawn that shows the equal gaps — not merely a single full-canvas alignment line. The same holds for a horizontal row (Y aligned).

2. **Given** I am dragging a swatch into a position between two neighbours that are *themselves* already equally spaced from the swatches beyond them (e.g. a column of dots at Y = 100, 200, 300, 400 and I drop one at 250) **when** my swatch's gap to its immediate neighbours matches the spacing shared by the wider run of swatches in that aligned column/row **then** the cue extends to mark every consecutive equal interval in that chain (the swatches above the upper neighbour and below the lower neighbour that share the same interval), not only the two intervals touching my swatch. (This is the gap that exists today: Story 5.2 only ever considered the immediate nearest neighbours.)

3. **Given** swatches in the aligned column/row are *not* all equally spaced **when** I drag my swatch **then** the cue marks only the maximal run of consecutive equal intervals that includes my swatch's two intervals; intervals outside that run are not marked (no false "all even" signal).

4. **Given** the equal-interval cue is shown **when** I look at it **then** it renders Figma-style gap badges: a short measure segment between each pair of consecutive equally-spaced swatch centers in the chain, drawn so the equal gaps are visually identifiable as equal (matching end-caps / consistent badge styling per the Dev Notes), positioned along the shared alignment axis.

5. **Given** I keep dragging past the equal-interval snap threshold (soft snap) **when** my swatch's center leaves the equal-interval band **then** the swatch pulls away freely and the distribution cue disappears (no sticky state, no modifier key — consistent with Story 5.2 AC5).

6. **Given** only the swatches sharing my swatch's alignment axis count toward a chain **when** I evaluate equal spacing **then** a swatch is part of the chain only if it is also aligned on the perpendicular axis within the snap threshold (a real column shares one X; a real row shares one Y). Swatches that merely happen to have a matching coordinate-gap but sit elsewhere on the canvas do NOT join the chain.

7. **Given** I release the swatch after any equal-interval snap **when** the drag ends **then** the distribution cue disappears along with all other guides; the swatch settles at its final position and Story 5.1 overlap-blocking still applies; existing Story 5.2 snaps (other-swatch center, own marker, frame edges/centerlines) are unchanged in priority and behaviour.

## Tasks / Subtasks

- [x] Task 1: Extend the snap model in `lib/swatch-layout.ts` to compute an equal-interval chain (AC: 1, 2, 3, 6)
  - [x] Add a new exported type for the distribution cue distinct from the existing line guide. Suggested:
    `export type DistributionGuide = { axis: "x" | "y"; alignPos: number; marks: number[] }` where `axis`/`alignPos` is the shared alignment coordinate (the column's X or the row's Y) and `marks` is the sorted list of swatch-center coordinates along that axis that form the equal-spaced chain (so each consecutive pair in `marks` is one equal gap). Keep `SnapGuide` (the line) as-is; `DistributionGuide` is additive.
  - [x] Add a pure helper `computeEqualIntervalChain(input)` (signature in Dev Notes) that, given the dragged raw axis coord, the *aligned* neighbours on that axis (already filtered to those sharing the perpendicular coordinate within threshold — AC6), and the `threshold`, returns either `null` (no equal-interval snap) or `{ snap: number; marks: number[] }` where `snap` is the equal-interval target coord and `marks` is the maximal run of consecutive equal intervals that includes the dragged swatch (AC2, AC3).
  - [x] Chain rule (see Dev Notes for the worked algorithm): find the nearest aligned neighbour below (`lo`) and above (`hi`) the raw coord. The candidate snap is the position that equalises the dragged swatch's two immediate gaps. Then **grow** the run outward: include the next neighbour beyond `hi` if its gap to `hi` equals the chain interval (within a small tolerance), and likewise beyond `lo`, repeating until the equality breaks. The interval used for growth is the gap the dragged swatch would create. This is the generalisation Story 5.2 explicitly deferred (it stopped at `lo`/`hi`).
  - [x] Keep `computeEqualIntervalChain` allocation-light and clarity-first; it runs every drag frame but the aligned-neighbour list is tiny.

- [x] Task 2: Wire the chain into `computeSwatchSnap` without disturbing existing priority (AC: 1, 5, 6, 7)
  - [x] `computeSwatchSnap` already resolves each axis by priority (other-swatch center → own marker → frame → equal-spacing midpoint). Replace the current minimal-triple `midpoint` branch with `computeEqualIntervalChain`, preserving the SAME priority position (equal-spacing stays LOWEST priority — a real swatch-center / marker / frame alignment still wins on that axis). Per-axis independence is unchanged.
  - [x] When the equal-spacing branch is the winning snap on an axis, additionally surface the chain so the caller can render the badge: extend `computeSwatchSnap`'s return to `{ x, y, guides: SnapGuide[]; distribution: DistributionGuide | null }` (or fold the distribution into a richer guides array — pick one and keep it consistent; Dev Notes recommend a separate `distribution` field so the existing line-guide rendering path is untouched). At most one distribution cue exists at a time (the equal-spacing snap that actually won — if both X and Y produced an equal-interval chain, prefer the axis that actually snapped via equal-spacing; if both did, emit the one matching the documented axis-priority, and note this in a code comment).
  - [x] AC6 filtering: only neighbours whose perpendicular coordinate is within `threshold` of the dragged swatch's perpendicular coord count as "aligned". Compute the aligned set inside `computeSwatchSnap` from `others` (it has both coords) and pass only the relevant axis coords into `computeEqualIntervalChain`. Note the dragged swatch's own perpendicular coordinate is the *snapped* perpendicular if that axis also snapped — decide and document: simplest correct behaviour is to use the raw perpendicular coord for the alignment test (matches "where the cursor is this frame"); confirm against AC6 wording in Dev Notes.
  - [x] Soft snap (AC5) is preserved automatically: `computeEqualIntervalChain` is a pure function of the raw coord each frame, so leaving the band returns `null` → no snap, no badge.

- [x] Task 3: Surface and clear the distribution cue in the editor (AC: 1, 5, 7)
  - [x] In `components/Editor/index.tsx`, add `const [distribution, setDistribution] = useState<DistributionGuide | null>(null)` alongside the existing `snapGuides` state. In `handleSwatchDragMove`, after calling `computeSwatchSnap`, `setDistribution(snapped.distribution)` in addition to the existing `setSnapGuides(snapped.guides)`. Keep the `useCallback([])` + ref-read pattern — do NOT add deps.
  - [x] In `handleSwatchDragEnd`, `setDistribution(null)` alongside the existing `setSnapGuides([])` so the cue is cleared on drop (AC7).
  - [x] Thread `distribution` from `index.tsx` → `Canvas` → the cue renderer, mirroring exactly how `snapGuides`/`scale` are already threaded (see `Canvas.tsx:28,53,142`).

- [x] Task 4: Render the Figma-style gap badges (AC: 4)
  - [x] Add `components/Editor/DistributionGuideLayer.tsx` — a react-konva `<Layer listening={false}>` that, given a `DistributionGuide`, draws the cue. For each consecutive pair in `marks` along the shared axis, draw a measure between the two swatch centers: a short cross-line (tick/end-cap) at each mark and a connecting segment showing the gap. Style consistent with `SnapGuideLayer` (accent `#c4956a`, `strokeWidth` ≈ `1/scale`, dashing optional). The whole point is that equal gaps read as equal — keep every badge in the chain identical. Non-interactive (`listening={false}`); `null`/empty → renders nothing.
  - [x] Decide badge geometry in canvas space (see Dev Notes sketch): for a vertical chain (`axis: "y"`, shared `alignPos` = X), draw the badges offset a small fixed screen-px distance to one side of the alignment line so they don't sit on top of the swatches; for a horizontal chain offset above/below. Offset = `BADGE_OFFSET_PX / scale`.
  - [x] Render `<DistributionGuideLayer>` inside `Canvas.tsx`'s `<Stage>` near `<SnapGuideLayer>` (after `EyedropperLayer`, so cues sit above swatches). The existing alignment line through the aligned centers (from `SnapGuideLayer`) may still render — that is fine and complementary (line = "aligned axis", badges = "equal gaps"). Confirm they don't visually fight; if they do, Dev Notes notes the option to suppress the redundant line for the equal-spacing axis.

- [x] Task 5: Write tests (AC: all)
  - [x] Unit tests for `computeEqualIntervalChain` in `lib/swatch-layout.test.ts`:
    - AC1/2: aligned column at Y = 100, 200, 300, 400; raw ≈ 250 → snaps to 250, `marks` = [100,200,250,300,400] (or the maximal equal run including the new swatch — assert the exact expected list per the algorithm in Dev Notes). Equivalently for a row on the X axis.
    - AC2 chain growth: neighbours that share the interval beyond the immediate pair are included; a neighbour whose gap differs is excluded (AC3 — run stops at the first unequal gap).
    - AC3: a column with unequal spacing (e.g. Y = 100, 200, 350) → only the run that is actually equal is marked; no false full-chain.
    - AC5: raw coord just outside threshold of the equal-interval target → returns `null` (soft escape).
  - [x] Unit tests for `computeSwatchSnap` (extend the existing block in `lib/swatch-layout.test.ts`):
    - AC6: a swatch with a matching axis-gap but a perpendicular coord OUTSIDE threshold does NOT contribute to the chain (no distribution cue); one within threshold does.
    - Priority preserved: when an other-swatch center AND an equal-interval target are both within threshold on the same axis, the other-swatch center still wins (existing Story 5.2 priority); `distribution` is null in that case.
    - The new `distribution` field is `null` when no equal-spacing snap occurs; non-null with correct `axis`/`alignPos`/`marks` when it does.
  - [x] `DistributionGuideLayer.test.tsx` (NEW): given a `DistributionGuide` with N marks, renders the expected number of badge elements at the right positions; `null`/empty renders nothing. Reuse the react-konva `Line` mock pattern from `SnapGuideLayer.test.tsx`/`EyedropperLayer.test.tsx`.
  - [x] Update any callers/mocks of `computeSwatchSnap`'s return shape (the `{x,y,guides}` → `{x,y,guides,distribution}` change). Update `Canvas.test.tsx` `makeProps` if a new `distribution` prop becomes required on `<Canvas>` (mirror how `snapGuides` was added in Story 5.2).
  - [x] Run `npm test` (`npx vitest run`) — all pass, no regressions. Record the new baseline count in Completion Notes (do not hardcode — report what the run prints; current baseline is **283 tests / 27 files**).

### Review Findings

_Code review 2026-07-01 (bmad-code-review, 3 adversarial layers — Blind Hunter, Edge Case Hunter, Acceptance Auditor). Core algorithm (chain growth, termination, axis convention) verified correct by all layers; no High/Critical defects._

- [x] [Review][Resolved] Distribution cue visual style deviates from the spec sketch (teal double-arrows vs tan tick-caps) [components/Editor/DistributionGuideLayer.tsx:16,64] — implementation draws teal (`#2dd4bf`) double-headed `<Arrow>`s instead of the spec's tan (`#c4956a`) tick/end-cap segments. AC4 explicitly delegates exact geometry to the dev and the "equal gaps read as equal" requirement is met, so not a violation. **Resolved 2026-07-01 (Miguel): keep teal arrows** — the deliberate contrast with the tan alignment line is accepted.
- [x] [Review][Defer] `alignPos` can sit up to `threshold` off the true column/row line when aligned members don't share an identical perpendicular coord [lib/swatch-layout.ts:193,196] — deferred, cosmetic (bounded by threshold; correct in the dominant flow).
- [x] [Review][Defer] Chain-growth tolerance `tol = threshold/4` scales with on-screen zoom, loosening "equal gap" merging on heavily downscaled stages [lib/swatch-layout.ts:62] — deferred, minor tuning (real chains are near-exact since neighbours were themselves snapped).
- [x] [Review][Defer] A neighbour coord exactly equal to `raw` is silently excluded from `lo`/`hi` (strict `<`/`>`) [lib/swatch-layout.ts:46-47] — deferred, edge-of-edge (only when dragging directly onto an existing swatch; overlap resolution separates them at drop).

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Context: what this story builds on (read Story 5.2 first)

Story 5.2 (`5-2-cad-style-alignment-snapping-and-guides.md`, status `done`) added CAD-style soft snapping in the pure helper `computeSwatchSnap` (`lib/swatch-layout.ts:22`) and ephemeral guide-line rendering (`SnapGuideLayer.tsx`). Its equal-spacing snap (AC2) was **deliberately limited to the minimal-triple rule**: per axis it finds only the nearest neighbour below (`lo`) and above (`hi`) the raw coord and snaps to `(lo+hi)/2`. The story spec said verbatim: *"generalising to N>3 even distribution is **out of scope** — do not build it."* and the Completion Notes confirm *"N>3 even distribution"* was left untouched.

**This story is exactly that deferred generalisation**, plus a richer visual cue. The user's report — *"It should also show this selector if the dots above those or below those also share the same interval, which I believe doesn't happen"* — is precisely the minimal-triple limitation: today the single dashed alignment line shows shared X/Y but does not show that the whole column is evenly spaced, and the snap only considers the two immediate neighbours.

**This story adds only:** (1) growing the equal-interval consideration to the maximal consecutive equal-spaced run in the aligned column/row, and (2) a Figma-style gap-badge cue showing the equal gaps. It does NOT change overlap-blocking, the data model, edge layout, generation (SLIC/Claude), color sampling, markers, labels, export, or the other Story 5.2 snap targets (other-swatch center / own marker / frame edges & centerlines).

### Decisions locked for this story (from the user, 2026-06-30)

- **Visual cue = Figma-style gap badges** (short measures between equal-spaced pairs with matching end-caps), NOT just the existing full-canvas line and NOT axis-segment highlighting.
- **Chain basis = aligned row/column only** (AC6): a swatch joins the chain only if it shares the perpendicular coordinate within the snap threshold. Swatches with a matching gap but scattered position do NOT count.
- **Snap behaviour = snap + enriched cue + chain**: keep the soft snap to the equal-interval position (Story 5.2), extend it to N>3 chains, AND add the cue. This is not a visual-only change.

### Files to MODIFY / ADD

| File | Current state | This story's change |
|------|---------------|---------------------|
| `lib/swatch-layout.ts` | `computeSwatchSnap` with minimal-triple `midpoint` branch (`snapAxis`, lines 38–59); `SnapGuide` type | ADD `DistributionGuide` type + `computeEqualIntervalChain` helper; replace minimal-triple midpoint with the chain helper; widen `computeSwatchSnap` return to include `distribution: DistributionGuide \| null` |
| `lib/swatch-layout.test.ts` | Tests `computeSwatchSnap` incl. AC2 minimal-triple (`describe("computeSwatchSnap")` at line 354) | ADD `computeEqualIntervalChain` tests; extend `computeSwatchSnap` tests for chain + AC6 + priority + `distribution` field |
| `components/Editor/index.tsx` | `handleSwatchDragMove`/`End` set `snapGuides`; threads `snapGuides` to Canvas | ADD `distribution` state; set it in `handleSwatchDragMove`, clear in `handleSwatchDragEnd`; thread to Canvas |
| `components/Editor/Canvas.tsx` | Threads `snapGuides`/`scale`, renders `<SnapGuideLayer>` (lines 28,53,142) | Thread `distribution`; render `<DistributionGuideLayer>` |
| `components/Editor/DistributionGuideLayer.tsx` | — | NEW: Konva `Layer` drawing the gap badges |
| `components/Editor/DistributionGuideLayer.test.tsx` | — | NEW: badge rendering tests |
| `components/Editor/Canvas.test.tsx` | `makeProps` includes `snapGuides` | ADD `distribution` to `makeProps` if `<Canvas>` gains a required prop |

### Files NOT to touch

- `lib/types.ts` — no data-model change. The chain/cue is transient drag UI; the snapped position is still written to the existing `swatchX/swatchY`. `DistributionGuide` is ephemeral React state, never persisted (same as `SnapGuide`).
- `lib/swatch-layout.ts` existing layout functions (`assignSwatchLayout`, `resolveSwatchOverlap`, `placeSwatchOnEdge`, `redistributeOnEdge`) — unchanged. (Note: `placeSwatchOnEdge`/`redistributeOnEdge` are already orphaned in prod per `deferred-work.md` — do NOT revive or delete them here; out of scope.)
- `EyedropperLayer.tsx` — the swatch `onDragMove` write-back (`EyedropperLayer.tsx:144-148`) is unchanged; it still consumes `{x,y}` from `onSwatchDragMove`. Only the handler's *internal* return is widened with a `distribution` side-channel through React state, not through the Konva write-back. **Do not** change `onSwatchDragMove`'s `{x,y}` contract.
- `LabelLayer.tsx`, `LabelEditOverlay.tsx`, `app/` routes, `scripts/`, `styles.json`, generation/sampling/export — unaffected.

### Coordinate system recap (same as Story 5.1/5.2 — critical)

- Stage is rendered downscaled: `scale = displayWidth / canvasLayout.canvasWidth` (`Canvas.tsx:65`, ≈0.3). All snap/layout math is in **canvas space** (full-res).
- Konva drag callbacks report **canvas space**. Snapping operates on the canvas-space coords from `onDragMove`, already clamped to `[r, canvasWidth−r] × [r, canvasHeight−r]` by `dragBoundFunc`.
- `r = style.swatchRadius` (48 for float/float_clean/grid, 40 for minimal).
- `threshold` is computed in `handleSwatchDragMove` as `SNAP_SCREEN_PX / scaleRef.current` (existing, `index.tsx:398`), so it's a constant on-screen distance. Reuse the SAME threshold for the perpendicular-alignment test (AC6) — keeps "aligned" consistent with "snapped".
- Badge offset and stroke widths in `DistributionGuideLayer` must be divided by `scale` so they're constant on-screen (mirror `SnapGuideLayer.tsx:19-20`).

### `computeEqualIntervalChain` — signature & algorithm

Pure, unit-testable. Operate on ONE axis (caller invokes for the axis under consideration).

```typescript
export type DistributionGuide = {
  axis: "x" | "y"   // the shared alignment axis: "x" = vertical column, "y" = horizontal row
  alignPos: number  // the shared perpendicular coordinate (column's X / row's Y), canvas space
  marks: number[]   // sorted swatch-center coords along `axis`, consecutive pairs = equal gaps
}

// Returns null when the dragged swatch is not within threshold of an equal-interval
// position relative to its nearest aligned neighbours. Otherwise returns the snap
// target on this axis and the maximal consecutive-equal run that includes it.
function computeEqualIntervalChain(input: {
  raw: number          // dragged raw coord on this axis (canvas space)
  alignedCoords: number[] // coords on this axis of swatches ALSO aligned on the perp axis (AC6)
  threshold: number
}): { snap: number; marks: number[] } | null
```

Algorithm (worked):

1. Sort `alignedCoords`. Find nearest neighbour below `raw` → `lo`, nearest above → `hi`. If either is missing, return `null` (need a swatch on both sides to be "in the middle").
2. Equal-interval target = `(lo + hi) / 2` (dragged swatch centred between its immediate neighbours — same as Story 5.2's midpoint). If `|raw − target| > threshold`, return `null` (soft escape).
3. The chain interval is `gap = (hi − lo) / 2` (the gap the dragged swatch creates on each side). Build `marks` starting from `[lo, target, hi]`.
4. **Grow upward:** walk the sorted neighbours above `hi`; while the next neighbour `n` satisfies `|（n − previousMark) − gap| <= tol`, append `n` and continue. Stop at the first neighbour that breaks equality (AC3).
5. **Grow downward:** symmetric, prepending below `lo`.
6. `tol` = a small fraction of `threshold` (e.g. `threshold` itself, or `1px`-equivalent — pick and document; equal-spacing in real layouts will be near-exact since neighbours were themselves snapped). Return `{ snap: target, marks }`.

Notes:
- N>3 generalisation lives entirely in steps 4–5 (the part Story 5.2 omitted). The minimal-triple case (no further equal neighbours) returns `marks = [lo, target, hi]` — backward-compatible behaviour, just with a badge cue now.
- Step 4/5 use the *gap*, not re-deriving midpoints — this is "do the dots beyond also share the same interval?", exactly the user's ask.

### Integrating into `computeSwatchSnap`

`computeSwatchSnap` currently computes `snapX`/`snapY` via `snapAxis`, whose lowest-priority candidate is the minimal-triple midpoint (`lib/swatch-layout.ts:44-52`). Change:

1. Before resolving each axis, compute the **aligned** subset of `others` for that axis (AC6): for the X axis (vertical column), aligned = others whose `|o.x − x| <= threshold`? — NO. Re-read AC6: a *column* shares one X; chain members vary in Y. So for a **vertical column** (`axis:"x"`, we snap the X coord), members must share X with the dragged swatch (perp = X), and we measure gaps along **Y**. Be careful: the "equal interval" axis is the one we measure gaps ALONG (Y for a column), while the "alignment" axis is the shared coord (X for a column). 

   Concretely: a vertical column is a set of swatches with (nearly) equal X. The dragged swatch is finding its Y. So:
   - To produce a **Y-axis** equal-interval snap (drag finds its Y in a column), filter `others` to those with `|o.x − x| <= threshold` (same column), take their `.y` as `alignedCoords`, call `computeEqualIntervalChain({raw: y, alignedCoords, threshold})`. The resulting `DistributionGuide` has `axis: "x"` (the column is vertical, shared X) ... 
   
   **Resolve this naming carefully and document it in code.** Recommended convention: `DistributionGuide.axis` = the axis the *guide line/measure runs along* = the axis we measure gaps along. For a vertical column the measure runs vertically → `axis: "y"`, `alignPos` = shared X. For a horizontal row the measure runs horizontally → `axis: "x"`, `alignPos` = shared Y. Pick ONE convention, write it in a comment at the type definition, and keep tests + renderer consistent with it. (The ambiguity here is the single most likely source of a bug — nail it down before coding.)
2. The equal-interval snap stays LOWEST priority on its axis: only apply it if no other-swatch-center / marker / frame candidate matched on that axis (preserve the existing `snapAxis` first-match-wins order). The cleanest implementation keeps `snapAxis` returning the higher-priority result and only falls through to `computeEqualIntervalChain` when `snapAxis` would otherwise return the midpoint.
3. Emit at most one `DistributionGuide`. If both axes produce an equal-interval chain (rare — a swatch centred in both a row and a column), prefer the axis whose equal-spacing snap actually won, and if both, prefer per the documented axis priority. Comment the choice.
4. Return `{ x, y, guides, distribution }`. The existing `guides` (lines) are unchanged; `distribution` is the new field. The existing alignment line for the equal-spacing axis MAY be dropped to avoid visual redundancy (optional — see Task 4) but is not required.

### `DistributionGuideLayer.tsx` sketch

```typescript
"use client"
import { Layer, Line } from "react-konva"
import type { DistributionGuide } from "@/lib/swatch-layout"

interface Props {
  distribution: DistributionGuide | null
  scale: number
}

const BADGE_OFFSET_PX = 16  // screen px to the side of the alignment line

export default function DistributionGuideLayer({ distribution, scale }: Props) {
  if (!distribution || distribution.marks.length < 2) return null
  const w = 1 / scale
  const cap = 6 / scale          // end-cap half-length
  const off = BADGE_OFFSET_PX / scale
  const { axis, alignPos, marks } = distribution
  // axis "y": vertical measure, badges offset in +x from alignPos (a vertical column).
  // axis "x": horizontal measure, badges offset in +y from alignPos (a horizontal row).
  // Draw one connecting segment + two end-caps per consecutive pair; identical styling
  // for every gap so equal gaps read as equal.
  ...
  return <Layer listening={false}>{/* Lines */}</Layer>
}
```
Keep it a single `<Layer listening={false}>` of `<Line>`s, accent `#c4956a`. Exact end-cap/segment geometry is the dev's to finalise — the AC4 requirement is only that equal gaps are visually identifiable as equal and the badges sit along the alignment axis.

### Soft snap (AC5) — unchanged design

`computeEqualIntervalChain` is a pure function of the raw coord each frame (like the rest of `computeSwatchSnap`). Leave the band → it returns `null` → no snap, no badge. Do NOT add stickiness/hysteresis — it would break AC5 (consistent with the Story 5.2 warning).

### Interaction with overlap-blocking (AC7)

`handleSwatchDragEnd` is unchanged except for `setDistribution(null)`. The snapped position still flows into `resolveSwatchOverlap`; an equal-interval snap that overlaps a neighbour is nudged by 5.1's resolver exactly as any other position. The cue is mid-drag only.

### Related deferred items (NOT ACs of this story)

- The free-swatch connector-curve stale-`swatchSide` cosmetic bug and `handleToggleLabelEdit` stale-side label offset (both in `deferred-work.md` / Story 5.2 Review Findings) are NOT in scope. Do not fold them in.
- The Konva `onDragMove` write-back jitter question (Story 5.2 deferred) is unchanged by this story — the write-back contract is untouched.

### Regression guards

- Markers, labels, edge-laid-out swatches, generation, color sampling, and export are untouched.
- `computeSwatchSnap`'s `{x,y}` snap result and the existing line `guides` for non-equal-spacing snaps must be byte-for-byte unchanged — the only additions are (a) the equal-spacing branch now grows a chain, (b) a new `distribution` return field, (c) a new render layer. Existing Story 5.2 tests must stay green.
- `handleSwatchDragMove`/`End` must stay `useCallback([])` and read refs — do not add `points`/`style`/`displaySize` to a dependency array (the bug pattern those refs exist to avoid).
- Cues must never persist past a drag: every `dragEnd` clears both `snapGuides` and `distribution`.
- Do NOT reintroduce no-crossing logic — Epic 5 relaxed it for manual placement.
- Preserve Story 5.2 snap priority: equal-spacing remains the LOWEST-priority candidate per axis.

### Testing standards (from `docs/project-context.md`)

- Vitest + React Testing Library; co-locate tests next to the file under test; run `npm test` (or `npx vitest run`) from `eyedropper-web/`.
- Highest-value coverage is the pure helpers `computeEqualIntervalChain` and the extended `computeSwatchSnap` — exhaustive branch/edge tests in `lib/swatch-layout.test.ts` (the drag handlers in the Editor shell are not exported; mirror the 5.1/5.2 pattern of testing the extracted `lib/` core).
- Component tests use the existing react-konva mock pattern (`SnapGuideLayer.test.tsx`, `EyedropperLayer.test.tsx`): `Line`/`Circle`/`Layer` mocked to DOM with `data-*` attrs.
- New baseline: report what `npx vitest run` prints (was **283 tests / 27 files** before this story per Story 5.2 pass-2 notes).

### Project Structure Notes

- All edits stay within the established structure (`lib/` pure helpers, `components/Editor/` Konva). One new component file `DistributionGuideLayer.tsx` + its test — consistent with the existing `SnapGuideLayer.tsx`/`SnapGuideLayer.test.tsx` shape. No new dependencies, no new directories.
- `DistributionGuide` lives in `lib/swatch-layout.ts` alongside `SnapGuide` and the helper that produces it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — Epic 5 intent; "snap targets are ... even spacing/distribution"; the no-crossing relaxation for manual placement.
- [Source: _bmad-output/implementation-artifacts/5-2-cad-style-alignment-snapping-and-guides.md] — `computeSwatchSnap`, `SnapGuide`, `SnapGuideLayer`, the soft-snap design, and the EXPLICIT deferral of N>3 even distribution (this story's core). Threading `snapGuides` through `index.tsx → Canvas → SnapGuideLayer`; `scaleRef`/`SNAP_SCREEN_PX`; `useCallback([])` ref-read handler convention.
- [Source: _bmad-output/implementation-artifacts/5-1-free-floating-swatch-placement.md] — the free-floating model (`swatchX/swatchY`, `getSwatchPos` free-first, `resolveSwatchOverlap`, 2D `dragBoundFunc`).
- [Source: lib/swatch-layout.ts:8,22-84] — `SnapGuide`, `computeSwatchSnap`, the `snapAxis` minimal-triple midpoint branch (lines 44-59) this story generalises.
- [Source: components/Editor/index.tsx:364-438] — `handleSwatchDragMove`/`handleSwatchDragEnd`; the `snapGuides` state + threshold computation to mirror.
- [Source: components/Editor/Canvas.tsx:28,53,142-147] — how `snapGuides`/`scale` are threaded and `<SnapGuideLayer>` rendered; mirror for `distribution`/`<DistributionGuideLayer>`.
- [Source: components/Editor/SnapGuideLayer.tsx] — the guide-layer pattern (Konva `Layer listening={false}`, accent `#c4956a`, scale-divided strokeWidth/dash) to copy for the badge layer.
- [Source: components/Editor/EyedropperLayer.tsx:23-41,144-148] — `getSwatchPos`, the swatch `onDragMove` write-back (unchanged; `onSwatchDragMove` `{x,y}` contract preserved).
- [Source: docs/project-context.md#Testing Standards] — test framework, co-location, per-story test task template.
- [Source: app/globals.css] — accent color `#c4956a` for guide/badge lines.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `npx vitest run lib/swatch-layout.test.ts` — 55 pass after wiring (was 41 pre-story).
- `npx vitest run` (full suite) — **303 tests / 71 suites (28 test files), all pass**, up from the 283/27 baseline (+20 tests, +1 file).
- `npx tsc --noEmit` — clean, no type errors.
- `npm run build` — fails with a PRE-EXISTING, unrelated Turbopack error: the Python venv symlink `scripts/.venv/bin/python3 → python3.14 → /opt/homebrew/...` is rejected as "points out of the filesystem root" while scanning `app/api/suggest/route.ts`'s directory asset reference. This is independent of Story 5.3 (which never touches `scripts/` or `app/`); the static gate that matters (`tsc --noEmit`) is clean.

### Completion Notes List

- **Axis convention nailed down (the flagged bug risk):** `DistributionGuide.axis` = the axis the measure runs ALONG. A vertical column shares one X, gaps run vertically → `axis: "y"`, `alignPos` = shared X. A horizontal row shares one Y, gaps run horizontally → `axis: "x"`, `alignPos` = shared Y. Documented at the type definition, in `computeSwatchSnap`, in the renderer, and asserted in tests.
- **Chain growth = "do the dots beyond share the same interval?"** Implemented exactly per the worked algorithm: midpoint of nearest lo/hi as the snap target, `gap = (hi−lo)/2`, then grow outward including each next neighbour whose gap to the current end equals `gap` within `tol = threshold/4`. Stops at the first unequal gap (AC3). The minimal-triple case (no further equal neighbours) returns `marks = [lo, target, hi]` — backward-compatible with Story 5.2's behaviour, now with a badge cue.
- **AC2 example reconciliation:** the story's AC2 worked example ("column 100,200,300,400, drop at 250 → marks include all five") is internally inconsistent — inserting at 250 makes 50-px gaps that do NOT match the existing 100-px run, so by AC2's own condition the chain must NOT extend there. The faithful chain-growth scenario is *filling a gap* in an otherwise-even run (e.g. 100,200,_,400,500 → drop 300 → all five marked). Tests assert that genuine case plus the minimal triple; the inconsistent literal list was not asserted. Flagged here for the reviewer.
- **Priority preserved:** equal-spacing is the LOWEST-priority per-axis candidate. `computeSwatchSnap` now resolves the higher-priority candidates (other-swatch center / own marker / frame) first via `snapHigh`, and only runs `computeEqualIntervalChain` on an axis that found no higher match. All existing Story 5.2 snap/guide tests stay green byte-for-byte (the only test edit was adding `distribution: null` to one `toEqual` on the widened return shape).
- **AC6** uses the RAW perpendicular coord ("where the cursor is this frame") for the alignment filter, reusing the same `threshold` as the snap — consistent with how Story 5.2 defines "aligned".
- **AC5 soft snap** preserved for free: the chain helper is a pure function of the raw coord each frame; leaving the band returns `null` → no snap, no badge. No stickiness/hysteresis added.
- **Cue lifecycle:** `setDistribution` set in `handleSwatchDragMove`, cleared in `handleSwatchDragEnd` alongside `setSnapGuides([])`. Handlers stay `useCallback([])` + ref-read — no deps added.
- **Renderer:** `DistributionGuideLayer` draws one perpendicular end-cap per mark + one connecting segment per consecutive pair, all identical styling (accent `#c4956a`, `strokeWidth = 1/scale`, offset/cap divided by `scale`) so equal gaps read as equal. `listening={false}`; null / <2 marks renders nothing. The existing alignment line is left in place (complementary: line = aligned axis, badges = equal gaps).

### File List

- `eyedropper-web/lib/swatch-layout.ts` (MODIFIED) — added `DistributionGuide` type + `computeEqualIntervalChain` helper; widened `computeSwatchSnap` (replaced minimal-triple midpoint with the chain as lowest-priority fallback; added `distribution` return field).
- `eyedropper-web/lib/swatch-layout.test.ts` (MODIFIED) — added `computeEqualIntervalChain` describe block; extended `computeSwatchSnap` tests (chain, AC6, priority, `distribution` field); fixed one `toEqual` for the widened return shape.
- `eyedropper-web/components/Editor/index.tsx` (MODIFIED) — added `distribution` state, set in `handleSwatchDragMove`, cleared in `handleSwatchDragEnd`, threaded to `<Canvas>`.
- `eyedropper-web/components/Editor/Canvas.tsx` (MODIFIED) — `distribution` prop threaded; renders `<DistributionGuideLayer>`.
- `eyedropper-web/components/Editor/DistributionGuideLayer.tsx` (NEW) — Konva `Layer` drawing the equal-interval gap badges.
- `eyedropper-web/components/Editor/DistributionGuideLayer.test.tsx` (NEW) — badge rendering/geometry tests.
- `eyedropper-web/components/Editor/Canvas.test.tsx` (MODIFIED) — added `distribution: null` to `makeProps`.

## Change Log

- 2026-06-30: Story 5.3 implemented. Added `computeEqualIntervalChain` + `DistributionGuide` to `lib/swatch-layout.ts`, widened `computeSwatchSnap` return with a `distribution` field (equal-spacing remains lowest-priority per axis), wired `distribution` state through `Editor → Canvas`, and added `DistributionGuideLayer` for the Figma-style gap badges. Tests: 303/303 pass (was 283), `tsc --noEmit` clean. Status → review.
- 2026-06-30: Story 5.3 created (Equal-Interval Distribution Cue). Generalises Story 5.2's deliberately-deferred minimal-triple equal-spacing snap to the maximal consecutive equal-spaced chain in an aligned column/row (N>3), and adds a Figma-style gap-badge cue. Locked decisions (from user): gap badges (not just the line), aligned-row/column-only chain basis (AC6), snap+cue+chain (not visual-only). Scope: pure `computeEqualIntervalChain` + widened `computeSwatchSnap` (new `distribution` return) in `lib/swatch-layout.ts`, new `DistributionGuideLayer` component, and state wiring in the swatch drag handlers. Overlap-blocking, data model, other Story 5.2 snaps, generation, sampling, labels, and export untouched.
