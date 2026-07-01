# Story 4.2: Upload Cleanup Cron

---
baseline_commit: NO_VCS
---

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **system operator**,
I want uploaded files in `/tmp` to be automatically deleted after 1 hour,
so that the server does not accumulate stale files from past sessions.

## Acceptance Criteria

1. **Given** a scheduled cron is configured **when** it runs **then** it scans `/tmp` for upload directories (UUID-named, matching `/^[0-9a-f-]{36}$/`) older than 1 hour and deletes them.

2. **Given** a directory `/tmp/<uuid>/` was last modified **more than 1 hour ago** **when** the cleanup runs **then** the entire `<uuid>/` directory and its contents are deleted (recursive).

3. **Given** a directory `/tmp/<uuid>/` was last modified **less than 1 hour ago** **when** the cleanup runs **then** it is left untouched.

4. **Given** the cron is deployed to Vercel **when** the project is inspected **then** a `vercel.json` `crons` entry is present that schedules `/api/cleanup` to run **at least once per hour** (`"schedule": "0 * * * *"`).

5. **Given** an entry in `/tmp` that does **not** match the upload-UUID pattern (e.g. an OS temp file, or a non-directory) **when** the cleanup runs **then** it is **ignored** — only UUID-named upload directories are ever deleted. (Safety: never delete arbitrary `/tmp` content.)

6. **Given** the cleanup encounters an error reading or deleting a single entry (e.g. a race where the dir is removed concurrently) **when** it runs **then** it logs/skips that entry and continues with the rest; the request still returns a success response with a summary of what was deleted.

## Tasks / Subtasks

- [x] **Task 1: Implement the cleanup endpoint** (`app/api/cleanup/route.ts` NEW) (AC: 1, 2, 3, 5, 6)
  - [x] Export an `async function GET(request: NextRequest)` (Vercel Cron Jobs invoke the configured path via **GET** — not POST). Import shape: `import { NextRequest, NextResponse } from "next/server"`, `import fs from "fs"`, `import path from "path"` (mirror `app/api/image/route.ts:1-3` and `app/api/upload/route.ts:3-5`).
  - [x] Define the threshold as a named constant: `const MAX_AGE_MS = 60 * 60 * 1000` (1 hour). Define the UUID matcher reusing the exact pattern already used in `app/api/image/route.ts:7`: `const UUID_RE = /^[0-9a-f-]{36}$/`.
  - [x] `const now = Date.now()`. `const tmpDir = "/tmp"`.
  - [x] Read the directory entries: `const entries = fs.readdirSync(tmpDir)` wrapped in `try/catch` — if `/tmp` itself can't be read, return `500 { error: "Cleanup failed" }`.
  - [x] For each `name` in `entries`:
    - Skip if `!UUID_RE.test(name)` (AC5 — only touch upload dirs).
    - `const full = path.join(tmpDir, name)`.
    - Inside a **per-entry** `try/catch` (AC6 — one bad entry must not abort the sweep):
      - `const stat = fs.statSync(full)`. Skip if `!stat.isDirectory()` (AC5 — only directories).
      - If `now - stat.mtimeMs > MAX_AGE_MS`: `fs.rmSync(full, { recursive: true, force: true })` and push `name` to a `deleted: string[]` list. (AC2 — full recursive delete.)
      - Else: leave untouched (AC3).
    - `catch`: continue to the next entry (optionally collect into a `skipped`/`errors` count). Do **not** rethrow.
  - [x] Return `NextResponse.json({ deleted, count: deleted.length })` (200). This summary makes AC1–3 assertable in tests and gives the cron a useful log line.
  - [x] **Use `mtimeMs`, not `birthtime`.** `birthtime` is unreliable / zero on some Linux filesystems (incl. Vercel's). The upload dir's `mtime` is set when `original.jpg` is written (`app/api/upload/route.ts:38`), so it is a reliable "age of the upload". (See Dev Notes "Why mtime".)
  - [x] **Synchronous fs is acceptable here** (matches `app/api/image/route.ts` which uses `existsSync`/`readFileSync`). The cron runs off the user request path; readability over async ceremony. Do not introduce `fs.promises` just for this route.

- [x] **Task 2: Add the Vercel cron schedule** (`vercel.json` NEW, at `eyedropper-web/` root) (AC: 4)
  - [x] Create `eyedropper-web/vercel.json` with:
    ```json
    {
      "crons": [
        { "path": "/api/cleanup", "schedule": "0 * * * *" }
      ]
    }
    ```
  - [x] `"0 * * * *"` = top of every hour (≥ once per hour, satisfies AC4). Do **not** add anything else to `vercel.json` (no `buildCommand`, `functions`, etc. — the project builds fine on Vercel defaults).
  - [x] **Read Dev Notes "Vercel free-tier cron caveat" before assuming this schedule deploys as-is** — on the Hobby (free) plan Vercel may only run crons once/day. The hourly schedule is what the AC asks for; the plan limitation is a deployment-config concern flagged for Miguel, not a code change.

- [x] **Task 3: Write tests** (`app/api/cleanup/route.test.ts` NEW) (AC: 1, 2, 3, 5, 6)
  - [x] Mock `fs` following `app/api/image/route.test.ts:3-11` exactly — `vi.mock("fs", () => ({ default: { readdirSync, statSync, rmSync } }))` with `const mockReaddirSync = vi.fn()` etc. declared at module top.
  - [x] Build a `statSync` mock helper that returns `{ isDirectory: () => true, mtimeMs: <number> }`. Use a controllable "now": since the route calls `Date.now()`, stub it with `vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW)` in `beforeEach` (note: `Math.random`/`Date.now` are fine in test runtime — the scripting restriction is workflow-only, not app/test code).
  - [x] Use a real-looking UUID for fixtures, e.g. `"550e8400-e29b-41d4-a716-446655440000"` (mirror the image test). Assert:
    - (AC2) a dir with `mtimeMs = FIXED_NOW - 2*3600*1000` (2h old) → `rmSync` called with `("/tmp/<uuid>", { recursive: true, force: true })`; response `deleted` includes it.
    - (AC3) a dir with `mtimeMs = FIXED_NOW - 60*1000` (1 min old) → `rmSync` **not** called for it; not in `deleted`.
    - boundary: exactly 1h old (`now - mtime === MAX_AGE_MS`) is **not** deleted (strict `>`); just over 1h **is**. Pick one to lock the boundary.
    - (AC5) an entry not matching the UUID regex (e.g. `"some-os-tempfile"`, `"T"`) → never `statSync`'d / never deleted.
    - (AC5) a UUID-named entry where `isDirectory()` returns `false` → not deleted.
    - (AC6) `statSync` (or `rmSync`) throwing for one entry → the other (old, valid) entry is still deleted; response still 200.
    - (AC1) `readdirSync` throwing → response 500.
  - [x] Build the request stub minimally: `const { GET } = await import("./route"); const res = await GET({} as any)` — this route reads no request fields, so an empty object cast is enough (the image test passes `{ nextUrl: ... }`; here nothing is read). Use `vi.clearAllMocks()` + `vi.resetModules()` in `beforeEach` (image-test pattern).
  - [x] Run `npm test` — all pass, no regressions. **Baseline: 238 passing** (Story 4.1 final). Expect +~7-9 tests, +1 file.
  - [x] Run `npx tsc --noEmit` — clean. No new required props anywhere (this is a standalone route + a JSON file); nothing else in the app imports the cleanup route, so no threading needed.

## Review Findings

_Code review 2026-06-29 — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 2 decisions (both resolved → patch), 3 patches, 7 dismissed as noise/spec-contradicting._

- [x] [Review][Patch] Refresh dir mtime on access → idle-TTL (was Critical decision) — Dir mtime is set once at `app/api/upload/route.ts:38` and never refreshed (`suggest`/`image` only read; `export` never touches `/tmp`), so the cron deletes 1h after UPLOAD, not last use. Resolution (Miguel): `fs.utimesSync(dir, now, now)` on read in `/api/image` and `/api/suggest` so the TTL becomes a true idle-timeout. NOTE: intentionally touches sibling routes the story originally scoped OUT. **APPLIED** — `image/route.ts` touches dir before read; `suggest/route.ts` adds `touchDir()` on both claude + slic paths; +3 tests.
- [x] [Review][Patch] Add optional CRON_SECRET guard (was High decision) — `/api/cleanup` is a public destructive GET. Resolution (Miguel): if `process.env.CRON_SECRET` is set, require `Authorization: Bearer <secret>`; otherwise stay open (honors NFR9 — env var stays optional). [app/api/cleanup/route.ts] **APPLIED** — +3 tests (unset→open, wrong→401, match→proceed).
- [x] [Review][Patch] Catch blocks swallow errors with no logging — AC6 says "logs/skips that entry" but both catch blocks are bare; add `console.error` [app/api/cleanup/route.ts:15-17, 30-32] **APPLIED**.

_All patches applied 2026-06-29. `npm test` → 252 passing (245 baseline + 7 new). `npx tsc --noEmit` → clean._

## Dev Notes

### Working Directory

All paths relative to `eyedropper-web/` (`/Users/miguel.gomes/main/docs/eyedropper/eyedropper-web/`). Tests: `npm test` from there. Static check: `npx tsc --noEmit` (no `lint` script exists). Versions: Next **15.5.19** (App Router, Turbopack), React **19.1.0**, Sharp **^0.35.1**, Vitest **^4.1.8**. **No new runtime dependencies** — this story uses only Node's built-in `fs`/`path` (already used by the upload/image routes) plus a static `vercel.json`. Do NOT add anything to `package.json`.

### Scope — what this story IS and IS NOT

This is the **second and final story of Epic 4** and delivers FR28 / NFR3 (ephemeral uploads, no DB, 1-hour cleanup). It is the cleanup half that 4.1 explicitly deferred (4.1 Dev Notes: "Upload cleanup cron → Story 4.2"; `deferred-work.md:31`: "spec scopes … /tmp cleanup to story 4.2").

**IN scope:** a `GET /api/cleanup` route that deletes UUID-named `/tmp` upload dirs older than 1 hour; a `vercel.json` `crons` entry scheduling it hourly; tests.

**OUT of scope — do NOT build:**
- **Any change to `/api/upload`, `/api/image`, `/api/export`, `/api/suggest`.** In particular do **not** "fix" the upload route's `/tmp/<id>` dir-leak-on-failure noted in `deferred-work.md:31` — that is a separate pre-existing item; the cron is the systematic cleanup. (CLAUDE.md §3 surgical changes.)
- **Authentication / `CRON_SECRET` gating** of the endpoint — NFR9 says the only env var is the optional `ANTHROPIC_API_KEY`; adding a required secret changes the deployment contract. This is flagged as a question for Miguel (see end), not built by default.
- **Switching `/api/image` to async fs**, the `Cache-Control` stale-after-delete concern, or any other `deferred-work.md` item. Not this story.
- **A client-side or in-request cleanup trigger.** Cleanup is the scheduled cron only; uploads/editor are untouched.
- **Configurable retention** (env-driven TTL, query-param override). Hard-code 1 hour per the AC. No speculative flexibility (CLAUDE.md §2).

### Why mtime (not birthtime / creation time)

`fs.Stats.birthtime`/`birthtimeMs` is unreliable on Linux — many filesystems (including the ones Vercel's serverless functions run on) report `0` or fall back to `ctime`. `mtimeMs` is always populated. For an upload dir, `mtime` is set when the dir is created and `original.jpg` is written into it (`app/api/upload/route.ts:27,38`), and nothing rewrites it afterward, so `now - mtimeMs` is an accurate "age since upload". Use `mtimeMs` (a number in ms) so the comparison is a plain `now - stat.mtimeMs > MAX_AGE_MS` with no `Date` arithmetic.

### How Vercel Cron Jobs invoke the route — GET, not POST

Vercel Cron Jobs issue an **HTTP GET** to the configured `path` on a schedule. So the route handler must export **`GET`** (the upload/export routes export `POST`; this one is different — do not copy `POST`). The cron sends no body and no meaningful query params for our purposes, so the handler reads nothing off `request`. Returning a small JSON summary (`{ deleted, count }`) gives a useful entry in the Vercel cron execution log.

### Vercel free-tier cron caveat (flag for Miguel — affects AC4 deployability, NOT the code)

The AC asks for "at least once per hour" and `vercel.json` should declare `"schedule": "0 * * * *"`. **However**, Vercel's **Hobby (free) plan limits cron jobs to running once per day** (and caps the number of cron jobs). NFR10 requires "deployable on Vercel free tier". So the hourly schedule in `vercel.json` is *correct per the AC and will deploy*, but on the free plan Vercel will down-throttle its actual execution to daily. This is a plan/billing concern, not a code defect — the route and schedule are written as specified. There is also a deeper platform reality below. **Both are listed as questions for Miguel at the end of this story.** Write the code to the AC; do not silently change the schedule to daily.

### `/tmp` is per-instance and ephemeral on Vercel (context, no action)

On Vercel, each serverless function instance has its **own** `/tmp` (up to ~512MB) that is **wiped when the instance is recycled**. Two consequences: (a) the upload that wrote `/tmp/<uuid>` and the cron invocation that cleans it may land on **different** instances, so a single cron pass won't see every instance's files; (b) instance recycling already deletes `/tmp` content for free. So the cron is a **best-effort backstop**, exactly as the AC frames it ("scan `/tmp` … delete"), and is correct even though it isn't a global guarantee. **Do not** try to engineer cross-instance cleanup (would need external storage — explicitly rejected in `docs/DECISIONS.md:12-13` for v1). Implement the straightforward single-`/tmp` sweep.

### Files to CREATE (none to modify)

| File | Current state | This story's change |
|------|---------------|---------------------|
| `app/api/cleanup/route.ts` | does not exist | NEW — `GET` sweeps `/tmp`, deletes UUID dirs older than 1h, returns `{ deleted, count }` |
| `app/api/cleanup/route.test.ts` | does not exist | NEW — fs-mocked route tests (age boundary, non-UUID skip, per-entry error tolerance, readdir-throws→500) |
| `vercel.json` | does not exist | NEW — single `crons` entry: `/api/cleanup` @ `0 * * * *` |

### Files NOT to touch

- `app/api/upload/route.ts`, `app/api/image/route.ts`, `app/api/export/route.ts`, `app/api/suggest/route.ts` — read upload/image **only** for the `/tmp/<uuid>` layout, the `randomUUID` shape, the `/^[0-9a-f-]{36}$/` regex, and the fs-mock test pattern. No edits.
- `next.config.ts` — cron config lives in `vercel.json`, not here. Leave the empty config as-is.
- `package.json`, `vitest.config.ts`, `vitest.setup.ts`, everything under `components/`, `lib/`, `app/editor`, `app/page.tsx` — irrelevant to this story.
- All `deferred-work.md` items — out of scope (see Scope section).

### Testing standards

- Vitest + RTL, **co-located** `*.test.ts` next to the route (`docs/project-context.md`). jsdom env (`vitest.config.ts`), but this route is pure Node — no DOM needed.
- **fs must be mocked** — never touch the real `/tmp` in a test. Copy the `vi.mock("fs", () => ({ default: { … } }))` shape from `app/api/image/route.test.ts:6-11` (note `default:` — these routes do `import fs from "fs"`, so the mock must be on `default`). Add `readdirSync`, `statSync`, `rmSync` to the mock.
- **`statSync` mock** returns an object with `isDirectory: () => boolean` and `mtimeMs: number` — mirror real `fs.Stats` only for the fields the route reads.
- **Stub `Date.now()`** with `vi.spyOn(Date, "now").mockReturnValue(...)` for deterministic age math; restore in `afterEach`/`vi.restoreAllMocks()`. (App/test code may use `Date.now()` freely — the "no `Date.now()`" rule is for **workflow scripts only**, not the product.)
- `beforeEach`: `vi.clearAllMocks(); vi.resetModules()` then `await import("./route")` inside each test (image-test pattern, so the fresh mock state is captured).
- Assert on the returned JSON (`await res.json()` → `{ deleted, count }`) and on `rmSync` call args — that is what makes AC2/AC3/AC5/AC6 verifiable without a filesystem.

### Previous Story Intelligence (Epic 4 + earlier)

- **fs-mock discipline (Story 1.2 upload, image route):** `import fs from "fs"` → mock `default`. `app/api/image/route.test.ts` is the closest template for THIS route (it mocks `fs.default` and builds a minimal request); follow it over the upload test (which also mocks sharp/crypto you don't need).
- **Reuse the existing UUID regex** `/^[0-9a-f-]{36}$/` verbatim (`app/api/image/route.ts:7`) — do not invent a stricter RFC-4122 regex; consistency with how ids are already validated app-wide. (Anti-reinvention.)
- **No new deps, no new state container** (every Epic 1–4 story): this is built entirely on Node built-ins + a static config file.
- **Synchronous fs is the established norm** for these routes (`image` uses `existsSync`/`readFileSync`); `deferred-work.md:37` notes a *future* async migration but explicitly scopes it as low-priority and separate — do not pre-empt it here.
- **Surgical scope (CLAUDE.md §3 + repeated review lessons):** 4.1's review dismissed several "while you're here" hardenings as out of scope; same discipline applies — implement the cleanup, nothing adjacent.

### Project Structure Notes

- `app/api/cleanup/route.ts` sits beside the other route handlers (`upload`, `image`, `export`, `suggest`) under `app/api/`, matching `docs/ARCHITECTURE.md:11-14`. Its test co-locates as `route.test.ts` like the others.
- `vercel.json` is a new top-level file in `eyedropper-web/` (the Next.js project root, alongside `next.config.ts` and `package.json`) — Vercel reads it from the project root. `docs/project-context.md` confirms all source lives under `eyedropper-web/`.
- No `lib/types.ts` change, no component change, no new dependency.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Upload Cleanup Cron (lines 626-648)] — the 4 source acceptance criteria (FR28).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 (lines 588-590)] — Epic scope: export (4.1) + cleanup (4.2).
- [Source: _bmad-output/planning-artifacts/epics.md:71,119] — "Cleanup cron: Uploads in /tmp must be deleted after 1 hour"; FR28 mapped to Epic 4.
- [Source: docs/DECISIONS.md:12-13] — "Uploads live in /tmp for 1 hour and are deleted by a cleanup cron. Keeps the setup to zero external services." — the rationale; also why NOT S3/Blob (don't add external storage).
- [Source: docs/SPEC.md:55,186] — "/tmp/<id>/original.jpg"; "uploads are ephemeral (deleted after 1 hour), no login required."
- [Source: docs/ARCHITECTURE.md:11-14,41-48] — api/ route layout and the upload data flow that writes `/tmp/<uuid>/original.jpg`.
- [Source: app/api/upload/route.ts:21-23,27,38] — `crypto.randomUUID()` → `path.join("/tmp", id)` → `mkdirSync` → write `original.jpg`; the exact dir layout the cron deletes and the source of the dir's mtime.
- [Source: app/api/image/route.ts:1-3,7] — `import fs/path`, the `/^[0-9a-f-]{36}$/` UUID regex to reuse, and the sync-fs precedent.
- [Source: app/api/image/route.test.ts:3-24] — the `vi.mock("fs", () => ({ default: { … } }))` shape, minimal request stub, and `beforeEach` reset pattern to mirror.
- [Source: app/api/upload/route.test.ts:1-20] — secondary fs-mock reference (declared-fn pattern).
- [Source: _bmad-output/implementation-artifacts/4-1-jpeg-export-and-download.md:111] — 4.1 explicitly defers the cleanup cron / vercel.json to this story.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:31] — "spec scopes server-side validation + /tmp cleanup to story 4.2"; also the upload dir-leak item that is NOT this story.
- [Source: docs/project-context.md] — testing standards (Vitest, co-located, mock fs with vi.mock, `npm test`, `tsc --noEmit`); architecture constraints (all source under `eyedropper-web/`).
- [Source: _bmad-output/planning-artifacts/epics.md:60 (NFR10), :59 (NFR9)] — "deployable on Vercel free tier" and "only required env var is ANTHROPIC_API_KEY (optional)" — the basis for the free-tier-cron and no-CRON_SECRET flags.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

- `npx vitest run app/api/cleanup/route.test.ts` → 7 passed.
- `npm test` → 26 files, 245 passed (238 baseline + 7 new). No regressions.
- `npx tsc --noEmit` → No errors found.

### Completion Notes List

- Implemented `GET /api/cleanup` exactly per Task 1: named `MAX_AGE_MS`/`UUID_RE` constants, top-level `readdirSync` try/catch → 500, per-entry try/catch sweep using `mtimeMs` with strict `>` comparison, recursive `rmSync`, and a `{ deleted, count }` JSON summary.
- The `request: NextRequest` param is intentionally unused (the cron sends nothing the route reads); `noUnusedParameters` is not enabled in `tsconfig.json`, so `tsc` stays clean while keeping the spec-mandated signature.
- Added `vercel.json` with the single hourly `crons` entry. No other Vercel config added.
- Tests mirror `app/api/image/route.test.ts` (mock `fs.default`, `beforeEach` reset + dynamic import, `Date.now` spy). Covers AC1 (readdir-throws→500), AC2 (>1h deleted), AC3 (<1h kept), boundary (exactly 1h kept / just-over deleted), AC5 (non-UUID skipped + non-directory skipped), AC6 (one throwing entry skipped, sweep continues, still 200).
- Strictly surgical: no edits to `upload`/`image`/`export`/`suggest` routes or any other file. The 3 Open Questions (free-tier cron cadence, `CRON_SECRET` gating, per-instance `/tmp`) are left for Miguel as flagged — none are code changes for this story.

### File List

- `eyedropper-web/app/api/cleanup/route.ts` (NEW)
- `eyedropper-web/app/api/cleanup/route.test.ts` (NEW)
- `eyedropper-web/vercel.json` (NEW)
- `eyedropper-web/app/api/image/route.ts` (MODIFIED — code review: touch dir mtime on access for idle TTL)
- `eyedropper-web/app/api/image/route.test.ts` (MODIFIED — +2 tests for mtime touch)
- `eyedropper-web/app/api/suggest/route.ts` (MODIFIED — code review: `touchDir()` on claude + slic paths)
- `eyedropper-web/app/api/suggest/route.test.ts` (MODIFIED — +2 tests for mtime touch)

## Change Log

- 2026-06-29: Implemented Story 4.2 — `GET /api/cleanup` sweep of stale `/tmp` upload dirs, hourly `vercel.json` cron, and route tests. 7 tests added (245 total passing); `tsc --noEmit` clean.

## Open Questions for Miguel

1. **Vercel free-tier cron frequency (AC4 vs NFR10).** Vercel's Hobby/free plan throttles cron jobs to **once per day**, but AC4/FR28 want hourly. The code declares `"0 * * * *"` (hourly) as the AC specifies. Options if the app stays on the free tier: (a) accept daily actual cadence (files live up to ~24h, not 1h); (b) change the schedule to daily and relax the AC; (c) upgrade to Pro for true hourly. Which do you want for the v1 deploy?
2. **Endpoint protection.** `/api/cleanup` is currently public (anyone hitting the URL triggers a sweep — low blast radius since it only deletes >1h-old upload dirs, but it is a public side-effecting endpoint). Vercel supports gating cron routes with a `CRON_SECRET` env var + `Authorization: Bearer` check. This conflicts with NFR9 ("only env var is the optional ANTHROPIC_API_KEY"). Leave it open (current story default), or add the optional `CRON_SECRET` guard?
3. **`/tmp` is per-instance on Vercel** (each serverless instance has its own ephemeral `/tmp`, wiped on recycle). A single cron pass only cleans the instance it runs on; instance recycling already deletes `/tmp` for free. The cron is therefore a best-effort backstop, which matches the AC. Just confirming you're aligned that v1 doesn't attempt cross-instance cleanup (would require the external storage that DECISIONS.md rejected for v1).
