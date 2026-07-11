# Label Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve eyedropper labels — bigger empty-label click target, open the label panel by clicking a label, apply font/size/color to all labels by default (remove the buttons), better default positioning, aligned drag grip, and CAD-style snapping while dragging labels.

**Architecture:** A new pure module `lib/label-snap.ts` mirrors `lib/swatch-layout.ts`'s `computeSwatchSnap` but operates on label **boxes** (x, y, width, height) and snaps edges + centers to other labels and the label's own marker. Text width is measured by a `lib/measure-text.ts` helper in the browser and threaded into the pure functions as an explicit parameter (jsdom has no canvas 2D backend, so pure functions must never measure internally). The drag lives in the HTML `LabelEditOverlay`; snapping runs through a new editor handler that reuses the existing `snapGuides` Konva layer.

**Tech Stack:** Next.js 15 / React 19, react-konva, TypeScript, Vitest + jsdom + Testing Library.

## Global Constraints

- Test runner: `npx vitest run <file>` (CI-style, one-shot). `@/` aliases the `eyedropper-web/` root. Test files sit next to code as `*.test.ts(x)`.
- **jsdom `canvas.getContext("2d")` returns `null`** — never call `measureText` inside a pure/unit-tested function. Measurement helpers must guard for a null context and fall back to an estimate; pure functions receive width/height as parameters.
- Labels store `x, y` in **canvas space** (the Konva `Text` origin = top-left). Snapping and guides run in canvas space.
- Coordinates convention from `lib/label-layout.ts`: `getLabelPosition` returns the label's origin. Reuse the existing `SnapGuide = { axis: "x" | "y"; pos: number }` type from `lib/swatch-layout.ts` and the existing `SnapGuideLayer`.
- All commands run from `eyedropper-web/`.
- Match existing file style (comment density, `useCallback([])` + refs pattern in `index.tsx`).

---

## File Structure

- **Create** `lib/measure-text.ts` — browser text-width measurement with a cached canvas + null-context fallback.
- **Create** `lib/measure-text.test.ts` — tests for the fallback path (jsdom has no 2D context).
- **Create** `lib/label-snap.ts` — pure `computeLabelSnap` (edge/center/marker snapping → snapped origin + `SnapGuide[]`).
- **Create** `lib/label-snap.test.ts` — pure-function tests.
- **Modify** `lib/label-layout.ts` — `getLabelPosition` takes label width/height, clamps by box, centers the "below" origin.
- **Modify** `lib/label-layout.test.ts` — update for the new signature.
- **Modify** `components/Editor/index.tsx` — measure label width when seeding; `handleUpdateLabel` broadcasts font/size/color; new `handleLabelDragMove`/`handleLabelDragEnd`; pass to Canvas.
- **Modify** `components/Editor/apiPointsToEyedroppers.test.ts` — update `seedNewLabels` calls for the new `getLabelPosition` signature.
- **Modify** `components/Editor/LabelPanel.tsx` — remove the apply-to-all buttons + prop.
- **Modify** `components/Editor/LabelPanel.test.tsx` — drop the apply-to-all test + prop.
- **Modify** `components/Editor/LabelEditOverlay.tsx` — 10ch min width; grip vertically centered; select-on-focus; drag calls new snap handlers.
- **Modify** `components/Editor/LabelEditOverlay.test.tsx` — add width/grip/select tests; new drag prop names.
- **Modify** `components/Editor/Canvas.tsx` — thread label-drag handlers + `onSelectPoint` into `LabelEditOverlay`.
- **Modify** `components/Editor/Canvas.test.tsx` — update overlay props if asserted.

---

### Task 1: `measure-text.ts` — cached width measurement with fallback

**Files:**
- Create: `lib/measure-text.ts`
- Test: `lib/measure-text.test.ts`

**Interfaces:**
- Produces: `measureLabelWidth(text: string, fontSize: number, fontFamily: string): number` — canvas-space px width of `text`. Uses a module-cached offscreen canvas 2D context; when the context is null (jsdom) or `text` is empty, returns an estimate `Math.max(text.length, 1) * fontSize * 0.55`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/measure-text.test.ts
import { describe, it, expect } from "vitest"
import { measureLabelWidth } from "./measure-text"

describe("measureLabelWidth", () => {
  it("falls back to a length*fontSize estimate when no 2D context (jsdom)", () => {
    // jsdom's canvas has no 2D backend, so this exercises the fallback branch.
    const w = measureLabelWidth("Crimson", 16, "serif")
    // 7 chars * 16 * 0.55 = 61.6
    expect(w).toBeCloseTo(7 * 16 * 0.55, 5)
  })

  it("uses a minimum width of 1 char for empty text", () => {
    const w = measureLabelWidth("", 20, "serif")
    // max(0,1) * 20 * 0.55 = 11
    expect(w).toBeCloseTo(1 * 20 * 0.55, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/measure-text.test.ts`
Expected: FAIL — `measureLabelWidth` not found / module missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/measure-text.ts
import { resolveFontFamily } from "./fonts"

// A single reused offscreen canvas context for text measurement — created lazily
// on first use in the browser. In jsdom getContext("2d") returns null, so we cache
// the null result and fall through to the estimate every time (never re-probe).
let ctx: CanvasRenderingContext2D | null | undefined

function getCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx
  if (typeof document === "undefined") return (ctx = null)
  ctx = document.createElement("canvas").getContext("2d")
  return ctx
}

// Canvas-space width (px) of `text` at the label's font. Falls back to a coarse
// estimate when no 2D context is available (jsdom) so callers and tests stay
// deterministic without a real canvas backend. `fontFamily` is the label's stored
// font key; resolveFontFamily maps it to the @font-face family Konva renders with.
export function measureLabelWidth(text: string, fontSize: number, fontFamily: string): number {
  const c = getCtx()
  if (c) {
    c.font = `${fontSize}px ${resolveFontFamily(fontFamily)}`
    const w = c.measureText(text).width
    if (w > 0) return w
  }
  return Math.max(text.length, 1) * fontSize * 0.55
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/measure-text.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/measure-text.ts lib/measure-text.test.ts
git commit -m "feat: measureLabelWidth helper with jsdom fallback"
```

---

### Task 2: `label-snap.ts` — pure CAD-style label snapping

**Files:**
- Create: `lib/label-snap.ts`
- Test: `lib/label-snap.test.ts`

**Interfaces:**
- Consumes: `SnapGuide` from `./swatch-layout`.
- Produces:
  - type `LabelBox = { x: number; y: number; width: number; height: number }`
  - `computeLabelSnap(input: { box: LabelBox; others: LabelBox[]; marker: { x: number; y: number }; threshold: number }): { x: number; y: number; guides: SnapGuide[] }`
  - Returns the snapped **origin** (top-left) and the guide line(s). Per-axis independent soft snap (no sticky state). X candidates: each other box's left/center/right + own marker X, matched against the dragged box's left/center/right (whichever edge is closest within `threshold` wins; origin back-computed so that edge lands on the target). Y candidates: each other box's top/middle/bottom + own marker Y, matched against the dragged box's top/middle/bottom. A guide is emitted at the matched target line for each snapped axis.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/label-snap.test.ts
import { describe, it, expect } from "vitest"
import { computeLabelSnap, type LabelBox } from "./label-snap"

const THR = 8
// Far-away marker so it never interferes unless a test places it deliberately.
const FAR = { x: 9999, y: 9999 }

function box(x: number, y: number, width = 40, height = 16): LabelBox {
  return { x, y, width, height }
}

describe("computeLabelSnap", () => {
  it("snaps left edge to another label's left edge and emits an x guide", () => {
    const other = box(100, 500)
    // dragged left edge at 104 → within 8px of other.left=100.
    const r = computeLabelSnap({ box: box(104, 500), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)
    expect(r.guides).toContainEqual({ axis: "x", pos: 100 })
  })

  it("snaps right edge to another label's right edge (origin back-computed)", () => {
    // other right edge = 100 + 40 = 140. dragged width 40; want dragged right (x+40)
    // to land on 140 → x = 100. Place dragged right edge at 137 (x=97) → snaps.
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(97, 500), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)
    expect(r.guides).toContainEqual({ axis: "x", pos: 140 })
  })

  it("snaps centers on both axes and emits both guides", () => {
    // other center x = 100+20 = 120, center y = 500+8 = 508.
    const other = box(100, 500)
    // dragged center x should hit 120 → x = 120-20 = 100. Put dragged center at 122 (x=102).
    // dragged center y should hit 508 → y = 508-8 = 500. Put dragged center at 510 (y=502).
    const r = computeLabelSnap({ box: box(102, 502), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)
    expect(r.y).toBe(500)
    expect(r.guides).toContainEqual({ axis: "x", pos: 120 })
    expect(r.guides).toContainEqual({ axis: "y", pos: 508 })
  })

  it("snaps to the label's own marker on each axis", () => {
    // marker at (300, 400). dragged left edge near 300 (x=304) → x snaps so left=300.
    // dragged top near 400 (y=403) → y snaps so top=400.
    const r = computeLabelSnap({
      box: box(304, 403), others: [], marker: { x: 300, y: 400 }, threshold: THR,
    })
    expect(r.x).toBe(300)
    expect(r.y).toBe(400)
    expect(r.guides).toContainEqual({ axis: "x", pos: 300 })
    expect(r.guides).toContainEqual({ axis: "y", pos: 400 })
  })

  it("does not snap when outside the threshold band; no guides", () => {
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(140, 560), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(140)
    expect(r.y).toBe(560)
    expect(r.guides).toEqual([])
  })

  it("resolves axes independently (x snaps, y free)", () => {
    const other = box(100, 500)
    const r = computeLabelSnap({ box: box(103, 800), others: [other], marker: FAR, threshold: THR })
    expect(r.x).toBe(100)      // left→left
    expect(r.y).toBe(800)      // untouched
    expect(r.guides).toEqual([{ axis: "x", pos: 100 }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/label-snap.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/label-snap.ts
import type { SnapGuide } from "./swatch-layout"

export type LabelBox = { x: number; y: number; width: number; height: number }

// CAD-style soft snapping for a freely-dragged LABEL (mirrors computeSwatchSnap,
// but a label is a box so its LEFT/CENTER/RIGHT (x) and TOP/MIDDLE/BOTTOM (y)
// edges each snap). Pure function of the raw dragged box each frame: per axis,
// scan every candidate target line; the first (edge, target) pair within
// `threshold` wins, and the origin is back-computed so that edge lands on the
// target. Axes resolve independently. Soft snap — no sticky state, no modifier.
//
// Candidates come only from OTHER labels' edges/centers and the label's OWN
// marker (never other markers/swatches) — see the design doc.
export function computeLabelSnap(input: {
  box: LabelBox
  others: LabelBox[]
  marker: { x: number; y: number }
  threshold: number
}): { x: number; y: number; guides: SnapGuide[] } {
  const { box, others, marker, threshold } = input

  // For one axis: `edges` are the dragged box's three lines as offsets from the
  // origin (0 = origin edge, half = center, full = far edge); `targets` are the
  // candidate absolute lines. Returns the new origin + the matched target line,
  // or null when nothing is within the band. First match wins (edges scanned
  // near→far, targets in array order) for stable, predictable snapping.
  const snapAxis = (
    origin: number,
    edges: number[],
    targets: number[]
  ): { origin: number; guide: number } | null => {
    for (const off of edges) {
      const linePos = origin + off
      for (const t of targets) {
        if (Math.abs(linePos - t) <= threshold) {
          return { origin: t - off, guide: t }
        }
      }
    }
    return null
  }

  const xTargets = [
    ...others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width]),
    marker.x,
  ]
  const yTargets = [
    ...others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height]),
    marker.y,
  ]

  const sx = snapAxis(box.x, [0, box.width / 2, box.width], xTargets)
  const sy = snapAxis(box.y, [0, box.height / 2, box.height], yTargets)

  const guides: SnapGuide[] = []
  if (sx) guides.push({ axis: "x", pos: sx.guide })
  if (sy) guides.push({ axis: "y", pos: sy.guide })

  return {
    x: sx ? sx.origin : box.x,
    y: sy ? sy.origin : box.y,
    guides,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/label-snap.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/label-snap.ts lib/label-snap.test.ts
git commit -m "feat: computeLabelSnap pure edge/center/marker label snapping"
```

---

### Task 3: `getLabelPosition` — box-aware clamp + centered "below" origin

**Files:**
- Modify: `lib/label-layout.ts:19-42`
- Test: `lib/label-layout.test.ts` (whole file — signature change)

**Interfaces:**
- Consumes: nothing new.
- Produces: new signature
  `getLabelPosition(swatchPos, side, labelPosition, swatchRadius, canvasWidth, canvasHeight, labelWidth: number, labelHeight: number): { x: number; y: number }`
  The returned `{x, y}` is the label **origin** (top-left). For `"below"`, `x = swatchCenterX − labelWidth/2` (genuinely centered). The whole box is clamped so `0 ≤ x ≤ canvasWidth − labelWidth` and `0 ≤ y ≤ canvasHeight − labelHeight`.

- [ ] **Step 1: Rewrite the test file to the new signature**

```typescript
// lib/label-layout.test.ts
import { describe, it, expect } from "vitest"
import { getLabelPosition, LABEL_GAP } from "./label-layout"

const R = 48
const W = 800
const H = 1422
const LW = 60   // label width
const LH = 16   // label height
const swatchPos = { x: 200, y: 300 }

describe("getLabelPosition", () => {
  describe("labelPosition 'below'", () => {
    it("centers the label origin under a top-edge swatch (origin = centerX - width/2)", () => {
      const pos = getLabelPosition(swatchPos, "top", "below", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x - LW / 2)
      expect(pos.y).toBe(swatchPos.y + R + LABEL_GAP)
    })

    it("places the label ABOVE a bottom-edge swatch so it stays on-canvas", () => {
      const bottomSwatch = { x: 200, y: H - R }
      const pos = getLabelPosition(bottomSwatch, "bottom", "below", R, W, H, LW, LH)
      expect(pos.x).toBe(bottomSwatch.x - LW / 2)
      expect(pos.y).toBe(bottomSwatch.y - R - LABEL_GAP)
      expect(pos.y).toBeLessThan(bottomSwatch.y)
    })
  })

  describe("labelPosition 'beside'", () => {
    it("places the label to the right of a left-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "left", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("places the label to the left of a right-edge swatch", () => {
      const pos = getLabelPosition(swatchPos, "right", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(swatchPos.x - R - LABEL_GAP)
      expect(pos.y).toBe(swatchPos.y)
    })

    it("defaults to the right side for top/bottom/auto swatches", () => {
      for (const side of ["top", "bottom", "auto"] as const) {
        const pos = getLabelPosition(swatchPos, side, "beside", R, W, H, LW, LH)
        expect(pos.x).toBe(swatchPos.x + R + LABEL_GAP)
        expect(pos.y).toBe(swatchPos.y)
      }
    })
  })

  describe("clamps the whole box into canvas bounds", () => {
    it("never lets a right-side label overflow the right edge", () => {
      // A right-side label off a left-edge swatch near the right wall would push
      // its right edge past W; clamp pins origin to W - labelWidth.
      const pos = getLabelPosition({ x: W - 2, y: 300 }, "left", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(W - LW)
    })

    it("never returns a negative x", () => {
      const pos = getLabelPosition({ x: 4, y: 300 }, "right", "beside", R, W, H, LW, LH)
      expect(pos.x).toBe(0)
    })

    it("never lets the box overflow the bottom edge", () => {
      const pos = getLabelPosition({ x: 200, y: H - 2 }, "top", "below", R, W, H, LW, LH)
      expect(pos.y).toBe(H - LH)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/label-layout.test.ts`
Expected: FAIL — signature mismatch / wrong clamp values.

- [ ] **Step 3: Rewrite `getLabelPosition`**

Replace `lib/label-layout.ts:19-42` (the function body, keep the `LABEL_GAP` export and update the doc comment) with:

```typescript
// Compute the canvas-space ORIGIN (top-left) where a label sits relative to its
// swatch. Pure. The caller supplies the swatch position (getSwatchPos) and the
// measured label box (labelWidth/labelHeight) so this never touches a canvas.
//
// - "below": centered under the swatch — origin x = swatchCenterX - labelWidth/2;
//   ABOVE a bottom-edge swatch, whose "below" would fall off the canvas floor.
// - "beside": to the inner side of the swatch at its vertical center. Left-edge
//   swatch → label right; right-edge swatch → label left; top/bottom/auto → right.
//
// The whole BOX is finally clamped into [0, canvasWidth-labelWidth] ×
// [0, canvasHeight-labelHeight] so no part of the label seeds off-screen.
export function getLabelPosition(
  swatchPos: { x: number; y: number },
  side: EyedropperPoint["swatchSide"],
  labelPosition: Style["labelPosition"],
  swatchRadius: number,
  canvasWidth: number,
  canvasHeight: number,
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  let pos: { x: number; y: number }
  if (labelPosition === "below") {
    const dy = side === "bottom" ? -(swatchRadius + LABEL_GAP) : swatchRadius + LABEL_GAP
    pos = { x: swatchPos.x - labelWidth / 2, y: swatchPos.y + dy }
  } else if (side === "right") {
    pos = { x: swatchPos.x - swatchRadius - LABEL_GAP, y: swatchPos.y }
  } else {
    pos = { x: swatchPos.x + swatchRadius + LABEL_GAP, y: swatchPos.y }
  }
  return {
    x: Math.max(0, Math.min(canvasWidth - labelWidth, pos.x)),
    y: Math.max(0, Math.min(canvasHeight - labelHeight, pos.y)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/label-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/label-layout.ts lib/label-layout.test.ts
git commit -m "feat: getLabelPosition clamps by box and centers below-origin"
```

---

### Task 4: Wire measurement into `seedNewLabels` + `handleToggleLabelEdit`

**Files:**
- Modify: `components/Editor/index.tsx` (import; `seedNewLabels` at `:141-159`; `handleToggleLabelEdit` at `:567-593`)
- Test: `components/Editor/apiPointsToEyedroppers.test.ts` (`seedNewLabels` calls at `:152, :169-171, :178, :186`)

**Interfaces:**
- Consumes: `measureLabelWidth` (Task 1), new `getLabelPosition` signature (Task 3).
- Produces: `seedNewLabels` unchanged signature (still `(before, after, style, canvasWidth, canvasHeight)`) but now measures each label's width internally and passes it (plus `label.fontSize` as height) to `getLabelPosition`.

- [ ] **Step 1: Update the two `getLabelPosition` call sites + import**

Add the import near the other `@/lib` imports in `components/Editor/index.tsx`:

```typescript
import { measureLabelWidth } from "@/lib/measure-text"
```

In `seedNewLabels` (`:151-158`), replace the `.map` body:

```typescript
  return after.map((p) => {
    if (p.swatchOrder === null || alreadyLaidOut.has(p.id)) return p
    const swatchPos = getSwatchPos(p, canvasWidth, canvasHeight, style.swatchRadius)
    const w = measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily)
    const anchor = getLabelPosition(
      swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
      canvasWidth, canvasHeight, w, p.label.fontSize
    )
    return { ...p, label: { ...p.label, x: anchor.x, y: anchor.y } }
  })
```

In `handleToggleLabelEdit` (`:580-589`), replace the `.map` body:

```typescript
        prev.map((p) => {
          if (p.swatchOrder === null) return p
          const swatchPos = getSwatchPos(
            p, layout.canvasWidth, layout.canvasHeight, style.swatchRadius
          )
          const w = measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily)
          const labelPos = getLabelPosition(
            swatchPos, p.swatchSide, style.labelPosition, style.swatchRadius,
            layout.canvasWidth, layout.canvasHeight, w, p.label.fontSize
          )
          return { ...p, label: { ...p.label, x: labelPos.x, y: labelPos.y } }
        })
```

- [ ] **Step 2: Update `apiPointsToEyedroppers.test.ts` expectations**

Read the file first. The `seedNewLabels` calls themselves don't change (its signature is unchanged), but assertions that pin exact seeded `label.x/y` values must be recomputed for the centered/box-clamped origin. For each such assertion, replace the hard-coded expected coordinate with the value the new formula yields (compute it: for "below", `x = swatchCenterX − measureLabelWidth(text,fontSize,fontFamily)/2`, with the empty-string seed text → width `= 1*fontSize*0.55`; then box-clamped). Where a test only asserts "inside canvas bounds" (e.g. `:157`), assert `x >= 0 && x <= W - w` instead of an exact value.

Concretely, change any assertion of the shape `expect(seeded[0].label.x).toBe(<oldval>)` to match the new formula, and relax bounds-only assertions to inequalities. (The file's `seedNewLabels(before, after, style, W, H)` calls stay verbatim.)

- [ ] **Step 3: Run tests to verify they fail then pass**

Run: `npx vitest run components/Editor/apiPointsToEyedroppers.test.ts`
Expected after edits: PASS. (If any assertion still uses an old literal, fix it to the computed value.)

- [ ] **Step 4: Typecheck the editor compiles**

Run: `npx tsc --noEmit`
Expected: no errors from `index.tsx` about `getLabelPosition` arity.

- [ ] **Step 5: Commit**

```bash
git add components/Editor/index.tsx components/Editor/apiPointsToEyedroppers.test.ts
git commit -m "feat: measure label width when seeding default label positions"
```

---

### Task 5: Apply font/size/color to all labels by default

**Files:**
- Modify: `components/Editor/index.tsx` (`handleUpdateLabel` at `:595-602`; remove `handleApplyToAll` at `:614-619`; `LabelPanel` render at `:864-870`)
- Modify: `components/Editor/LabelPanel.tsx` (remove buttons + prop)
- Test: `components/Editor/LabelPanel.test.tsx`

**Interfaces:**
- Consumes: `applyFieldToAll` (already imported).
- Produces: `handleUpdateLabel(id, patch)` now branches — when `patch` contains `fontFamily`, `fontSize`, or `color`, those keys broadcast to ALL points; `text`/`visible`/`x`/`y` stay scoped to `id`. `LabelPanel` loses its `onApplyToAll` prop.

- [ ] **Step 1: Update `LabelPanel.test.tsx`**

Remove the `onApplyToAll` from `makeProps` (delete line `onApplyToAll: vi.fn(),`) and delete the entire `it("renders Font/Size/Color apply-to-all buttons...")` test (`:106-120`). The remaining tests already cover `onUpdate` for each field.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/Editor/LabelPanel.test.tsx`
Expected: FAIL — `onApplyToAll` type still required by `LabelPanel` props (TS) / removed test's absence is fine but props mismatch.

- [ ] **Step 3: Edit `LabelPanel.tsx`**

Remove `onApplyToAll` from `Props` (delete line 9). Delete the entire "Apply to all labels" `<div className="mt-4">…</div>` block (`:92-116`). Update the header comment (`:12-15`) to drop the Story-3.4 apply-to-all sentence.

- [ ] **Step 4: Edit `index.tsx`**

Replace `handleUpdateLabel` (`:595-602`) with the branching version:

```typescript
  const handleUpdateLabel = useCallback(
    (id: string, patch: Partial<EyedropperPoint["label"]>) => {
      // Presentation fields (font/size/color) apply to EVERY label by default;
      // text/visibility/position stay scoped to the one point.
      const broadcastKeys = ["fontFamily", "fontSize", "color"] as const
      setPoints((prev) =>
        prev.map((p) => {
          const isTarget = p.id === id
          const next = { ...p.label }
          for (const [k, v] of Object.entries(patch)) {
            if ((broadcastKeys as readonly string[]).includes(k)) {
              ;(next as Record<string, unknown>)[k] = v
            } else if (isTarget) {
              ;(next as Record<string, unknown>)[k] = v
            }
          }
          return { ...p, label: next }
        })
      )
    },
    []
  )
```

Delete `handleApplyToAll` (`:614-619`) and its now-unused `applyFieldToAll` import (line 12) — but first check whether `applyFieldToAll` is used elsewhere in the file; it is not, so remove the import. Update the `LabelPanel` render (`:864-870`) to drop the `onApplyToAll` prop:

```typescript
        {selectedPoint && labelEditMode && (
          <LabelPanel
            label={selectedPoint.label}
            onUpdate={(patch) => handleUpdateLabel(selectedPoint.id, patch)}
          />
        )}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run components/Editor/LabelPanel.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Delete the now-unused `apply-to-all` module + test**

`applyFieldToAll` has no remaining callers after this task. Delete both files:

```bash
git rm lib/apply-to-all.ts lib/apply-to-all.test.ts
```

Confirm nothing else imports it:

Run: `grep -rn "apply-to-all\|applyFieldToAll" lib components app`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add components/Editor/index.tsx components/Editor/LabelPanel.tsx components/Editor/LabelPanel.test.tsx
git commit -m "feat: font/size/color edits apply to all labels by default; remove apply-to-all buttons"
```

---

### Task 6: Overlay — 10ch min width, centered grip, select-on-focus, snap-drag

**Files:**
- Modify: `components/Editor/LabelEditOverlay.tsx`
- Test: `components/Editor/LabelEditOverlay.test.tsx`

**Interfaces:**
- Consumes: nothing new (snap math lives in the editor via the drag callback).
- Produces: `LabelEditOverlay` gains an `onSelectPoint: (id: string) => void` prop. The existing `onUpdateLabelPos: (id, x, y) => void` remains the write path — the editor's handler (Task 7) applies snapping before writing, so the overlay stays snap-agnostic. Input min width becomes `10ch`. Grip is vertically centered against the label height.

- [ ] **Step 1: Add failing tests**

Append to `components/Editor/LabelEditOverlay.test.tsx` inside the `describe`:

```typescript
  it("gives the input at least a 10ch min width for empty/short labels", () => {
    const points = [makePoint("p1", { label: { text: "" } })]
    const { getByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        onSelectPoint={vi.fn()}
        {...DEFAULT}
      />
    )
    expect((getByRole("textbox") as HTMLInputElement).style.width).toBe("10ch")
  })

  it("selects the point when its input is focused", () => {
    const onSelectPoint = vi.fn()
    const points = [makePoint("p1")]
    const { getByRole } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        onSelectPoint={onSelectPoint}
        {...DEFAULT}
      />
    )
    fireEvent.focus(getByRole("textbox"))
    expect(onSelectPoint).toHaveBeenCalledWith("p1")
  })

  it("centers the drag grip vertically against the label height", () => {
    const points = [makePoint("p1", { label: { fontSize: 24 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        onSelectPoint={vi.fn()}
        {...DEFAULT}
      />
    )
    const grip = getByLabelText("Drag label 1")
    expect(grip.style.top).toBe("50%")
    expect(grip.style.transform).toBe("translateY(-50%)")
  })
```

Also add `onSelectPoint={vi.fn()}` to every existing `<LabelEditOverlay .../>` render in this file (the prop is now required).

- [ ] **Step 2: Run test to verify new tests fail**

Run: `npx vitest run components/Editor/LabelEditOverlay.test.tsx`
Expected: FAIL — width is `3ch` not `10ch`; grip `top` is `0` not `50%`; `onSelectPoint` undefined.

- [ ] **Step 3: Edit `LabelEditOverlay.tsx`**

1. Add `onSelectPoint: (id: string) => void` to `Props` (after `onUpdateLabelPos`).
2. Destructure `onSelectPoint` in the component params.
3. Grip style (`:117-128`): change `top: 0` to `top: "50%"` and add `transform: "translateY(-50%)"`.
4. Input: add `onFocus={() => onSelectPoint(p.id)}` and change width from `Math.max(p.label.text.length, 3)ch` to `Math.max(p.label.text.length, 10)ch`.

The input `style.width` line becomes:

```typescript
                width: `${Math.max(p.label.text.length, 10)}ch`,
```

The grip `style` object's top becomes:

```typescript
                position: "absolute",
                right: "100%",
                top: "50%",
                transform: "translateY(-50%)",
                marginRight: 4,
```

The input gets the focus handler alongside `onChange`:

```typescript
              onFocus={() => onSelectPoint(p.id)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/Editor/LabelEditOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Editor/LabelEditOverlay.tsx components/Editor/LabelEditOverlay.test.tsx
git commit -m "feat: label overlay 10ch min width, centered grip, select-on-focus"
```

---

### Task 7: Editor — snapping drag handlers + Canvas wiring

**Files:**
- Modify: `components/Editor/index.tsx` (new handlers near the other drag handlers; Canvas props at `:824-853`)
- Modify: `components/Editor/Canvas.tsx` (thread props into `LabelEditOverlay`)
- Test: `components/Editor/Canvas.test.tsx` (add `onSelectPoint` + drag props to the overlay if asserted)

**Interfaces:**
- Consumes: `computeLabelSnap`, `LabelBox` (Task 2); `measureLabelWidth` (Task 1); existing `snapGuides` state + `setSnapGuides`.
- Produces:
  - `handleLabelDragMove(id, x, y)` — measures the dragged label, gathers OTHER visible labels' boxes + this label's marker (canvas space), runs `computeLabelSnap`, writes snapped `label.x/y`, sets `snapGuides`.
  - `handleLabelDragEnd(id, x, y)` — same snap, writes final `label.x/y`, clears `snapGuides`.
  - `Canvas`/`LabelEditOverlay` receive `onSelectPoint`, and `onUpdateLabelPos` is routed to `handleLabelDragMove` (move) — end handled on pointer-up in the overlay via a second prop `onLabelDragEnd`. To keep the overlay change in Task 6 minimal, the overlay calls `onUpdateLabelPos` on move AND on up; the editor's move handler sets guides, and a `useEffect`-free approach: the overlay also calls a new `onLabelDragEnd` on pointer-up. **Decision:** add `onLabelDragEnd(id, x, y)` to the overlay pointer-up (small addition) — see Step 1.

- [ ] **Step 1: Extend the overlay pointer-up to signal drag end**

In `components/Editor/LabelEditOverlay.tsx`, add prop `onLabelDragEnd?: (id: string, x: number, y: number) => void` to `Props`, destructure it, and in the grip `onPointerUp` (`:97-100`) call it with the label's current position before clearing the ref:

```typescript
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture?.(e.pointerId)
                const d = dragRef.current
                if (d) onLabelDragEnd?.(d.id, p.label.x, p.label.y)
                dragRef.current = null
              }}
```

Add to `LabelEditOverlay.test.tsx` (the drag test already fires `pointerUp`? it does not — add one):

```typescript
  it("calls onLabelDragEnd on pointer up with the label's current position", () => {
    const onLabelDragEnd = vi.fn()
    const points = [makePoint("p1", { label: { x: 100, y: 100 } })]
    const { getByLabelText } = render(
      <LabelEditOverlay
        points={points}
        onUpdateLabelText={vi.fn()}
        onUpdateLabelPos={vi.fn()}
        onSelectPoint={vi.fn()}
        onLabelDragEnd={onLabelDragEnd}
        {...DEFAULT}
      />
    )
    const grip = getByLabelText("Drag label 1")
    fireEvent.pointerDown(grip, { pointerId: 1, clientX: 200, clientY: 300 })
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 240, clientY: 320 })
    expect(onLabelDragEnd).toHaveBeenCalledWith("p1", 100, 100)
  })
```

Run: `npx vitest run components/Editor/LabelEditOverlay.test.tsx` → PASS.

- [ ] **Step 2: Add the editor handlers**

In `components/Editor/index.tsx`, add imports:

```typescript
import { computeLabelSnap, type LabelBox } from "@/lib/label-snap"
```

Add a shared helper + two handlers near `handleUpdateLabelPos` (`:604-607`). Replace `handleUpdateLabelPos` with the snapping move handler and add the end handler:

```typescript
  // Snap a dragged label against OTHER visible labels' boxes and its own marker,
  // then write the snapped origin and surface the alignment guides. Reuses the
  // swatch snapGuides state + Konva SnapGuideLayer. Reads live layout/scale from
  // refs so the callback stays stable (deps []). Labels snap to other labels and
  // to their own marker only — never to other markers/swatches.
  const snapLabel = useCallback((id: string, x: number, y: number) => {
    const layout = canvasLayoutRef.current
    const current = pointsRef.current
    const dragged = current.find((p) => p.id === id)
    if (!layout || !dragged) return { x, y, guides: [] as SnapGuide[] }
    const width = measureLabelWidth(dragged.label.text, dragged.label.fontSize, dragged.label.fontFamily)
    const height = dragged.label.fontSize
    const others: LabelBox[] = current
      .filter(
        (p) =>
          p.id !== id &&
          p.swatchOrder !== null &&
          p.label.visible &&
          p.label.text !== ""
      )
      .map((p) => ({
        x: p.label.x,
        y: p.label.y,
        width: measureLabelWidth(p.label.text, p.label.fontSize, p.label.fontFamily),
        height: p.label.fontSize,
      }))
    const marker = { x: dragged.x, y: dragged.y + layout.imageOffsetY }
    return computeLabelSnap({
      box: { x, y, width, height },
      others,
      marker,
      threshold: SNAP_SCREEN_PX / (scaleRef.current || 1),
    })
  }, [])

  const handleLabelDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const snapped = snapLabel(id, x, y)
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, label: { ...p.label, x: snapped.x, y: snapped.y } } : p))
      )
      setSnapGuides(snapped.guides)
    },
    [snapLabel]
  )

  const handleLabelDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const snapped = snapLabel(id, x, y)
      setPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, label: { ...p.label, x: snapped.x, y: snapped.y } } : p))
      )
      setSnapGuides([])
    },
    [snapLabel]
  )
```

Note: `SnapGuide` is already imported at `index.tsx:10`. Delete the old `handleUpdateLabelPos` (`:604-607`).

- [ ] **Step 3: Update the Canvas props in `index.tsx`**

In the `<Canvas .../>` block (`:824-853`), change:
- `onUpdateLabelPos={handleUpdateLabelPos}` → `onUpdateLabelPos={handleLabelDragMove}`
- add `onLabelDragEnd={handleLabelDragEnd}`
- add `onSelectPoint` is already passed (`:849`); it is also needed by the overlay — Canvas already receives `onSelectPoint`, so no editor change beyond confirming it's forwarded (Step 4).

- [ ] **Step 4: Thread props through `Canvas.tsx`**

Add to `CanvasProps` (`:44-45` area): `onLabelDragEnd: (id: string, x: number, y: number) => void`. Destructure it. In the `<LabelEditOverlay .../>` render (`:181-190`), pass:

```typescript
      <LabelEditOverlay
        points={points}
        canvasWidth={canvasLayout.canvasWidth}
        canvasHeight={canvasLayout.canvasHeight}
        scale={scale}
        onUpdateLabelText={onUpdateLabelText}
        onUpdateLabelPos={onUpdateLabelPos}
        onLabelDragEnd={onLabelDragEnd}
        onSelectPoint={onSelectPoint}
      />
```

- [ ] **Step 5: Update `Canvas.test.tsx`**

Read the file. Add `onLabelDragEnd: vi.fn()` (and confirm `onSelectPoint`, `onUpdateLabelPos` present) to the props factory / any inline `<Canvas .../>` render so the new required prop is supplied. If the test does not assert on these, just supply the mock.

- [ ] **Step 6: Run the full editor-related suite + typecheck**

Run: `npx vitest run components/Editor/ lib/label-snap.test.ts lib/label-layout.test.ts lib/measure-text.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add components/Editor/index.tsx components/Editor/Canvas.tsx components/Editor/Canvas.test.tsx components/Editor/LabelEditOverlay.tsx components/Editor/LabelEditOverlay.test.tsx
git commit -m "feat: CAD-style label snapping on drag with reused alignment guides"
```

---

### Task 8: Full-suite verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all green. Fix any regression (likely other files that render `Canvas`/`LabelEditOverlay` and now need the new props).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`, upload an image, click **Edit labels**. Verify:
- Empty labels present a wide (~10ch) click target.
- Clicking a label (its text/input) opens the right-side Label panel.
- Changing font/size/color updates ALL labels; text + show/hide stay per-label.
- Default label sits centered/aligned to its swatch, fully on-canvas.
- The drag grip sits on the label's vertical center-line, just left of the text.
- Dragging a label shows alignment guide lines when its edges/center align with another label's edges/center, or with its own marker (vertical, horizontal, begin/end/center).

- [ ] **Step 4: Final commit if any fixups**

```bash
git add -A && git commit -m "test: fix up label-improvement regressions across suite"
```

---

## Self-Review

**Spec coverage:**
- 1a wider empty label → Task 6 (10ch). ✓
- 1b panel opens on label click → Task 6 (`onSelectPoint` on focus). ✓
- 1c apply-to-all default + remove buttons → Task 5. ✓
- 2a grip aligned with label → Task 6 (centered grip). ✓
- 2b default positioning (box clamp, centered origin) → Task 3 + measurement wiring Task 4. ✓
- 3 label drag snapping (edges/center/marker, guides, reuse layer) → Tasks 2 + 7. ✓
- Testing section → tests in Tasks 1–7; full suite Task 8. ✓
- Non-goals (no distribution cue, no snap to other nodes, text/visibility per-label) → honored in Task 2 (targets exclude markers except own) + Task 5 (branching). ✓

**Placeholder scan:** No TBD/TODO. One instruction-only step is Task 4 Step 2 (test-value recompute) — unavoidable since it depends on reading the current literals, but the exact formula to compute each value is given. Task 5/7 reference "read the file first" for `Canvas.test.tsx`/`apiPointsToEyedroppers.test.ts` — necessary because those files weren't fully quoted; the required change (add mock prop / recompute literal) is explicit.

**Type consistency:** `computeLabelSnap` / `LabelBox` names match between Task 2 and Task 7. `getLabelPosition` new arity (8 args) matches between Task 3 and Task 4. `measureLabelWidth(text, fontSize, fontFamily)` signature matches across Tasks 1, 4, 7. `onSelectPoint`/`onLabelDragEnd` prop names match between overlay (Task 6/7), Canvas, and editor (Task 7). `SnapGuide` reused from `swatch-layout.ts` throughout.
