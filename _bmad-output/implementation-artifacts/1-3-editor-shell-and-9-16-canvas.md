# Story 1.3: Editor Shell & 9:16 Canvas

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want to see my uploaded image displayed inside a 9:16 canvas within a three-panel editor layout,
so that I can see the exact export frame before annotating.

## Acceptance Criteria

1. **Given** I navigate to `/editor?id=<uuid>`, **when** the page loads, **then** I see the three-panel layout: left sidebar (~200px), center canvas (flex-1), right sidebar (~280px), all filling full viewport height with no page scrolling.

2. **Given** the editor renders, **when** the canvas dimensions are measured, **then** the canvas is 9:16 ratio: `width = min(viewport_width − sidebars, viewport_height × 9/16)`, centered horizontally and vertically.

3. **Given** the editor loads the image, **when** the image is displayed, **then** it is padded to fill the 9:16 frame using the background color detected from the image's border pixels (`canvas-to-916.ts`); the original image pixels are never cropped, color-adjusted, or resized.

4. **Given** all UI chrome is rendered, **when** colors are inspected, **then** they use the design tokens: background `#fafaf9`, sidebar bg `#f4f3f1`, borders `#e8e5e0`, primary text `#1a1a1a`, secondary text `#6b6b6b`, accent `#c4956a`.

5. **Given** the right sidebar renders with no point selected, **when** its contents are checked, **then** only the Export section is visible with a "Download 9:16 JPEG" button (non-functional placeholder in this story).

6. **Given** the left sidebar renders, **when** its contents are checked, **then** placeholder sections for Suggest, Tools, Style, and Labels are visible as stubs.

7. **Given** the screen width is <1024px on the editor page, **when** the page loads, **then** I see an "Open on desktop" message.

## Tasks / Subtasks

- [x] Task 1: Implement real `canvasTo916` logic and update tests (AC: 3)
  - [x] Replace the stub body in `lib/canvas-to-916.ts`: `canvasWidth = imageWidth`, `canvasHeight = Math.round(imageWidth * 16 / 9)`, `imageOffsetY = imageHeight < canvasHeight ? Math.round((canvasHeight - imageHeight) / 2) : 0`
  - [x] Replace `lib/canvas-to-916.test.ts` stub tests with tests for the real implementation (canvasWidth = imageWidth, canvasHeight = imageWidth*16/9, centered imageOffsetY for portrait-fit images, imageOffsetY=0 when image fills or exceeds canvas height)

- [x] Task 2: Add `/api/image` route to serve the uploaded image (no direct AC but required by Canvas.tsx)
  - [x] Create `app/api/image/route.ts` as a GET handler: reads `?id=<uuid>`, validates UUID format (regex `/^[0-9a-f-]{36}$/` to prevent path traversal), reads `/tmp/<uuid>/original.jpg` with `fs.readFileSync`, returns as `image/jpeg` with `Cache-Control: max-age=3600`; returns 404 if id is missing/invalid or file not found

- [x] Task 3: Implement `components/Editor/Canvas.tsx` (AC: 2, 3)
  - [x] "use client" component; accepts props: `imageId: string`, `canvasLayout: CanvasLayout`, `bgColor: string`, `displayWidth: number`, `displayHeight: number`
  - [x] Load image with `useEffect` + `new window.Image()` with `crossOrigin="anonymous"` pointing at `/api/image?id=${imageId}`; store in `useState<HTMLImageElement | null>(null)`; render nothing until loaded
  - [x] Compute `scale = displayWidth / canvasLayout.canvasWidth` (maps logical 9:16 canvas to viewport display size)
  - [x] Render a Konva `<Stage width={displayWidth} height={displayHeight} scaleX={scale} scaleY={scale}>`
  - [x] Inside a `<Layer>`: first a `<Rect>` filling the full logical canvas (`x=0 y=0 width=canvasWidth height=canvasHeight fill={bgColor}`) for the padding area, then a `<KonvaImage image={img} x={0} y={canvasLayout.imageOffsetY} width={canvasLayout.canvasWidth} height={canvasLayout.imageHeight}` — **note: `KonvaImage` needs `imageHeight` as a prop passed in**; this ensures the image is never re-scaled, just positioned

- [x] Task 4: Implement `components/Editor/index.tsx` — three-panel editor shell (AC: 1, 4, 6, 7)
  - [x] "use client" component; accepts `imageId: string` as prop
  - [x] Mobile guard: `useState<boolean | null>(null)` + `useEffect(() => setIsMobile(window.innerWidth < 1024), [])` + `if (isMobile === null) return null` + `if (isMobile) return <div>…"Open on desktop"…</div>` — same pattern as `components/Upload.tsx`
  - [x] Image loading state: load image via `new window.Image()` at mount; once loaded, extract `naturalWidth` and `naturalHeight`; run `canvasTo916(naturalWidth, naturalHeight)` to get `canvasLayout`
  - [x] Background color detection: once image loads, use `detectBorderColor(img)` (helper defined in this file): create an off-screen `document.createElement("canvas")`, draw image into it at 1× scale, sample ~20 pixels from each of the 4 edges (top row, bottom row, left column, right column) with a stride of `Math.floor(Math.min(w,h)/20)`, average all sampled R/G/B values, return `#rrggbb` hex string
  - [x] Display size computation: `useState<{width:number; height:number} | null>(null)` initialized null; computed in `useEffect` and on `resize` listener as `width = Math.max(1, Math.min(window.innerWidth - 480, window.innerHeight * (9/16)))`, `height = Math.round(width * 16/9)` (480 = 200px left + 280px right sidebar); return null while null
  - [x] Layout: `<div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">` containing three children:
    - Left sidebar: `<aside style={{width:200}} className="bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex flex-col p-4 gap-6">` with four stub sections: "Suggest", "Tools", "Style", "Labels" — each a `<section>` with a small heading in `text-[var(--color-text-secondary)]` and placeholder text
    - Center: `<main className="flex flex-1 items-center justify-center bg-[var(--color-bg)]">` containing `<Canvas>` (once image + displaySize loaded, otherwise a loading placeholder)
    - Right sidebar: `<aside style={{width:280}} className="bg-[var(--color-sidebar)] border-l border-[var(--color-border)] flex flex-col p-4">` with Export section heading + `<ExportButton />`

- [x] Task 5: Replace `app/editor/page.tsx` stub with real editor page (AC: 1)
  - [x] Server component (no "use client"); reads `searchParams: Promise<{id?: string}>` (Next.js 15 App Router — `searchParams` is a Promise)
  - [x] `await searchParams` to get `id`; if missing, render an error message; otherwise render `<EditorShell imageId={id} />`

- [x] Task 6: Replace `components/ExportButton.tsx` stub with visible non-functional button (AC: 5)
  - [x] Render a styled button: `<button disabled className="w-full py-2 px-4 rounded bg-[var(--color-accent)] text-white text-sm opacity-60 cursor-not-allowed">Download 9:16 JPEG</button>`; `disabled` and `opacity-60` signal it's a placeholder; no onClick logic in this story

- [x] Task 7: Write tests (AC: all)
  - [x] `lib/canvas-to-916.test.ts` — replace all 4 stub tests with: canvasWidth=imageWidth, canvasHeight=round(imageWidth*16/9), imageOffsetY centers image vertically when shorter than canvas height, imageOffsetY=0 when imageHeight equals canvasHeight, imageOffsetY=0 when imageHeight exceeds canvasHeight
  - [x] `app/api/image/route.test.ts` — happy path: returns 200 with image/jpeg header; missing id: returns 404; invalid id (path traversal attempt like `../etc`): returns 404; file not found: returns 404 — mock `fs` with `vi.mock("fs")`
  - [x] `components/Editor/Canvas.test.tsx` — renders null before image loads; renders Konva Stage with correct width/height once image loads (mock `window.Image` and call onload)
  - [x] Run `npm test` from `eyedropper-web/` — all tests pass, no regressions

## Dev Notes

### Files to REPLACE (not create)

| File | Current state | This story |
|------|---------------|------------|
| `app/editor/page.tsx` | stub: `<div>Editor</div>` | Replace with real Next.js 15 server component reading searchParams |
| `lib/canvas-to-916.ts` | stub: always returns imageOffsetY=0 | Replace body with real centring calculation |
| `lib/canvas-to-916.test.ts` | tests stub behavior (imageOffsetY=0) | Replace all tests — stub tests will FAIL against real implementation |
| `components/ExportButton.tsx` | stub (76B): likely `<div>Export</div>` | Replace with visible non-functional button |

### Files to CREATE (NEW)

| File | Purpose |
|------|---------|
| `app/api/image/route.ts` | Serves `/tmp/<uuid>/original.jpg` — required by Canvas.tsx to load the image |
| `components/Editor/index.tsx` | Client component — editor shell, panels, image loading, bg color detection |
| `components/Editor/Canvas.tsx` | Client component — Konva stage, image display, 9:16 padding |
| `app/api/image/route.test.ts` | Tests for image serving route |
| `components/Editor/Canvas.test.tsx` | Tests for Canvas component |

### Files NOT to touch

- `app/page.tsx` — done in Story 1.2
- `app/layout.tsx` — do NOT modify (has Geist fonts setup)
- `app/globals.css` — do NOT modify (has all CSS variables)
- `lib/types.ts` — do NOT modify (has all TypeScript interfaces)
- `lib/styles.ts` — do NOT modify
- `lib/color-sample.ts` — stub, implementation deferred to Story 2.3
- `lib/swatch-layout.ts` — stub, implementation deferred to Story 2.3
- `components/Upload.tsx` — done in Story 1.2
- `components/LabelPanel.tsx` — stub, implementation deferred to Story 3.3
- `components/StylePicker.tsx` — stub, implementation deferred to Story 3.1
- `components/Editor/` subdirectory files beyond what's listed above

### Working Directory

All file paths are relative to `eyedropper-web/` — the Next.js project root at `/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`.

### `canvasTo916` Real Implementation

The current stub always returns `imageOffsetY = 0`. The real logic:

```typescript
export function canvasTo916(imageWidth: number, imageHeight: number): CanvasLayout {
  const canvasWidth = imageWidth
  const canvasHeight = Math.round(imageWidth * 16 / 9)
  const imageOffsetY = imageHeight < canvasHeight
    ? Math.round((canvasHeight - imageHeight) / 2)
    : 0
  return { canvasWidth, canvasHeight, imageOffsetY }
}
```

- `canvasWidth` stays equal to `imageWidth` — the export canvas is exactly as wide as the original image
- `canvasHeight` is always `imageWidth * 16/9` — enforces the 9:16 ratio
- `imageOffsetY` centers the image vertically within the canvas. For very tall images where `imageHeight >= canvasHeight`, `imageOffsetY = 0` (image starts at top, may extend beyond canvas bounds — acceptable for v1)

**CRITICAL**: The existing test `"returns imageOffsetY of 0 (stub)"` tests the STUB behavior and will FAIL against the real implementation for any image shorter than 9:16. Replace the entire test file.

### New `/api/image` Route (not in original architecture list)

The architecture lists only `/api/upload`, `/api/suggest`, `/api/export`. However, the Konva canvas must load the image via a URL. There is no other way to serve a file from `/tmp`. Add this minimal GET route:

```typescript
// app/api/image/route.ts
import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const filePath = path.join("/tmp", id, "original.jpg")
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=3600",
    },
  })
}
```

The UUID regex prevents path traversal: only lowercase hex digits and hyphens, exactly 36 chars.

### Konva Image Loading (no `use-image` package)

`use-image` is NOT in `package.json`. Do not install it. Load images manually:

```typescript
const [img, setImg] = useState<HTMLImageElement | null>(null)

useEffect(() => {
  const image = new window.Image()
  image.crossOrigin = "anonymous"
  image.onload = () => setImg(image)
  image.onerror = () => console.error("Failed to load image")
  image.src = `/api/image?id=${imageId}`
  return () => { image.onload = null; image.onerror = null }
}, [imageId])
```

Then pass `img` to `<KonvaImage image={img ?? undefined} />`.

### Display Size vs Logical Canvas Size

Two separate size concepts — don't confuse them:

| Name | What it is | How computed |
|------|-----------|--------------|
| **Logical canvas** (`canvasWidth` × `canvasHeight`) | Export canvas dimensions = image dimensions at 9:16 ratio | `canvasTo916(imageWidth, imageHeight)` |
| **Display size** (`displayWidth` × `displayHeight`) | The Konva `<Stage>` size in viewport pixels | `displayWidth = min(viewportW - 480, viewportH * 9/16)`, `displayHeight = displayWidth * 16/9` |
| **Scale** | Maps logical → display | `scale = displayWidth / canvasWidth` |

The Konva `<Stage>` is sized at `displayWidth × displayHeight`. The stage's `scaleX={scale}` and `scaleY={scale}` scale all content drawn in logical canvas coordinates to the display size. All Konva coordinates (image position, future marker/swatch positions) are in **logical canvas coordinates**, not viewport pixels.

```tsx
const scale = displayWidth / canvasLayout.canvasWidth

<Stage
  width={displayWidth}
  height={displayHeight}
  scaleX={scale}
  scaleY={scale}
>
  <Layer>
    {/* Background fill (padding areas around the image) */}
    <Rect
      x={0} y={0}
      width={canvasLayout.canvasWidth}
      height={canvasLayout.canvasHeight}
      fill={bgColor}
    />
    {/* Original image, never modified */}
    {img && (
      <KonvaImage
        image={img}
        x={0}
        y={canvasLayout.imageOffsetY}
        width={canvasLayout.canvasWidth}
        height={imageHeight}  // the image's natural height, passed as prop
      />
    )}
  </Layer>
</Stage>
```

### Background Color Detection from Border Pixels

This is required by AC3. Pure client-side — does NOT require `canvas-to-916.ts` changes (that function is pure math). Implement as a helper in `components/Editor/index.tsx`:

```typescript
function detectBorderColor(img: HTMLImageElement): string {
  const offscreen = document.createElement("canvas")
  offscreen.width = img.naturalWidth
  offscreen.height = img.naturalHeight
  const ctx = offscreen.getContext("2d")!
  ctx.drawImage(img, 0, 0)

  const w = img.naturalWidth
  const h = img.naturalHeight
  const stride = Math.max(1, Math.floor(Math.min(w, h) / 20))
  const samples: [number, number, number][] = []

  for (let x = 0; x < w; x += stride) {
    const top = ctx.getImageData(x, 0, 1, 1).data
    const bot = ctx.getImageData(x, h - 1, 1, 1).data
    samples.push([top[0], top[1], top[2]], [bot[0], bot[1], bot[2]])
  }
  for (let y = 0; y < h; y += stride) {
    const left = ctx.getImageData(0, y, 1, 1).data
    const right = ctx.getImageData(w - 1, y, 1, 1).data
    samples.push([left[0], left[1], left[2]], [right[0], right[1], right[2]])
  }

  const [r, g, b] = samples
    .reduce(([ar, ag, ab], [sr, sg, sb]) => [ar + sr, ag + sg, ab + sb], [0, 0, 0])
    .map((v) => Math.round(v / samples.length))

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}
```

Call this after the image loads: `setBgColor(detectBorderColor(image))`.

### SSR/Hydration Rules (from project-context.md)

All browser-only state (`window.*`) must be initialized as `null` and set via `useEffect`:

```typescript
// Pattern: initialize null → useEffect sets → render null while null
const [isMobile, setIsMobile] = useState<boolean | null>(null)
useEffect(() => { setIsMobile(window.innerWidth < 1024) }, [])
if (isMobile === null) return null  // avoid SSR/hydration mismatch

const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)
useEffect(() => {
  const compute = () => {
    const w = Math.max(1, Math.min(window.innerWidth - 480, window.innerHeight * (9 / 16)))
    setDisplaySize({ width: Math.round(w), height: Math.round(w * 16 / 9) })
  }
  compute()
  window.addEventListener("resize", compute)
  return () => window.removeEventListener("resize", compute)
}, [])
```

### `app/editor/page.tsx` — Next.js 15 `searchParams` is a Promise

In Next.js 15 App Router, `searchParams` for server pages is a **Promise** (async API). Failure to await it will cause runtime errors:

```typescript
// CORRECT (Next.js 15):
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No image ID provided. <a href="/">Go back</a></p>
      </div>
    )
  }
  return <EditorShell imageId={id} />
}
```

`EditorShell` is imported from `@/components/Editor` (resolves to `components/Editor/index.tsx`).

### Tailwind v4 CSS Variable Syntax

As established in Story 1.1 and 1.2: Tailwind v4 uses `@import "tailwindcss"` — no `tailwind.config.ts`. Reference CSS variables as arbitrary values:

```
bg-[var(--color-bg)]        ← not bg-color-bg
bg-[var(--color-sidebar)]
border-[var(--color-border)]
text-[var(--color-text-primary)]
text-[var(--color-text-secondary)]
bg-[var(--color-accent)]
```

### Mobile Guard in Editor

Same pattern as `components/Upload.tsx` (from Story 1.2):

```typescript
const [isMobile, setIsMobile] = useState<boolean | null>(null)
useEffect(() => { setIsMobile(window.innerWidth < 1024) }, [])
if (isMobile === null) return null
if (isMobile) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <p className="text-[var(--color-text-secondary)] text-center px-8">
        Please open this app on a desktop (1024px+).
      </p>
    </div>
  )
}
```

### Left Sidebar Stub Sections

Each section is a stub — no real functionality in this story. Use consistent section heading style:

```tsx
<section>
  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
    Suggest
  </h3>
  <p className="text-xs text-[var(--color-text-secondary)]">Coming soon</p>
</section>
```

Repeat for Tools, Style, Labels. These are replaced in Epics 2 and 3.

### Component Tree for This Story

```
app/editor/page.tsx (server, async)
  └─ components/Editor/index.tsx (client — "use client")
       ├─ [mobile guard]
       ├─ aside.left (200px sidebar)
       │    ├─ section "Suggest" (stub)
       │    ├─ section "Tools" (stub)
       │    ├─ section "Style" (stub)
       │    └─ section "Labels" (stub)
       ├─ main.center (flex-1)
       │    └─ components/Editor/Canvas.tsx (client — "use client")
       │         └─ react-konva: Stage > Layer > Rect (bg) + KonvaImage
       └─ aside.right (280px sidebar)
            └─ section "Export"
                 └─ components/ExportButton.tsx (replaced stub)
```

### Dependencies Available

All needed deps are already installed — do NOT add new packages:

| Package | Use |
|---------|-----|
| `react-konva@^19.2.5` | `Stage`, `Layer`, `Rect` |
| `konva@^10.3.0` | `KonvaImage` (accessed as `Image` from `react-konva`) |
| `next@15.5.19` | App Router, server components, API routes |
| `fs`, `path` (Node builtins) | `/api/image` route |

Do NOT install `use-image` — load images manually with `new window.Image()` as shown above.

### What NOT to implement in this story

- Do NOT implement the actual export logic in ExportButton — it's a disabled placeholder
- Do NOT implement any eyedropper markers, swatches, or connector lines (Story 2.3)
- Do NOT implement the SLIC or Claude suggest buttons (Story 2.1, 2.2)
- Do NOT implement the style thumbnail picker (Story 3.1)
- Do NOT implement label editing (Story 3.2+)
- Do NOT implement drag/select interactions on the canvas (Story 2.4+)
- Do NOT implement `color-sample.ts` or `swatch-layout.ts` (Story 2.3)
- Do NOT add a hidden sampling `<canvas>` element (Story 2.3 — it's for live color re-sampling during drags, not for the initial border color detection which uses a temporary off-screen canvas)

### Previous Story Learnings (from Story 1.2)

- Tailwind v4 requires `bg-[var(--color-*)]` syntax — NOT `bg-color-*` or inline `style={{ background: "var(...)" }}`
- `app/layout.tsx` uses Geist fonts; never modify it
- `npm run build` with `--turbopack` flag must still pass after this story
- Mobile guard uses `useState(null)` + `useEffect` pattern — return null while unknown, not a loading spinner
- API routes in `app/api/*/route.ts` — each is a separate Next.js route handler file

### References

- [Source: docs/ARCHITECTURE.md#Project structure] — file layout for `components/Editor/`, `app/editor/page.tsx`, `app/api/`
- [Source: docs/ARCHITECTURE.md#State shape] — `EditorState` interface, `canvasWidth = imageWidth`, `imageOffsetY` meaning
- [Source: docs/UI.md#Editor Page] — three-panel layout diagram, sidebar widths (~200px left, ~280px right), canvas ratio formula
- [Source: docs/UI.md#Color palette] — design token values (#fafaf9, #f4f3f1, etc.)
- [Source: docs/SPEC.md#FR9, FR27] — 9:16 canvas, border-pixel background color
- [Source: epics.md#Story 1.3] — AC definitions, "placeholder stubs" scope for Suggest/Tools/Style/Labels
- [Source: docs/project-context.md#Hydration rules] — null-init pattern for window-dependent state
- [Source: docs/project-context.md#Testing Standards] — Vitest + RTL, co-located test files, `npm test` from `eyedropper-web/`

## Review Findings

- [x] [Review][Decision→Patch] Double image load with divergent error states — FIXED via option (a): the image is now loaded **once** in `EditorShell` and the decoded `HTMLImageElement` is passed down to `Canvas` as an `image` prop (Canvas no longer self-fetches). Eliminates the redundant network fetch + decode and unifies the load path. Also added a `loadError` state so a failed `/api/image` load renders a clear "Couldn't load this image…" message with an Upload-another link, instead of a permanent "Loading…" / blank pane [components/Editor/index.tsx, components/Editor/Canvas.tsx]
- [x] [Review][Patch] Test coverage gaps — FIXED: `route.test.ts` now asserts the 200 body equals the `readFileSync` buffer and that readFileSync is called with the joined `/tmp/<id>/original.jpg` path; `Canvas.test.tsx` rewritten for the prop-driven component — asserts the `scale` (displayWidth/canvasWidth) and the KonvaImage `x`/`y`/`width`/`height` positioning props [app/api/image/route.test.ts, components/Editor/Canvas.test.tsx]
- [x] [Review][Patch] Stale test count — FIXED: corrected Dev Agent Record + Change Log [1-3-editor-shell-and-9-16-canvas.md]
- [x] [Review][Defer] `detectBorderColor` per-pixel `getImageData` [components/Editor/index.tsx:23-34] — deferred, perf smell (~80-160 GPU readbacks); batch into one full/edge-strip readback
- [x] [Review][Defer] `/api/image` sync `existsSync`+`readFileSync` (event-loop block + TOCTOU 500 if /tmp cleaned between calls) [app/api/image/route.ts] — deferred, low-traffic ephemeral tool
- [x] [Review][Defer] `Cache-Control: max-age=3600` on files deleted after ~1h [app/api/image/route.ts:18] — deferred, stale-cache semantic mismatch, low impact (UUIDs never reused)

_Dismissed as noise: tall-image overflow (spec-sanctioned "acceptable for v1", Dev Notes:127), loose UUID regex (path traversal impossible — charset excludes `/`,`.`,`\`), `crossOrigin="anonymous"` on same-origin (no taint), AC3's parenthetical "(canvas-to-916.ts)" attribution for border detection (AC-text inaccuracy; impl in index.tsx is correct per SPEC.md), ≤1px fractional-scale stage/content mismatch (cosmetic)._

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (eu.anthropic.claude-sonnet-4-6) — story creation pass

### Debug Log References

- `vi.spyOn(window, "Image")` doesn't work for class constructors in jsdom — switched to `vi.stubGlobal("Image", function MockImage() {...})` pattern in Canvas.test.tsx
- All tests pass, 0 regressions. `npm run build` passes with 0 TypeScript errors. (Suite was 36 at story-creation time; full repo suite is now 49 after Story 0.1's harness retrofit and the 2026-06-14 code-review patches.)

### Completion Notes List

- Replaced `lib/canvas-to-916.ts` stub with real centring logic: `imageOffsetY = round((canvasHeight - imageHeight) / 2)` when image shorter than 9:16 height, else 0
- Replaced `lib/canvas-to-916.test.ts` (6 tests covering all branches of the real implementation)
- Created `app/api/image/route.ts` — GET handler serving `/tmp/<uuid>/original.jpg` with UUID regex validation to prevent path traversal; 6 tests
- Created `components/Editor/Canvas.tsx` — Konva Stage with logical→display scaling, bg Rect + KonvaImage, manual image loading via `new window.Image()`; 4 tests
- Created `components/Editor/index.tsx` — three-panel shell with null-init mobile guard, display size computation with resize listener, border color detection via off-screen canvas, image loading triggering `canvasTo916`
- Replaced `app/editor/page.tsx` — async server component, `await searchParams` (Next.js 15 Promise API), renders `<EditorShell>` or error message if no id
- Replaced `components/ExportButton.tsx` — visible disabled "Download 9:16 JPEG" button (placeholder for Story 4.1)

### File List

- eyedropper-web/lib/canvas-to-916.ts (updated — real centring logic)
- eyedropper-web/lib/canvas-to-916.test.ts (replaced — 6 tests for real implementation)
- eyedropper-web/app/api/image/route.ts (new — GET handler serving /tmp/<uuid>/original.jpg)
- eyedropper-web/app/api/image/route.test.ts (new — 6 tests, mocks fs)
- eyedropper-web/app/editor/page.tsx (replaced — async server component with Next.js 15 searchParams)
- eyedropper-web/components/Editor/index.tsx (replaced — three-panel shell, mobile guard, border color detection)
- eyedropper-web/components/Editor/Canvas.tsx (replaced — Konva Stage with scale, bg Rect + KonvaImage)
- eyedropper-web/components/Editor/Canvas.test.tsx (new — 4 tests, vi.stubGlobal Image mock)
- eyedropper-web/components/ExportButton.tsx (replaced — disabled placeholder button)

## Change Log

- 2026-06-14: Story 1.3 implemented — editor shell, 9:16 Konva canvas, border color detection, /api/image route. Build clean.
- 2026-06-14: Code review — refactored to load the image once in EditorShell and pass it to Canvas (removed double fetch/decode), added image-load error UI, expanded Canvas/route tests, corrected stale test counts. Full suite 49/49 green, tsc clean.
