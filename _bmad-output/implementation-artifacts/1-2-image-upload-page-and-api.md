# Story 1.2: Image Upload Page & API

---
baseline_commit: NO_VCS
---

Status: done

## Story

As an **artist**,
I want to drag-and-drop or click to upload my drawing (JPEG/PNG ≤20MB),
so that I can start annotating it with color points.

## Acceptance Criteria

1. **Given** I open the app at `/`, **when** the page renders, **then** I see a full-screen centered layout with a dashed-border rounded drop zone (~400×300px).

2. **Given** I hover over the drop zone, **when** my cursor is over it, **then** the border brightens to the accent color (`#c4956a`).

3. **Given** I drop or select a valid JPEG or PNG file ≤20MB, **when** the file is accepted, **then** the drop zone shows the filename and file size, and a "Continue →" button appears.

4. **Given** I click "Continue →", **when** the upload is submitted, **then** the file is POSTed to `/api/upload` as multipart form data, the original file is saved to `/tmp/<uuid>/original.jpg`, and the browser redirects to `/editor?id=<uuid>` using the id returned by the API.

5. **Given** `/api/upload` completes, **when** the response is inspected, **then** it returns `{ id, width, height }` where width/height are the image's natural dimensions in pixels.

6. **Given** I try to upload a file >20MB or a non-JPEG/PNG file, **when** the file is dropped or selected, **then** I see a clear error message and the upload is rejected without calling the API.

7. **Given** the screen width is <1024px, **when** the upload page loads, **then** I see an "Open on desktop" message instead of the upload zone.

## Tasks / Subtasks

- [x] Task 1: Replace `app/page.tsx` with Upload page (AC: 1, 2, 3, 6, 7)
  - [x] Replace the auto-generated `app/page.tsx` content with the Upload page that renders `<Upload />` and a mobile guard
  - [x] Add `<Upload />` component usage with `useRouter` for redirect after successful upload

- [x] Task 2: Implement `components/Upload.tsx` (AC: 1, 2, 3, 6)
  - [x] Full-screen centered layout: `min-h-screen flex items-center justify-center bg-[var(--color-bg)]`
  - [x] Drop zone: dashed border, rounded-xl, ~400×300px (`w-[400px] h-[300px]`), accepts drag-over and click-to-open file input
  - [x] Hover state: border changes to `var(--color-accent)` on `dragover` and `mouseenter`
  - [x] On valid file selected/dropped: show filename + formatted file size, show "Continue →" button
  - [x] On invalid file (not JPEG/PNG or >20MB): show inline error message, do not call API
  - [x] On "Continue →" click: call `handleUpload()` which POSTs to `/api/upload` and on success calls `router.push('/editor?id=<id>')`

- [x] Task 3: Implement `/api/upload/route.ts` (AC: 4, 5)
  - [x] Parse multipart form data — use Next.js built-in `request.formData()`
  - [x] Generate UUID for `id` — use Node.js `crypto.randomUUID()`
  - [x] Create `/tmp/<uuid>/` directory with `fs.mkdirSync`
  - [x] Read image width/height using `sharp` from the uploaded buffer
  - [x] Save original file to `/tmp/<uuid>/original.jpg` using `fs.writeFileSync` (convert PNG to JPEG via sharp if needed)
  - [x] Return `NextResponse.json({ id, width, height })`

- [x] Task 4: Mobile guard (AC: 7)
  - [x] In `app/page.tsx` or `components/Upload.tsx`, detect `window.innerWidth < 1024` with a `useEffect`/`useState` and render "Open on desktop" message instead of the upload zone on small screens

- [x] Task 5: Write tests (AC: all) — retroactively covered by Story 0.1
  - [x] `lib/upload-utils.test.ts` — validateFile (type + size branches), formatSize (KB/MB) — 10 tests, all pass
  - [x] `components/Upload.test.tsx` — drop zone render, error states, valid file, mobile guard — 6 tests, all pass
  - [x] `app/api/upload/route.test.ts` — happy path returns `{ id, width, height }`, missing file returns 400 — 4 tests, all pass

## Dev Notes

### Files to REPLACE (not create)

These files exist as stubs from Story 1.1 and **must be fully replaced**:

| File | Current state | This story |
|------|---------------|------------|
| `app/page.tsx` | auto-generated Next.js welcome page | Replace entirely with Upload page |
| `app/api/upload/route.ts` | stub returning `{ ok: true }` | Replace with real implementation |
| `components/Upload.tsx` | stub returning `<div>Upload</div>` | Replace with real component |

Do NOT touch `app/api/suggest/route.ts` or `app/api/export/route.ts` — they remain stubs.

### Working Directory

All file paths are relative to `eyedropper-web/` — the Next.js project root at `/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`.

### Design Tokens (already in `globals.css`)

The CSS variables are already defined in `app/globals.css` from Story 1.1. Use them directly:

```css
--color-bg: #fafaf9        /* page background */
--color-sidebar: #f4f3f1   /* not used in this story */
--color-border: #e8e5e0    /* drop zone default border */
--color-text-primary: #1a1a1a
--color-text-secondary: #6b6b6b
--color-accent: #c4956a    /* drop zone hover border */
--color-accent-hover: #b08050
```

In Tailwind CSS v4 (what's installed), arbitrary CSS variables are referenced as `bg-[var(--color-bg)]`, `border-[var(--color-accent)]`, etc. This project uses Tailwind v4 with the `@import "tailwindcss"` approach — **no `tailwind.config.ts`** present.

### Upload Component Implementation Details

**File validation (client-side only, before calling API):**
```typescript
const VALID_TYPES = ["image/jpeg", "image/png"]
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

function validateFile(file: File): string | null {
  if (!VALID_TYPES.includes(file.type)) return "Only JPEG and PNG files are supported."
  if (file.size > MAX_SIZE) return "File must be under 20MB."
  return null
}
```

**File size formatting:**
```typescript
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

**Drop zone drag handling** — use the `dragover` event to prevent default (enables drop), `drop` to read `e.dataTransfer.files[0]`:
```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (file) handleFile(file)
}
```

**Hidden file input** for click-to-upload:
```tsx
<input
  type="file"
  accept="image/jpeg,image/png"
  className="hidden"
  ref={inputRef}
  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
/>
```

**Upload to API:**
```typescript
const handleUpload = async () => {
  if (!selectedFile) return
  setUploading(true)
  const form = new FormData()
  form.append("file", selectedFile)
  const res = await fetch("/api/upload", { method: "POST", body: form })
  const data = await res.json()
  router.push(`/editor?id=${data.id}`)
}
```

**Loading state**: disable "Continue →" and show "Uploading…" while `uploading` is true.

### API Route Implementation Details

**Dependencies available**: `sharp` (installed), `fs` (Node built-in), `path` (Node built-in), `crypto` (Node built-in).

**Full implementation sketch:**
```typescript
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import fs from "fs"
import path from "path"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File
  
  const id = crypto.randomUUID()
  const dir = path.join("/tmp", id)
  fs.mkdirSync(dir, { recursive: true })
  
  const buffer = Buffer.from(await file.arrayBuffer())
  const image = sharp(buffer)
  const metadata = await image.metadata()
  
  // Always save as JPEG (handles PNG input too)
  await image.jpeg({ quality: 95 }).toFile(path.join(dir, "original.jpg"))
  
  return NextResponse.json({
    id,
    width: metadata.width!,
    height: metadata.height!,
  })
}
```

**Important**: `sharp` returns `metadata.width` / `metadata.height` as the original image dimensions before any transformation. Always save as JPEG regardless of input format — the `/api/suggest` route will later read `original.jpg` by convention.

### Mobile Guard Implementation

Use a `useEffect` to read `window.innerWidth` after mount (SSR-safe):

```typescript
const [isMobile, setIsMobile] = useState(false)
useEffect(() => {
  setIsMobile(window.innerWidth < 1024)
}, [])

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

### UX Details (from UI.md)

- Drop zone size: ~400×300px with dashed border, rounded corners
- Default border: `var(--color-border)` = `#e8e5e0`
- Hover/active border: `var(--color-accent)` = `#c4956a`
- Background: `var(--color-bg)` = `#fafaf9`
- After file selection: show `filename` + formatted file size + "Continue →" button
- "Continue →" button uses accent color

### Layout Context

`app/layout.tsx` already exists with Geist fonts and `globals.css` import — do NOT modify it. The Upload page rendered by `app/page.tsx` inherits the layout automatically.

### What NOT to implement in this story

- Do NOT implement the editor page (Story 1.3)
- Do NOT implement `/api/suggest` or `/api/export` (later stories)
- Do NOT add server-side file type validation (client-side only for now)
- Do NOT add upload progress indicator (overkill for v1)
- Do NOT add drag-and-drop to the editor page
- Do NOT implement cleanup/deletion of `/tmp` files (Story 4.2)

### Previous Story Learnings (from Story 1.1)

- Tailwind v4 is installed (`@import "tailwindcss"`) — use `bg-[var(--color-bg)]` syntax for CSS variables, NOT `bg-color-bg`
- `app/layout.tsx` uses Geist fonts via `next/font/google` — don't remove or replace this
- `react-konva` installed with `--legacy-peer-deps` due to peer dep version mismatch — not relevant to this story
- `lib/types.ts` contains `EyedropperPoint`, `EditorState`, `LabelDefaults` — import from there if needed (not needed for this story)
- Build verified with `npm run build` — must still pass after this story

### References

- [Source: docs/ARCHITECTURE.md#Upload data flow] — POST /api/upload saves to /tmp/<uuid>/original.jpg, returns { id, width, height }
- [Source: docs/SPEC.md#Pages/Routes] — /api/upload spec
- [Source: docs/UI.md#Upload Page] — drop zone layout and interaction spec
- [Source: docs/UI.md#Color palette] — design token values
- [Source: docs/DECISIONS.md#Why not store uploads in S3] — /tmp storage is intentional

## Review Findings

- [x] [Review][Decision→Patch] Route server-side robustness — FIXED: wrapped image processing in try/catch returning **400 "Invalid or corrupt image"** on sharp decode failure (empty/non-image bytes), added a guard returning **400 "Could not read image dimensions"** when `metadata.width`/`height` are nullish (removed the `!` assertions), and tightened the non-File guard (`typeof file.arrayBuffer !== "function"`) so a string field returns 400 instead of throwing [app/api/upload/route.ts]. Server-side size cap (DoS) + `/tmp` cleanup left deferred to story 4.2 per spec scope.
- [x] [Review][Patch] AC4 submit-and-navigate flow untested — FIXED: added tests for `handleUpload` success (asserts `router.push('/editor?id=abc-123')` via hoisted mock + stubbed fetch), `!res.ok` and fetch-reject error branches (no navigation), drag-drop upload, and drag-over border highlight [components/Upload.test.tsx]
- [x] [Review][Patch] Stale Dev Agent Record — FIXED: corrected Debug Log References note [1-2-image-upload-page-and-api.md]
- [x] [Review][Defer] Same-file re-selection doesn't re-fire `onChange` [components/Upload.tsx:104] — deferred, low-severity retry-path UX (input value never reset to '')
- [x] [Review][Defer] No server-side size cap on `arrayBuffer()` (memory-exhaustion/DoS) + `/tmp/<id>` dir leaked on failure [app/api/upload/route.ts] — deferred, spec scopes server hardening + cleanup to story 4.2
- [x] [Review][Defer] `router.push` stuck-`uploading` state if `/editor` navigation hangs [components/Upload.tsx:49] — deferred, low-severity edge; push() is not awaitable so cannot be caught

_Dismissed as noise: `uploading` staying true after success (intentional double-submit guard), missing resize listener (spec prescribes one-shot useEffect — AC7 MET), path traversal (id is crypto.randomUUID, not exploitable), client ignoring width/height in response (consumed by story 1-3)._

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (eu.anthropic.claude-sonnet-4-6)

### Debug Log References

- (Original note, now superseded:) At implementation time no test framework was configured; build success (`npm run build`) was used as primary validation. Story 0.1 subsequently retrofitted Vitest + RTL, and Task 5's tests now exist and pass. Code review (2026-06-14) hardened the route and added submit-flow/drag/route-error tests — full suite 48/48 green, `tsc --noEmit` clean.

### Completion Notes List

- Replaced `app/page.tsx` with SSR-safe Upload page using `useEffect` mobile guard
- Implemented full `components/Upload.tsx`: drag-and-drop, click-to-open, file validation (type + size), filename/size display, "Continue →" button with loading state, redirect on success
- Implemented `/api/upload/route.ts`: multipart formData parsing, UUID generation with `crypto.randomUUID()`, directory creation in `/tmp/<uuid>/`, sharp metadata extraction, JPEG conversion (handles PNG input), returns `{ id, width, height }`
- Mobile guard renders "Please open this app on a desktop (1024px+)" for `window.innerWidth < 1024`
- All CSS uses `var(--color-*)` tokens defined in `globals.css` from Story 1.1
- `npm run build` passes with 0 TypeScript errors

### File List

- eyedropper-web/app/page.tsx (replaced)
- eyedropper-web/app/api/upload/route.ts (replaced)
- eyedropper-web/components/Upload.tsx (replaced)
