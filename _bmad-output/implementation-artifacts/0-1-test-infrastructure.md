# Story 0.1: Test Infrastructure

---
baseline_commit: NO_VCS
---

Status: done

## Story

As a **developer**,
I want a Vitest + React Testing Library setup with tests for the code already written in Stories 1.1 and 1.2,
so that all future development has a working test harness and regressions are caught automatically.

## Acceptance Criteria

1. **Given** the `eyedropper-web/` project, **when** `npm test` is run, **then** Vitest executes and all tests pass.

2. **Given** `lib/` pure functions, **when** tests are run, **then** `validateFile` (type + size branches), `formatSize` (KB and MB), `canvasTo916` (stub returns correct shape) are covered.

3. **Given** `components/Upload.tsx`, **when** tests are run, **then** the component renders the drop zone, shows an error for invalid file types, shows an error for oversized files, shows filename+size+button for valid files, and shows the mobile message when `window.innerWidth < 1024`.

4. **Given** `/api/upload/route.ts`, **when** tests are run, **then** the happy path returns `{ id, width, height }` with a 200 status, and a missing file returns 400.

5. **Given** `npm test` is run, **when** tests complete, **then** there are zero failures and zero TypeScript errors in test files.

## Tasks / Subtasks

- [x] Task 1: Install and configure Vitest + RTL (AC: 1)
  - [x] Install: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`
  - [x] Create `vitest.config.ts` at `eyedropper-web/` root
  - [x] Create `vitest.setup.ts` that imports `@testing-library/jest-dom`
  - [x] Add `"test": "vitest"` script to `package.json`
  - [x] Verify `npm test` runs without errors (even with 0 test files)

- [x] Task 2: Tests for `lib/` pure functions (AC: 2)
  - [x] Create `lib/upload-utils.test.ts` testing `validateFile` and `formatSize` (extracted from `Upload.tsx` — see Dev Notes)
  - [x] Create `lib/canvas-to-916.test.ts` testing `canvasTo916` stub returns correct shape

- [x] Task 3: Component test for `Upload.tsx` (AC: 3)
  - [x] Create `components/Upload.test.tsx`
  - [x] Test: renders drop zone text by default
  - [x] Test: shows error message for non-JPEG/PNG file
  - [x] Test: shows error message for file >20MB
  - [x] Test: shows filename, size, and "Continue →" button for valid JPEG file
  - [x] Test: shows mobile message when `window.innerWidth = 800`

- [x] Task 4: API route test for `/api/upload` (AC: 4)
  - [x] Create `app/api/upload/route.test.ts`
  - [x] Mock `fs`, `sharp`, `crypto` with `vi.mock()`
  - [x] Test: happy path returns `{ id, width, height }` with status 200
  - [x] Test: missing file returns status 400

- [x] Task 5: Run full test suite (AC: 5)
  - [x] Run `npm test` — all tests pass (31/31 in-scope)
  - [x] Run `npx tsc --noEmit` — zero TypeScript errors

## Dev Notes

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom"
```

### Extracting validateFile and formatSize

`validateFile` and `formatSize` are currently defined inside `components/Upload.tsx`. **Extract them to `lib/upload-utils.ts`** so they can be unit-tested independently, then import them back into `Upload.tsx`. This is the only code change to existing files beyond test files.

```typescript
// lib/upload-utils.ts
export const VALID_TYPES = ["image/jpeg", "image/png"]
export const MAX_SIZE = 20 * 1024 * 1024

export function validateFile(file: File): string | null {
  if (!VALID_TYPES.includes(file.type)) return "Only JPEG and PNG files are supported."
  if (file.size > MAX_SIZE) return "File must be under 20MB."
  return null
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

In `Upload.tsx`, replace the inline definitions with:
```typescript
import { validateFile, formatSize } from "@/lib/upload-utils"
```

### Component Test Pattern

```typescript
// components/Upload.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Upload from "./Upload"

// Mock next/navigation
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe("Upload", () => {
  it("renders drop zone", () => {
    render(<Upload />)
    expect(screen.getByText("Drop image here")).toBeInTheDocument()
  })
  // etc.
})
```

For the mobile test, set `window.innerWidth = 800` before rendering:
```typescript
Object.defineProperty(window, "innerWidth", { value: 800, writable: true })
```

### API Route Test Pattern

Next.js route handlers are plain async functions — call them directly:

```typescript
import { POST } from "./route"

vi.mock("fs")
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    jpeg: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  }))
}))
vi.mock("crypto", () => ({ default: { randomUUID: () => "test-uuid" } }))

it("returns { id, width, height }", async () => {
  const file = new File(["data"], "test.jpg", { type: "image/jpeg" })
  const formData = new FormData()
  formData.append("file", file)
  const req = new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  })
  const res = await POST(req as any)
  const json = await res.json()
  expect(json).toEqual({ id: "test-uuid", width: 800, height: 600 })
  expect(res.status).toBe(200)
})
```

### Working Directory

All commands run from `eyedropper-web/`.

### tsconfig note

Vitest with `globals: true` requires adding `"types": ["vitest/globals"]` to `tsconfig.json` compilerOptions to avoid TypeScript errors for `describe`/`it`/`expect` globals.

```json
"compilerOptions": {
  "types": ["vitest/globals"]
}
```

### What NOT to do

- Do NOT install Jest — Vitest is already the choice
- Do NOT test Tailwind classes or CSS variable values
- Do NOT test Next.js routing behavior
- Do NOT write tests for stub files (e.g. `lib/color-sample.ts` stub body)

### References

- [Source: docs/project-context.md] — testing standards for all future stories
- [Source: components/Upload.tsx] — contains validateFile and formatSize to extract
- [Source: app/api/upload/route.ts] — route handler to test

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `userEvent.upload` skips hidden inputs and respects the `accept` attribute in jsdom — switched to `fireEvent.change` with `{ target: { files: [file] } }` for component file input tests.
- `NextRequest` with a `FormData` body times out in jsdom; mocked `req.formData()` directly instead of constructing a real request.

### Completion Notes List

- All 31 in-scope tests pass across 4 test files (41 total repo-wide, including out-of-scope files from later stories picked up by the shared vitest config).
- `validateFile` and `formatSize` extracted to `lib/upload-utils.ts` for testability; `Upload.tsx` imports them.
- API route tests mock `fs`, `sharp`, `crypto` at module level using `vi.mock()` hoisting.
- `tsconfig.json` updated with `"types": ["vitest/globals"]` to satisfy TypeScript for globals.

### Review Findings

- [x] [Review][Defer] Upload component core flow untested — `Upload.test.tsx` covers only the AC3-enumerated cases (drop zone, type/size errors, valid file display, mobile message), all MET. It never exercises `handleUpload` (fetch success/failure, `router.push` to /editor), the drag-and-drop `handleDrop` path, or the drag-over border state. Deferred to story 1-2 (image-upload page & API), whose own test task is the natural home for the submit/navigation flow.
- [x] [Review][Patch] lib pure functions miss edge cases required by "all branches, edge cases" standard — added `formatSize` zero + just-under-1MB tests, `validateFile` empty-MIME-type test, `canvasTo916` zero-width + odd-gap rounding tests [lib/upload-utils.test.ts, lib/canvas-to-916.test.ts] — FIXED
- [x] [Review][Patch] Stale Dev Agent Record counts — corrected to 31 in-scope tests (upload-utils 13, canvas-to-916 8, Upload 6, route 4) [0-1-test-infrastructure.md] — FIXED
- [x] [Review][Defer] route.ts unguarded `metadata.width!` + no try/catch [app/api/upload/route.ts:27] — deferred, pre-existing story-1-2 code; a corrupt image passing the MIME-only client check crashes/returns malformed JSON

### File List

- `eyedropper-web/vitest.config.ts` — NEW
- `eyedropper-web/vitest.setup.ts` — NEW
- `eyedropper-web/lib/upload-utils.ts` — NEW (extracted from Upload.tsx)
- `eyedropper-web/lib/upload-utils.test.ts` — NEW (13 tests)
- `eyedropper-web/lib/canvas-to-916.test.ts` — NEW (8 tests)
- `eyedropper-web/components/Upload.tsx` — MODIFIED (imports from upload-utils)
- `eyedropper-web/components/Upload.test.tsx` — NEW (6 tests)
- `eyedropper-web/app/api/upload/route.test.ts` — NEW (4 tests)
- `eyedropper-web/tsconfig.json` — MODIFIED (added vitest/globals types)
- `eyedropper-web/package.json` — MODIFIED (added test script, dev dependencies)
