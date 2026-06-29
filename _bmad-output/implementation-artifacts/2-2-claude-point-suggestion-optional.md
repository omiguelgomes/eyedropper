# Story 2.2: Claude Point Suggestion (Optional)

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want to optionally re-suggest points using Claude for richer, description-annotated results,
So that I get smarter color zone detection with label text pre-filled.

## Acceptance Criteria

1. **Given** `ANTHROPIC_API_KEY` is set in the environment, **when** the left sidebar "Suggest" section renders, **then** a "Claude ✦" button is visible alongside the SLIC button.

2. **Given** `ANTHROPIC_API_KEY` is not set, **when** the left sidebar "Suggest" section renders, **then** the "Claude ✦" button is not rendered at all.

3. **Given** I click "Claude ✦", **when** the request is sent, **then** `/api/suggest` is called with `{ id, method: "claude" }`, the server calls `claude-haiku-4-5-20251001` with the image as base64, and the response is parsed as `[{ x, y, description }]`.

4. **Given** Claude returns points, **when** they are applied, **then** existing points are replaced; each point's `label.text` is pre-filled with the description from Claude.

5. **Given** `/api/suggest` is called with `method: "claude"` but `ANTHROPIC_API_KEY` is not set, **when** the server handles the request, **then** it returns HTTP 503.

6. **Given** I click "Claude ✦", **when** the request is in-flight, **then** the button shows a loading state; on completion or error, it returns to its default state.

## Tasks / Subtasks

- [x] Task 1: Implement Claude handler in `/api/suggest` route (AC: 3, 5)
  - [x] Add imports: `import Anthropic from "@anthropic-ai/sdk"`, `import fs from "fs"`, `import sharp from "sharp"`
  - [x] Replace the `method === "claude"` → 501 stub with the real implementation (see Dev Notes)
  - [x] If `!process.env.ANTHROPIC_API_KEY` → return 503
  - [x] Read image: `await fs.promises.readFile(path.join("/tmp", id, "original.jpg"))` → buffer
  - [x] Get image dimensions via `(await sharp(buffer).metadata())` → `{ width, height }`
  - [x] Call Claude with base64 image + `SUGGEST_PROMPT` (see Dev Notes for prompt and SDK call)
  - [x] Extract JSON array from response text using regex fallback (see Dev Notes)
  - [x] Convert normalised 0–1 coords to pixel coords: `x = Math.round(p.x * width)`, `y = Math.round(p.y * height)`
  - [x] Validate each item has `x`, `y`, `description` (throw if malformed)
  - [x] Return `NextResponse.json({ points })` on success; 500 on any thrown error

- [x] Task 2: Pass `claudeAvailable` prop from server page to EditorShell (AC: 1, 2)
  - [x] In `app/editor/page.tsx` (server component): read `const claudeAvailable = !!process.env.ANTHROPIC_API_KEY`
  - [x] Pass `claudeAvailable={claudeAvailable}` to `<EditorShell>`
  - [x] Add `claudeAvailable?: boolean` to `EditorShellProps` interface in `components/Editor/index.tsx`

- [x] Task 3: Add `claudePointsToEyedroppers` and `runSuggest` method param (AC: 3, 4)
  - [x] Add `claudePointsToEyedroppers(raw: { x: number; y: number; description: string }[]): EyedropperPoint[]` as an exported function alongside `apiPointsToEyedroppers` (see Dev Notes for implementation)
  - [x] Refactor `runSuggest` to accept a `method: "slic" | "claude"` parameter (signature change: `useCallback(async (method: "slic" | "claude") => {...}, [imageId])`)
  - [x] Inside `runSuggest`: choose converter based on method — `apiPointsToEyedroppers` for slic, `claudePointsToEyedroppers` for claude
  - [x] Update the `useEffect` auto-suggest call to `runSuggest("slic")` and the SLIC button onClick to `() => runSuggest("slic")`

- [x] Task 4: Render "Claude ✦" button in Suggest section (AC: 1, 2, 6)
  - [x] In the Suggest section of `EditorShell`, conditionally render a "Claude ✦" button when `claudeAvailable` is true
  - [x] Claude button: `disabled={isSuggestingLoading}`, `onClick={() => runSuggest("claude")}`
  - [x] Both SLIC and Claude buttons are disabled while either is running (shared `isSuggestingLoading`)

- [x] Task 5: Write tests (AC: all)
  - [x] Update `app/api/suggest/route.test.ts`:
    - [x] Update the existing "returns 501 for claude method" test → now expects 503 (no API key case)
    - [x] Add mock for `@anthropic-ai/sdk` using `vi.hoisted` + `vi.mock` (see Dev Notes)
    - [x] Add mock for `fs` and `sharp` (see Dev Notes)
    - [x] Add test: `ANTHROPIC_API_KEY` set → 200 with `{ points: [{x, y, description}] }`
    - [x] Add test: Claude returns invalid JSON → 500
    - [x] Add test: `fs.promises.readFile` throws → 500
    - [x] Add test: Anthropic SDK throws → 500
  - [x] `components/Editor/apiPointsToEyedroppers.test.ts` → add `claudePointsToEyedroppers` tests: sets `label.text` from description, uses `#888888` placeholder color, populates all required EyedropperPoint fields
  - [x] Run `npm test` from `eyedropper-web/` — all tests pass, no regressions (current baseline: 66 tests)

### Review Findings

- [x] [Review][Patch] Claude coordinates not validated as finite/in-range before scaling — `p.x`/`p.y` are only checked for `=== undefined`; a model returning `1.5`, `-0.2`, `null`, `"0.5"` (string), or `NaN` flows through `Math.round(p.x * imageWidth)` and lands off-canvas or as a `NaN` Konva position. The Claude path is the only suggest path that can emit out-of-range/non-numeric coords (SLIC returns clean Python ints). Add a `Number.isFinite` + `0..1` range check; add tests for these inputs. [app/api/suggest/route.ts:77-86] — FIXED: added `Number.isFinite` + `0..1` range guard; 5 new tests (out-of-range, negative, non-numeric, null, boundary 0/1).
- [x] [Review][Patch] `response.content[0]` accessed without guarding empty/non-text content — on a refusal (`stop_reason: "refusal"`) `content` can be `[]`, so `content[0].type` throws; and the code only inspects index 0, so any leading non-text block (e.g. thinking) yields `text = ""`. Both degrade to the spec-mandated 500 via the catch, but the cause is masked. Scan for the text block and guard empty content. [app/api/suggest/route.ts:72] — FIXED: now `response.content.find(b => b.type === "text")`; 2 new tests (empty content, leading non-text block).
- [x] [Review][Patch] `max_tokens: 1024` is borderline for ~12 points with descriptions — a chatty model or longer descriptions can truncate the JSON array mid-object → `JSON.parse` throws → 500 instead of returning points. Raise the cap (e.g. 2048). [app/api/suggest/route.ts:55] — FIXED: raised to 2048.
- [x] [Review][Patch] Claude button gives no textual loading state (AC6) — only the SLIC button swaps to "Suggesting…"; the Claude button stays "Claude ✦" while its own request is in flight (disabled styling only). Track which method is loading and show the indicator on the active button. [components/Editor/index.tsx:196-204] — FIXED: added `loadingMethod` state; each button shows "Suggesting…" only when it is the active method.
- [x] [Review][Patch] `new Anthropic()` constructed per request — hoist the client to module scope; the SDK is designed to be instantiated once and reused. [app/api/suggest/route.ts:52] — FIXED: lazy module-level singleton (`anthropicClient ??= new Anthropic()`), constructed only after the key guard so the keyless case never instantiates it.
- [x] [Review][Defer] id regex `/^[0-9a-f-]{36}$/` over-permissive — accepts 36-char non-UUID strings; path traversal is still blocked by the charset. Already tracked in deferred-work.md (Story 2.1 review); pre-existing pattern shared with app/api/image/route.ts. [app/api/suggest/route.ts:29] — deferred, pre-existing
- [x] [Review][Defer] Suggested points not offset by `imageOffsetY` — markers render `imageOffsetY` px too high on padded portrait images. Affects SLIC identically; spec Dev Notes defer offset handling to Story 2.3. Already tracked in deferred-work.md. [components/Editor/EyedropperLayer.tsx:16, Canvas.tsx:42] — deferred, pre-existing
- [x] [Review][Defer] Module-level `pointIdCounter` resets on HMR/StrictMode and is shared mutable state — no current break (both converters share one counter; nothing keys local state on point id yet). Pre-existing convention from Story 2.1. [components/Editor/index.tsx:45] — deferred, pre-existing
- [x] [Review][Defer] No AbortController / sequence guard on `runSuggest`; `setPoints` unconditionally replaces — a stale response from a previous `imageId` could clobber a newer one, and any future user edits would be wiped by a re-run. Low real-world exposure today (imageId is stable; no edit features until Stories 2.4+). Pre-existing model from Story 2.1's auto-suggest. [components/Editor/index.tsx:136-164] — deferred, pre-existing

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`).

### Files to MODIFY (not create)

| File | Current state | This story |
|------|---------------|------------|
| `app/api/suggest/route.ts` | `method === "claude"` returns 501 stub | Replace stub with real Claude handler |
| `components/Editor/index.tsx` | `runSuggest` hardcoded to "slic" | Add method param; add `claudePointsToEyedroppers`; add Claude button |
| `app/editor/page.tsx` | `<EditorShell imageId={id} />` | Pass `claudeAvailable` prop |

### Files NOT to touch

- `lib/types.ts` — `EyedropperPoint` interface is correct as-is (no `description` field needed)
- `lib/color-sample.ts` — still a stub; Story 2.3 implements it
- `lib/swatch-layout.ts` — still a stub; Story 2.3 implements it
- `components/Editor/EyedropperLayer.tsx` — Story 2.3 replaces the Circle placeholder
- `components/Editor/Canvas.tsx` — no changes needed this story

### Claude SDK Call in the Route

```typescript
import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import sharp from "sharp"

const SUGGEST_PROMPT = `Identify approximately 12 distinct, color-diverse regions in this image that would make interesting color palette annotation points. Focus on the subject, not the background.

For each point return:
- x: horizontal position as a 0.0–1.0 fraction of image width (left=0, right=1)
- y: vertical position as a 0.0–1.0 fraction of image height (top=0, bottom=1)
- description: 1–4 words describing this color zone (e.g. "warm highlight", "deep shadow")

Return ONLY a valid JSON array, no other text:
[{"x": 0.3, "y": 0.45, "description": "warm highlight"}, ...]`

// Inside the route, replace method === "claude" stub:
if (method === "claude") {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Claude not available" }, { status: 503 })
  }

  const imagePath = path.join("/tmp", id, "original.jpg")
  let buffer: Buffer
  let imageWidth: number
  let imageHeight: number
  try {
    buffer = await fs.promises.readFile(imagePath)
    const meta = await sharp(buffer).metadata()
    imageWidth = meta.width!
    imageHeight = meta.height!
  } catch {
    return NextResponse.json({ error: "Failed to read image" }, { status: 500 })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: buffer.toString("base64"),
            },
          },
          { type: "text", text: SUGGEST_PROMPT },
        ],
      }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    // Extract JSON array even if Claude adds surrounding prose
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error("No JSON array in response")
    const raw: Array<{ x: number; y: number; description: string }> = JSON.parse(jsonMatch[0])

    const points = raw.map((p) => ({
      x: Math.round(p.x * imageWidth),
      y: Math.round(p.y * imageHeight),
      description: p.description,
    }))

    return NextResponse.json({ points })
  } catch {
    return NextResponse.json({ error: "Claude suggestion failed" }, { status: 500 })
  }
}
```

### `claudePointsToEyedroppers` in `index.tsx`

Claude returns `[{ x, y, description }]` — no color. Use `#888888` as a placeholder; Story 2.3 resamples all point colors via the hidden canvas.

```typescript
export function claudePointsToEyedroppers(
  raw: { x: number; y: number; description: string }[]
): EyedropperPoint[] {
  return raw.map((p) => ({
    id: `point-${pointIdCounter++}`,
    x: p.x,
    y: p.y,
    color: "#888888",  // placeholder — Story 2.3 resamples via hidden canvas
    swatchSide: "auto",
    swatchOrder: null,
    label: {
      text: p.description,  // pre-filled from Claude (key AC for this story)
      visible: true,
      x: p.x,
      y: p.y,
      fontSize: 16,
      fontFamily: "Cormorant Garamond Italic",
      color: "#1a1a1a",
    },
  }))
}
```

### `runSuggest` Refactor in `index.tsx`

Change the signature to accept a method. Both the SLIC button, Claude button, and auto-suggest call `runSuggest` with the appropriate method:

```typescript
const runSuggest = useCallback(async (method: "slic" | "claude") => {
  setIsSuggestingLoading(true)
  setSuggestError(false)
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: imageId, method }),
    })
    const data = res.ok ? await res.json() : null
    if (data && Array.isArray(data.points)) {
      setPoints(
        method === "slic"
          ? apiPointsToEyedroppers(data.points)
          : claudePointsToEyedroppers(data.points)
      )
    } else {
      setSuggestError(true)
    }
  } catch {
    setSuggestError(true)
  } finally {
    setIsSuggestingLoading(false)
  }
}, [imageId])

// Auto-suggest on mount:
useEffect(() => {
  runSuggest("slic")
}, [runSuggest])
```

SLIC button: `onClick={() => runSuggest("slic")}`
Claude button: `onClick={() => runSuggest("claude")}`

### Claude Button JSX

```tsx
{claudeAvailable && (
  <button
    onClick={() => runSuggest("claude")}
    disabled={isSuggestingLoading}
    className="w-full text-left text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white disabled:opacity-50 disabled:cursor-wait hover:border-[var(--color-accent)] transition-colors mt-1"
  >
    Claude ✦
  </button>
)}
```

### `app/editor/page.tsx` Update

```typescript
export default async function EditorPage({ searchParams }: ...) {
  const { id } = await searchParams
  if (!id) { ... }
  const claudeAvailable = !!process.env.ANTHROPIC_API_KEY
  return <EditorShell imageId={id} claudeAvailable={claudeAvailable} />
}
```

### Mocking `@anthropic-ai/sdk` in Tests

Use `vi.hoisted` + `vi.mock` — same pattern as `child_process` mock in `route.test.ts`:

```typescript
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mockCreate }
  },
}))
```

Mocking `fs` and `sharp` in the same test file:

```typescript
const { mockReadFile, mockSharpMeta } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockSharpMeta: vi.fn(),
}))

vi.mock("fs", () => ({
  default: { promises: { readFile: mockReadFile } },
  promises: { readFile: mockReadFile },
}))

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: mockSharpMeta })),
}))
```

Typical test setup:
```typescript
beforeEach(() => {
  mockReadFile.mockResolvedValue(Buffer.from("fake-image"))
  mockSharpMeta.mockResolvedValue({ width: 800, height: 600 })
  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: '[{"x":0.5,"y":0.5,"description":"test color"}]' }],
  })
  process.env.ANTHROPIC_API_KEY = "test-key"
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
  vi.clearAllMocks()
})
```

Test for 503 (no key):
```typescript
it("returns 503 for claude method when no API key", async () => {
  delete process.env.ANTHROPIC_API_KEY
  const { POST } = await import("./route")
  const req = new Request("http://localhost/api/suggest", {
    method: "POST",
    body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
    headers: { "Content-Type": "application/json" },
  })
  const res = await POST(req as any)
  expect(res.status).toBe(503)
})
```

**Important:** The existing test "returns 501 for claude method" must be updated to expect 503 (or split into "no key → 503" and "key set → 200" tests).

### Coordinate System

- SLIC returns integer image pixel coords directly
- Claude returns normalised 0–1 fractions → convert server-side: `x = Math.round(p.x * imageWidth)`, `y = Math.round(p.y * imageHeight)`
- All `EyedropperPoint.x/y` are image pixel coords (same for both methods)
- `imageOffsetY` correction is deferred to Story 2.3 (same as SLIC, per the deferred-work.md note)

### Previous Story Learnings

From Story 2.1 debug log (critical patterns to reuse):
- `vi.hoisted` is required for mock references used in `vi.mock` factory — not optional
- Vitest module imports are cached — each test file imports the route fresh with `await import("./route")` to pick up mock state
- Mock events / async mock functions must resolve after the route's synchronous listener attachment. For Anthropic (promise-based), standard `mockResolvedValue` works fine — no double-microtask trick needed
- `process.env` can be mutated in tests but **must** be restored in `afterEach`; shared state between tests causes false positives

### Tailwind v4 Reminder

Use `bg-[var(--color-*)]`, `border-[var(--color-border)]`, etc. No `tailwind.config.ts`. No `theme.extend`.

### Project Context

- Types: import `EyedropperPoint` from `@/lib/types`
- Test framework: Vitest + React Testing Library
- Run tests: `npm test` from `eyedropper-web/`
- Build must pass: `npm run build` — no TypeScript errors
- `@anthropic-ai/sdk` version: `^0.104.1` (already in `package.json`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blockers. The Turbopack build error (`Symlink scripts/.venv/bin/python3 is invalid`) is a pre-existing infrastructure issue; `npx tsc --noEmit` confirms zero TypeScript errors.

### Completion Notes List

- Implemented real Claude handler in `/api/suggest/route.ts`: 503 on missing API key, 500 on image read failure, 500 on SDK/parse failure, 200 with pixel-coord points on success.
- Added `claudePointsToEyedroppers` exported function alongside `apiPointsToEyedroppers`; uses `#888888` placeholder color and pre-fills `label.text` from Claude's description.
- Refactored `runSuggest` to accept `"slic" | "claude"` method param; both buttons and auto-suggest wire through it.
- `claudeAvailable` prop flows from server page → EditorShell; Claude button only renders when true.
- All 75 tests pass (9 new: 5 route tests for Claude, 5 unit tests for `claudePointsToEyedroppers`).

### File List

- `eyedropper-web/app/api/suggest/route.ts`
- `eyedropper-web/app/api/suggest/route.test.ts`
- `eyedropper-web/app/editor/page.tsx`
- `eyedropper-web/components/Editor/index.tsx`
- `eyedropper-web/components/Editor/apiPointsToEyedroppers.test.ts`

### Change Log

- 2026-06-14: Implemented Story 2.2 — Claude point suggestion. Real `/api/suggest` Claude handler, `claudePointsToEyedroppers`, Claude button in sidebar. 75 tests passing.
