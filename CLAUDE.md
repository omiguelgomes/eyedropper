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

Python SLIC needs a venv at `scripts/.venv` (the `/api/suggest` route auto-detects `scripts/.venv/bin/python3`, else falls back to system `python3`):

```bash
cd eyedropper-web/scripts
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # numpy, scikit-image, Pillow
```

## Architecture

Next.js 15 App Router · Konva.js + react-konva · Tailwind v4 · Sharp · Python SLIC · Anthropic SDK (optional). React 19. Tests: Vitest + jsdom + Testing Library; `@/` aliases the `eyedropper-web/` root (see `vitest.config.ts`). Test files sit next to the code they cover (`*.test.ts(x)`).

### Two pages, five API routes

- `app/page.tsx` — upload page (`Upload.tsx` drag-and-drop).
- `app/editor/page.tsx` — server component; reads `?id=`, computes `claudeAvailable = !!process.env.ANTHROPIC_API_KEY` server-side, passes it to the `Editor` client shell. This is how the UI knows whether to show the Claude button without leaking the key.
- `app/api/upload/route.ts` — POST multipart; Sharp re-encodes to JPEG q95 at `/tmp/<uuid>/original.jpg`; returns `{ id, width, height }`. 50MB body cap.
- `app/api/suggest/route.ts` — POST `{ id, method }`. `method:"slic"` spawns the Python script (`child_process.spawn`, 30s timeout, SIGKILL). `method:"claude"` calls Haiku (`claude-haiku-4-5-20251001`) with the image; returns 503 if no API key. Both return points in **original-image pixel coordinates**.
- `app/api/image/route.ts` — GET `?id=`; serves the stored original for the client to draw onto a hidden canvas for color sampling.
- `app/api/export/route.ts` — POST `{ dataUrl }`; the client has already rendered the final 9:16 bitmap via Konva `stage.toDataURL({ pixelRatio })`. Sharp **only re-encodes PNG→JPEG q95 — it must never resize/pad/alter dimensions.** Returns a JPEG attachment.
- `app/api/cleanup/route.ts` — GET, triggered hourly by `vercel.json` cron (`0 * * * *`). Deletes `/tmp/<uuid>` dirs older than 1h **by mtime**. Optional `CRON_SECRET` bearer auth.

**Idle-TTL trick:** `suggest` and `image` routes call `fs.utimesSync` to bump the upload dir's mtime on each access, so cleanup measures time-since-last-*access*, not time-since-upload. Don't remove these touches.

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
5. No accounts, no database — uploads ephemeral in `/tmp`, deleted after ~1h idle.

## Environment variables

```
ANTHROPIC_API_KEY=sk-ant-...    # Optional — enables Claude suggestions
CRON_SECRET=...                 # Optional — bearer-protects /api/cleanup
```

## BMAD

This project uses BMAD (Breakthrough Method for Agile AI Driven Development); agents/skills live in `.claude/skills/` and `_bmad/`. Run `/bmad-help` for available skills and workflows.
