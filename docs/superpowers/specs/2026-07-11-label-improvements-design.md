# Label improvements — design

Date: 2026-07-11
Branch: feature/pastel-styles-fonts-labelfix

Improve the eyedropper label experience across four fronts: larger click
target for empty labels, opening the label panel by clicking the label,
applying font/size/color to all labels by default, and better default
positioning plus CAD-style snapping when dragging a label.

## Context

Relevant files:

- `components/Editor/LabelEditOverlay.tsx` — HTML text inputs + drag grip shown
  in label-edit mode; the source of truth for label drag.
- `components/Editor/LabelLayer.tsx` — Konva `Text` labels (live preview + export).
- `components/Editor/LabelPanel.tsx` — right-panel label controls; currently
  has three "Apply to all" buttons.
- `components/Editor/index.tsx` — stateful root; owns points, selection,
  `snapGuides`, and the label handlers.
- `lib/label-layout.ts` — `getLabelPosition` seeds a label's default anchor
  relative to its swatch.
- `lib/swatch-layout.ts` — `computeSwatchSnap` + `SnapGuide` type; the model
  for the new label snapping. `SnapGuideLayer` renders `SnapGuide[]`.
- `lib/apply-to-all.ts` — `applyFieldToAll(points, id, field)`.

Labels store `x, y` in **canvas space** (left/baseline-ish origin of the Konva
`Text`). Snapping and guides run in canvas space.

## Requirements

### 1. Quick changes

**1a. Wider empty-label click target.** In `LabelEditOverlay`, the input width
is `Math.max(p.label.text.length, 3)ch`. Raise the floor to **10ch** so empty
and short labels are easy to grab; longer text still hugs its glyphs.

**1b. Clicking a label opens its panel.** Currently only the marker/swatch
selects a point, and `LabelPanel` shows only when a point is selected in
label-edit mode. The overlay's label input will call `onSelectPoint(p.id)` on
pointer-down/focus so clicking a label opens the same right panel as clicking
its point.

**1c. Apply-to-all by default; remove the buttons.** Delete the three
"Apply to all" buttons and the `onApplyToAll` prop from `LabelPanel`. In the
editor, editing **fontFamily / fontSize / color** broadcasts to every label
(via `applyFieldToAll`). **Text, visibility, and position stay per-label.**
`handleUpdateLabel` branches: those three fields fan out; `text`/`visible`/`x`/`y`
stay scoped to the single point.

### 2. Default position & drag grip

**2a. Grip aligned with the label.** The `⠿` grip sits at `top: 0`,
`fontSize: 12` while text may be 16–48px, so it floats near the text's top.
Center it vertically against the label height (`top: 50%; transform:
translateY(-50%)`), still just left of the text origin (`right: 100%`) so it
never displaces glyphs. Result: grip shares the label's horizontal center-line.

**2b. Sane default seeding.** In `getLabelPosition`:
- Clamp against the measured label **box** (not just the origin point) so the
  whole label stays on-canvas — today `Math.min(canvasWidth, pos.x)` can seed a
  label at the far edge and let text overflow off-screen.
- For the "below" (center-aligned) case, store `x` as the label's **left**
  origin = swatchCenterX − halfWidth, because the Konva `Text` has no `width`
  set (so `align="center"` is a no-op) and labels otherwise drift right of the
  swatch. This makes the default genuinely centered under / beside the swatch.

Label width is measured via the shared canvas `measureText` helper from
Section 3.

### 3. Label drag snapping

New pure module `lib/label-snap.ts`, modeled on `computeSwatchSnap`. A label is
a **box** `{ x, y, width, height }`; `width` measured with a cached canvas
`measureText` at the label's font/size (canvas-space px), `height ≈ fontSize`.

Snap targets — labels snap to **other labels** and to **their own marker**,
never to other nodes/swatches:

- **X axis:** dragged label's left / center / right edge → any other label's
  left / center / right, **and** its own marker X.
- **Y axis:** dragged label's top / middle / bottom → any other label's
  top / middle / bottom, **and** its own marker Y.

Soft-snap band using the same screen-px threshold (`SNAP_SCREEN_PX / scale`) as
swatches — no sticky state, resolved independently per axis. When an edge snaps,
the returned label origin is back-computed so that edge lands on the target
(e.g. right-edge snap → `x = target − width`).

Guides: reuse `SnapGuide` (`{ axis, pos }`) and the existing `SnapGuideLayer`.
Vertical guide at the snapped X-line, horizontal at the snapped Y-line — so a
line appears when aligning by column, row, or begin/end/center. No
equal-interval distribution cue (swatch-only; not requested for labels).

Wiring: the drag lives in `LabelEditOverlay` (HTML) but guides render on Konva.
The overlay's `onPointerMove` calls a new editor handler
`handleLabelDragMove(id, x, y)` that runs `computeLabelSnap`, writes the snapped
`label.x/y`, and sets `snapGuides`; `onPointerUp` clears them. Reuse the
existing `snapGuides` state + layer already used for swatch drags.

## Testing

- `lib/label-snap.test.ts` (TDD): edge + center snapping on each axis;
  own-marker snap; no snap outside band; independent per-axis resolution;
  edge-snap origin back-computation; guides emitted.
- `lib/label-layout.test.ts`: updated default seeding (box clamp, centered
  "below" origin).
- Overlay/editor tests: clicking a label selects its point;
  fontFamily/fontSize/color edits broadcast to all labels; text/visibility
  stay per-label.

## Non-goals

- No equal-interval distribution cue for labels.
- No snapping of labels to markers/swatches other than the label's own marker.
- Label text and visibility remain per-label (never broadcast).
