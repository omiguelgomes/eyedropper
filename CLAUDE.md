# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Color Eyedropper Web App

A web app for an artist to upload a drawing, get color palette suggestions, drag/edit eyedropper points, style them, and export a 9:16 image for Instagram/TikTok. All code lives in `eyedropper-web/`.

## Project docs (read before writing any code)

- `docs/SPEC.md` — full product spec
- `docs/ARCHITECTURE.md` — intended stack/structure/data flow (note: written ahead of build; partly aspirational — verify against code)
- `docs/UI.md` — UI layout, panels, interactions
- `docs/DECISIONS.md` — key tradeoffs already decided
- `docs/slic_suggest.py` — reference Python SLIC script (the live copy is `eyedropper-web/scripts/slic_suggest.py`)
- `_bmad-output/` — BMAD planning artifacts: `planning-artifacts/epics.md`, per-story specs in `implementation-artifacts/`, and `sprint-status.yaml`

## Commands

All commands run from `eyedropper-web/`:

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Production build (Turbopack)
npm test             # Run all tests (Vitest, watch mode)
npx vitest run       # Run all tests once (CI-style)
npx vitest run lib/swatch-layout.test.ts   # Run a single test file
npx vitest run -t "no crossing"            # Run tests matching a name
```

SLIC runs in-process as a TypeScript port (`lib/slic-suggest.ts`) — no Python needed, so it works in Vercel's Node serverless runtime. `docs/slic_suggest.py` and `scripts/slic_suggest.py` remain as the reference implementation the port mirrors.

## Architecture

Next.js 15 App Router · Konva.js + react-konva · Tailwind v4 · Sharp · in-process JS SLIC · Anthropic SDK (optional). React 19. Tests: Vitest + jsdom + Testing Library; `@/` aliases the `eyedropper-web/` root (see `vitest.config.ts`). Test files sit next to the code they cover (`*.test.ts(x)`).

### Two pages, four API routes

- `app/page.tsx` — upload page (`Upload.tsx` drag-and-drop).
- `app/editor/page.tsx` — server component; reads `?id=`, computes `claudeAvailable = !!process.env.ANTHROPIC_API_KEY` server-side, passes it to the `Editor` client shell. This is how the UI knows whether to show the Claude button without leaking the key.
- `app/api/upload/route.ts` — POST multipart; Sharp re-encodes to JPEG q95 and `putUpload`s it to Vercel Blob at `uploads/<uuid>.jpg`; returns `{ id, width, height }`. 50MB body cap.
- `app/api/suggest/route.ts` — POST `{ id, method }`. Reads the stored JPEG from Blob (`getUploadBuffer`). `method:"slic"` decodes raw RGB via Sharp (downscaled to ≤500px for speed) and runs the in-process `suggestPoints` (`lib/slic-suggest.ts`), scaling results back to original pixels. `method:"claude"` calls Haiku (`claude-haiku-4-5-20251001`) with the image; returns 503 if no API key. Both return points in **original-image pixel coordinates**.
- `app/api/image/route.ts` — GET `?id=`; fetches the stored JPEG from Blob (`getUploadBuffer`) and proxies the bytes **same-origin** (not a redirect — a cross-origin image would taint the sampling canvas). The client draws it onto a hidden canvas for color sampling.
- **Export has no API route** — the client encodes the final 9:16 JPEG entirely in the browser via Konva `stage.toBlob({ mimeType: "image/jpeg", quality: 0.95, pixelRatio })` and downloads it directly (`handleExport` in `Editor/index.tsx`). A previous `/api/export` route re-encoded a POSTed PNG data URL with Sharp, but a full-resolution PNG exceeded Vercel's 4.5MB request body limit and was rejected with 413 before the handler ran.
- `app/api/cleanup/route.ts` — GET, triggered by `vercel.json` cron. Deletes Blob `uploads/*` objects older than 1h **by `uploadedAt`** (`deleteExpiredUploads`). Optional `CRON_SECRET` bearer auth.

**Storage:** uploads live in **Vercel Blob** (private access), not `/tmp` — Vercel's `/tmp` is per-Lambda, so an upload written on one instance was invisible to the `image`/`suggest` requests routed to another (the intermittent "image may have expired" bug). `lib/blob-store.ts` is the single access point (`putUpload`, `getUploadBuffer`, `deleteExpiredUploads`). **Auth:** on Vercel it uses OIDC automatically (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`, platform-injected — no token needed). Locally OIDC isn't issued for the `development` environment, so `.env.local` needs a `BLOB_READ_WRITE_TOKEN`, which the helper passes explicitly (an explicit token wins over OIDC).

### Editor state

`components/Editor/index.tsx` is the stateful root (`useState`/`useRef`) — it owns `EyedropperPoint[]`, selection, style, canvas layout, and the hidden sampling canvas. **`useEyedroppers.ts` is an empty stub — do not assume state lives there.** Layers: `Canvas.tsx` (Konva stage), `EyedropperLayer.tsx` (markers/swatches/connectors), `LabelLayer.tsx` (draggable labels). Side panels: `PointPanel`, `LabelPanel`, `StylePicker`, `ExportButton`, `ContextMenu`, `LabelEditOverlay`.

### Core lib (pure functions, heavily unit-tested)

- `swatch-layout.ts` — edge assignment + no-crossing ordering. Exports `assignSwatchLayout`, `redistributeOnEdge`, `placeSwatchOnEdge`, `resolveSwatchOverlap`. Ports the Python `_assign_sides` / `_place_swatches_aligned` logic.
- `canvas-to-916.ts` — `canvasTo916(w, h)` → 9:16 `CanvasLayout` with `imageOffsetY`.
- `color-sample.ts` — `sampleColor(ctx, x, y)` averages a small radius from the hidden canvas's ImageData (read-only; the original is never mutated).
- `label-layout.ts`, `drag-utils.ts` (`clampToImage`), `apply-to-all.ts` (`applyFieldToAll`), `download.ts`, `fonts.ts`, `styles.ts`.
- `styles.ts` + `styles.json` — the `Style` shape (swatch/connector/marker/label appearance) for `StylePicker`.

Coordinates: points store `x,y` in **original-image space**; labels and free-floating swatches (`swatchX/swatchY`, null until detached) store **canvas space**. See `lib/types.ts`.

## Key constraints

1. Original image pixels are NEVER modified — sampling reads a hidden canvas; export re-encodes only.
2. 9:16 output always — canvas padded with a background color auto-detected from image borders (`detectBorderColor` in `Editor/index.tsx`).
3. No swatch lines cross — `swatch-layout.ts` must mirror the Python ordering exactly.
4. Works without an API key — SLIC is always available; Claude is the optional upgrade.
5. No accounts, no database — uploads ephemeral in Vercel Blob, deleted after ~1h by the cleanup cron.

## Environment variables

```
BLOB_READ_WRITE_TOKEN=...       # Local dev only — Vercel Blob rw token in .env.local (prod uses OIDC)
ANTHROPIC_API_KEY=sk-ant-...    # Optional — enables Claude suggestions
CRON_SECRET=...                 # Optional — bearer-protects /api/cleanup
```

## BMAD

This project uses BMAD (Breakthrough Method for Agile AI Driven Development); agents/skills live in `.claude/skills/` and `_bmad/`. Run `/bmad-help` for available skills and workflows.
