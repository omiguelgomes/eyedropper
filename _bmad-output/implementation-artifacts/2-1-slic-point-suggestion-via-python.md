# Story 2.1: SLIC Point Suggestion via Python

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want the editor to automatically suggest ~12 color points from my image on load using SLIC,
So that I have a useful starting palette without any manual work.

## Acceptance Criteria

1. **Given** I arrive at `/editor?id=<uuid>`, **when** the editor finishes loading, **then** `/api/suggest` is called automatically with `{ id, method: "slic" }`.

2. **Given** `/api/suggest` is called with `method: "slic"`, **when** the server handles the request, **then** it spawns `python3 scripts/slic_suggest.py /tmp/<uuid>/original.jpg` via `child_process.spawn` and returns `{ points: [{ x, y, color }] }` where `color` is a hex string.

3. **Given** the SLIC script runs, **when** it returns results, **then** it returns approximately 12 points representing color-diverse subject areas, with background-like colors filtered out.

4. **Given** SLIC returns points, **when** the client receives them, **then** eyedropper point nodes are placed on the canvas at the returned coordinates with the returned colors (as simple colored circles — full marker/swatch/connector rendering is Story 2.3).

5. **Given** the left sidebar "Suggest" section is rendered, **when** SLIC is running, **then** the "SLIC (auto)" button shows a loading state; when complete, it returns to its default state.

## Tasks / Subtasks

- [x] Task 1: Implement `/api/suggest` route (AC: 2)
  - [x] Replace the stub `app/api/suggest/route.ts` with a real POST handler
  - [x] Parse body `{ id, method }` — validate UUID format with `/^[0-9a-f-]{36}$/`
  - [x] For `method: "slic"`: spawn `python3` with args `[path.join(process.cwd(), "scripts", "slic_suggest.py"), imagePath]` using `child_process.spawn`
  - [x] Collect stdout chunks, reject on stderr+non-zero exit or spawn error
  - [x] Parse stdout as JSON, return `NextResponse.json({ points })` on success
  - [x] Return HTTP 400 for invalid `id`, HTTP 500 if spawn fails or output is invalid JSON
  - [x] For `method: "claude"`: return HTTP 501 (not implemented yet — Story 2.2)

- [x] Task 2: Add points state and auto-suggest to `EditorShell` (AC: 1, 4, 5)
  - [x] In `components/Editor/index.tsx`: add `useState<EyedropperPoint[]>([])` for points and `useState<boolean>(false)` for `isSuggestingLoading`
  - [x] Add a `useEffect(() => { autoSuggest() }, [imageId])` that fires once on mount: POST to `/api/suggest` with `{ id: imageId, method: "slic" }`, set `isSuggestingLoading` during fetch, parse response and build `EyedropperPoint[]` from returned `{ x, y, color }` items (see Dev Notes for construction details), then set points state
  - [x] Replace the left sidebar "Suggest" stub section with a real `<button>` labeled "SLIC (auto)" that shows "Suggesting…" when `isSuggestingLoading` is true and re-triggers the suggest fetch when clicked
  - [x] Pass `points` and `canvasLayout` down to `<Canvas>` as new props

- [x] Task 3: Thread points through `Canvas.tsx` to `EyedropperLayer` (AC: 4)
  - [x] Add `points: EyedropperPoint[]` to `CanvasProps` in `components/Editor/Canvas.tsx`
  - [x] Import `EyedropperLayer` and render it as a second `<Layer>` inside the `<Stage>`, after the background layer: `<EyedropperLayer points={points} />`
  - [x] Do NOT add scale/offset props — the Stage already applies `scaleX={scale} scaleY={scale}`, so point coordinates (in logical image space) are automatically scaled

- [x] Task 4: Implement basic point rendering in `EyedropperLayer` (AC: 4)
  - [x] Replace the stub `components/Editor/EyedropperLayer.tsx` with a `<Layer>` rendering a `<Circle>` per point: `radius={8}`, `fill={point.color}`, `stroke="white"`, `strokeWidth={2}`, centered at `(point.x, point.y)` (logical canvas coordinates)
  - [x] Accept props: `points: EyedropperPoint[]`
  - [x] This is a **temporary visual** — Story 2.3 replaces it with ring markers + swatches + connectors

- [x] Task 5: Write tests (AC: all)
  - [x] `app/api/suggest/route.test.ts` — happy path: POST `{ id: "...", method: "slic" }` returns 200 with `{ points }` matching mock Python output; invalid UUID returns 400; spawn non-zero exit returns 500; spawn error event returns 500; `method: "claude"` returns 501 — mock `child_process` with `vi.mock("child_process")` (see Dev Notes for spawn mock pattern)
  - [x] `components/Editor/EyedropperLayer.test.tsx` — renders null `<Layer>` with empty points; renders a `<Circle>` per point with correct fill color
  - [x] Run `npm test` from `eyedropper-web/` — all tests pass, no regressions (current suite: 49 tests)

## Dev Notes

### Working Directory

All paths are relative to `eyedropper-web/` — the Next.js project root at `/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`.

### Files to REPLACE (not create from scratch)

| File | Current state | This story |
|------|---------------|------------|
| `app/api/suggest/route.ts` | Stub: `POST() { return NextResponse.json({ ok: true }) }` | Replace with real spawn handler |
| `components/Editor/index.tsx` | Stub "Suggest" section with "Coming soon" | Replace section; add points state + auto-suggest |
| `components/Editor/Canvas.tsx` | No points prop; no EyedropperLayer | Add `points` prop; render `<EyedropperLayer>` |
| `components/Editor/EyedropperLayer.tsx` | Stub: `return null` | Replace with `<Layer>` + `<Circle>` per point |

### Files NOT to touch

- `lib/types.ts` — do NOT modify (EyedropperPoint interface is already correct)
- `lib/color-sample.ts` — still a stub, implemented in Story 2.3
- `lib/swatch-layout.ts` — still a stub, implemented in Story 2.3
- `components/Editor/useEyedroppers.ts` — still a stub, fleshed out in Story 2.3+
- `app/layout.tsx`, `app/globals.css` — never touch these
- `components/Editor/LabelLayer.tsx` — stub, Story 3.x
- `scripts/slic_suggest.py` — already fully implemented, do NOT modify

### `/api/suggest` Route Implementation

```typescript
import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, method } = body

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  if (method === "claude") {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 })
  }

  if (method !== "slic") {
    return NextResponse.json({ error: "Unknown method" }, { status: 400 })
  }

  const imagePath = path.join("/tmp", id, "original.jpg")
  const scriptPath = path.join(process.cwd(), "scripts", "slic_suggest.py")

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("python3", [scriptPath, imagePath])

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve(NextResponse.json({ error: "SLIC failed", details: stderr }, { status: 500 }))
        return
      }
      try {
        const points = JSON.parse(stdout)
        resolve(NextResponse.json({ points }))
      } catch {
        resolve(NextResponse.json({ error: "Invalid SLIC output" }, { status: 500 }))
      }
    })

    proc.on("error", (err: Error) => {
      resolve(NextResponse.json({ error: "Spawn failed", details: err.message }, { status: 500 }))
    })
  })
}
```

### EyedropperPoint Construction from API Response

When the client receives `{ points: [{ x, y, color }] }` from `/api/suggest`, construct full `EyedropperPoint` objects:

```typescript
import type { EyedropperPoint } from "@/lib/types"

function apiPointsToEyedroppers(raw: { x: number; y: number; color: string }[]): EyedropperPoint[] {
  return raw.map((p, i) => ({
    id: `point-${i}-${Date.now()}`,  // simple ID — not crypto.randomUUID() (avoid hydration issues)
    x: p.x,
    y: p.y,
    color: p.color,
    swatchSide: "auto",
    swatchOrder: null,
    label: {
      text: "",
      visible: true,
      x: p.x,   // placeholder — Story 2.3 computes swatch positions
      y: p.y,
      fontSize: 16,
      fontFamily: "Cormorant Garamond Italic",
      color: "#1a1a1a",
    },
  }))
}
```

**Why not `crypto.randomUUID()`**: It's browser-only in this context and can cause SSR issues. A simple `point-${i}-${Date.now()}` is sufficient until Story 2.3 introduces drag interactions that require stable IDs.

### Auto-Suggest in EditorShell

Add a `useEffect` that fires once when `imageId` is available. The server-side SLIC runs on `/tmp/<uuid>/original.jpg` — this file was already saved by `/api/upload` before the redirect, so it is available immediately when the editor loads (no need to wait for the client-side image to load).

```typescript
// In EditorShell, add these state variables:
const [points, setPoints] = useState<EyedropperPoint[]>([])
const [isSuggestingLoading, setIsSuggestingLoading] = useState(false)

// Add this useEffect:
useEffect(() => {
  async function autoSuggest() {
    setIsSuggestingLoading(true)
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imageId, method: "slic" }),
      })
      if (res.ok) {
        const data = await res.json()
        setPoints(apiPointsToEyedroppers(data.points))
      }
    } finally {
      setIsSuggestingLoading(false)
    }
  }
  autoSuggest()
}, [imageId])
```

### Suggest Section in Left Sidebar

Replace the current "Suggest" stub section in `EditorShell`:

```tsx
<section>
  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
    Suggest
  </h3>
  <button
    onClick={() => { /* re-trigger autoSuggest — extract to named function */ }}
    disabled={isSuggestingLoading}
    className="w-full text-left text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white disabled:opacity-50 disabled:cursor-wait hover:border-[var(--color-accent)] transition-colors"
  >
    {isSuggestingLoading ? "Suggesting…" : "SLIC (auto)"}
  </button>
</section>
```

Extract the suggest fetch into a named `const runSuggest = async () => {...}` function that both `useEffect` and the button `onClick` call. Avoid duplicating the fetch logic.

### Canvas.tsx Update — Adding Points Prop

Current `Canvas.tsx` has these props: `image`, `canvasLayout`, `imageHeight`, `bgColor`, `displayWidth`, `displayHeight`.

Add `points: EyedropperPoint[]`. Then inside the `<Stage>`, after the existing `<Layer>` (background + image), add:

```tsx
import EyedropperLayer from "./EyedropperLayer"

// inside return:
<Stage ...>
  <Layer>
    {/* existing: Rect + KonvaImage */}
  </Layer>
  <EyedropperLayer points={points} />
</Stage>
```

**Do NOT pass `scale` to `EyedropperLayer`** — the Stage's `scaleX={scale}` already scales all child Layers. Point coordinates are in logical canvas space (same as image pixels), so they just work.

### EyedropperLayer.tsx (Story 2.1 version)

```tsx
import { Layer, Circle } from "react-konva"
import type { EyedropperPoint } from "@/lib/types"

interface Props {
  points: EyedropperPoint[]
}

export default function EyedropperLayer({ points }: Props) {
  return (
    <Layer>
      {points.map((p) => (
        <Circle
          key={p.id}
          x={p.x}
          y={p.y}
          radius={8}
          fill={p.color}
          stroke="white"
          strokeWidth={2}
        />
      ))}
    </Layer>
  )
}
```

This renders simple filled circles. Story 2.3 replaces this with ring markers + swatch circles + connector lines.

### Mocking `child_process.spawn` in Tests

Vitest requires mocking the module before tests run. The spawn mock must simulate the Node.js EventEmitter interface (stdout/stderr streams + close/error events):

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest"
import { EventEmitter } from "events"

vi.mock("child_process", () => ({ spawn: vi.fn() }))

function makeMockProc(stdoutData: string, exitCode: number) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  setImmediate(() => {
    if (stdoutData) proc.stdout.emit("data", Buffer.from(stdoutData))
    proc.emit("close", exitCode)
  })
  return proc
}

// In test:
import { spawn } from "child_process"
const mockSpawn = vi.mocked(spawn)

beforeEach(() => { vi.clearAllMocks() })

it("returns points on success", async () => {
  const mockPoints = [{ x: 100, y: 200, color: "#ff0000" }]
  mockSpawn.mockReturnValue(makeMockProc(JSON.stringify(mockPoints), 0) as any)

  const req = new Request("http://x/api/suggest", {
    method: "POST",
    body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
    headers: { "Content-Type": "application/json" },
  })
  const res = await POST(req as any)
  const json = await res.json()
  expect(res.status).toBe(200)
  expect(json.points).toEqual(mockPoints)
})
```

For the spawn error test, emit `"error"` instead of `"close"`:

```typescript
function makeMockProcError(message: string) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  setImmediate(() => { proc.emit("error", new Error(message)) })
  return proc
}
```

### `slic_suggest.py` is Already Implemented

The Python script at `scripts/slic_suggest.py` is **fully functional** — do NOT modify it. It:
- Uses SLIC superpixels (80 segments, compactness=10, sigma=1)
- Samples background color from the 10-pixel border
- Filters segments where `dist_from_bg < 28.0` or `size <= 200`
- Greedily selects ~12 maximally color-diverse non-background points
- Outputs JSON array of `[{ "x": int, "y": int, "color": "#rrggbb" }]` to stdout

AC 3 (background filtering, ~12 points) is satisfied by the existing Python script.

### Coordinate System

- SLIC returns `x, y` in **original image pixel coordinates**
- The logical canvas has `canvasWidth = imageWidth` and `canvasHeight = imageWidth * 16/9`
- Image is placed at `y = imageOffsetY` within the logical canvas
- But all markers are positioned relative to the image, so use `x, y` directly from SLIC — Konva's scale handles the rest
- **IMPORTANT**: `EyedropperPoint.x` and `.y` are **image coordinates**, not canvas coordinates. When Story 2.3 computes swatch positions, it adds `imageOffsetY` offset as needed.

### Tailwind v4 Reminder

Use `bg-[var(--color-*)]` syntax for all color classes. No `tailwind.config.ts` exists.

### Previous Story Learnings (from Story 1.3)

- `vi.stubGlobal("Image", ...)` pattern for mocking `window.Image` — not relevant here, but for context
- `vi.mock("fs")` for API route tests — apply same pattern for `vi.mock("child_process")`
- Tailwind v4: `bg-[var(--color-accent)]` not `bg-accent`
- `npm run build` must still pass after this story — no TS errors allowed
- Avoid `crypto.randomUUID()` in client components with SSR; use a simpler ID scheme

### Review Findings

_Code review 2026-06-14 — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 5 ACs verified satisfied. Coordinate-offset bug independently confirmed against `canvas-to-916.ts` + `slic_suggest.py`._

- [x] [Review][Patch] `data.points` passed to `.map` with no array guard — crashes render if route returns non-array points [components/Editor/index.tsx:120,47] — fixed: guard `Array.isArray(data.points)` before mapping; non-array → error state
- [x] [Review][Patch] `!res.ok` branch silently swallows errors — spinner stops, no feedback, points unchanged on 400/500/501 [components/Editor/index.tsx:118] — fixed: added `suggestError` state + inline "Couldn't suggest points. Try again." message
- [x] [Review][Patch] `runSuggest` has no `catch` — network/parse rejection becomes an unhandled promise rejection [components/Editor/index.tsx:110-125] — fixed: wrapped in try/catch → sets error state
- [x] [Review][Patch] No timeout/kill on spawned `python3` — a hung interpreter hangs the request forever and leaks the process [app/api/suggest/route.ts:24-53] — fixed: 30s `SLIC_TIMEOUT_MS` with `proc.kill("SIGKILL")` and single-settle guard
- [x] [Review][Patch] `await request.json()` unguarded — malformed/empty body throws an unstructured 500 instead of the intended 400 [app/api/suggest/route.ts:6] — fixed: try/catch around `request.json()` → 400 "Invalid request body"
- [x] [Review][Patch] Raw `stderr`/`err.message` returned to client — leaks server filesystem paths and internals [app/api/suggest/route.ts:39,51] — fixed: stderr/err logged server-side via `console.error`, no longer returned in the response body
- [x] [Review][Patch] Test coverage gaps for added error branches: `method !== "slic"` 400, "Invalid SLIC output" 500, and the `apiPointsToEyedroppers` pure helper are untested (project-context.md requires API error-handling + pure-fn branch coverage) [app/api/suggest/route.test.ts] — fixed: added unknown-method, malformed-body, and invalid-JSON route tests + new `apiPointsToEyedroppers.test.ts` (4 cases)
- [x] [Review][Patch] `Date.now()`-based point IDs collide if two suggest runs land in the same millisecond, and re-running suggest orphans any id-keyed downstream state [components/Editor/index.tsx:48] — fixed: monotonic module-level `pointIdCounter` instead of `Date.now()`

- [x] [Review][Defer] Suggested points render `imageOffsetY` px too high on padded images [components/Editor/EyedropperLayer.tsx:16, Canvas.tsx:42] — deferred to Story 2.3. Spec Dev Notes explicitly defer imageOffsetY handling to Story 2.3; markers are temporary placeholders until then.
- [x] [Review][Defer] Unbounded stdout/stderr buffering from child process (memory/DoS) [app/api/suggest/route.ts:30-35] — deferred, same class as the upload-size-cap item already scoped to story 4.2
- [x] [Review][Defer] UUID regex `/^[0-9a-f-]{36}$/` is over-permissive (accepts non-canonical UUIDs; traversal still blocked by charset) [app/api/suggest/route.ts:9] — deferred, pre-existing pattern also in app/api/image/route.ts:7; not introduced by this story
- [x] [Review][Defer] Empty SLIC result (`[]`) renders zero points with no "nothing detected" feedback [scripts/slic_suggest.py:51 → components/Editor/index.tsx:120] — deferred, UX polish; valid success path, no crash

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (eu.anthropic.claude-sonnet-4-6)

### Debug Log References

- `vi.mock("child_process", () => ({ spawn: vi.fn() }))` alone doesn't work in Vitest ESM — needs `vi.hoisted` to share the mock reference with `vi.mock` factory. Used `vi.hoisted(() => ({ mockSpawn: vi.fn() }))` + `vi.mock("child_process", () => ({ default: { spawn: mockSpawn }, spawn: mockSpawn }))`.
- Mock proc events must fire via `Promise.resolve().then(() => Promise.resolve()).then(...)` (double microtask delay) to ensure the route's `spawn()` call and listener attachment have completed before events fire. `setImmediate` and single `Promise.resolve().then()` weren't enough because `request.json()` consumes multiple microtask ticks.
- `vi.spyOn` on ESM module named exports throws "Cannot redefine property" — `vi.hoisted` + `vi.mock` factory is the correct pattern.
- `Canvas.test.tsx` needed `points: []` added to `makeProps` and `EyedropperLayer` mock added to avoid `undefined.map` error.

### Completion Notes List

- Replaced `app/api/suggest/route.ts` stub with real POST handler: UUID validation, `child_process.spawn` for SLIC, stdout/stderr collection, JSON parse, 501 for claude method
- Added `apiPointsToEyedroppers` helper and `points`/`isSuggestingLoading` state to `EditorShell`; `runSuggest` via `useCallback` called on mount via `useEffect` and on button click
- Replaced left sidebar "Suggest" stub with real "SLIC (auto)" button showing "Suggesting…" loading state
- Added `points: EyedropperPoint[]` prop to `Canvas.tsx`; renders `<EyedropperLayer points={points} />` as second Layer inside Stage
- Replaced `EyedropperLayer.tsx` stub with `<Layer>` rendering a `<Circle>` per point (temporary visual — Story 2.3 replaces with full marker/swatch/connector)
- Created `app/api/suggest/route.test.ts` (7 tests) and `components/Editor/EyedropperLayer.test.tsx` (3 tests)
- Updated `components/Editor/Canvas.test.tsx`: added `points: []` to makeProps and mocked EyedropperLayer
- Full suite: 59/59 tests pass, 0 regressions, tsc clean

### File List

- eyedropper-web/app/api/suggest/route.ts (replaced — real spawn handler)
- eyedropper-web/app/api/suggest/route.test.ts (new — 7 tests)
- eyedropper-web/components/Editor/index.tsx (updated — points state, runSuggest, SLIC button)
- eyedropper-web/components/Editor/Canvas.tsx (updated — points prop, EyedropperLayer)
- eyedropper-web/components/Editor/EyedropperLayer.tsx (replaced — Circle per point)
- eyedropper-web/components/Editor/EyedropperLayer.test.tsx (new — 3 tests)
- eyedropper-web/components/Editor/Canvas.test.tsx (updated — points prop + EyedropperLayer mock)

## Change Log

- 2026-06-14: Story 2.1 implemented — /api/suggest SLIC route, auto-suggest on editor load, SLIC button with loading state, EyedropperLayer with colored circle markers. 59/59 tests, tsc clean.
