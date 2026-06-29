# Color Eyedropper Web App

A web app for an artist to upload a drawing, get color palette suggestions, drag/edit eyedropper points, style them, and export a 9:16 image for Instagram/TikTok.

## Project docs (read before writing any code)

- `docs/SPEC.md` — full product spec
- `docs/ARCHITECTURE.md` — stack, project structure, data flow
- `docs/UI.md` — UI layout, panels, interactions
- `docs/DECISIONS.md` — key tradeoffs already decided
- `docs/slic_suggest.py` — reference Python SLIC script for point detection

## BMAD

This project uses BMAD (Breakthrough Method for Agile AI Driven Development).
BMAD agents and skills are installed in `.claude/skills/` and `_bmad/`.
Use `/bmad-help` to see available skills and workflows.

## Stack

Next.js 15 (App Router) · Konva.js + react-konva · Tailwind CSS · Sharp · Python SLIC · Anthropic SDK (optional)

## Key constraints

1. Original image pixels are NEVER modified.
2. 9:16 output always — canvas padded with background color from image borders.
3. No swatch lines cross — `swatch-layout.ts` ports `_assign_sides` + `_place_swatches_aligned` from Python exactly.
4. Works without an API key — SLIC is always available.
5. No accounts, no database — uploads ephemeral in `/tmp`, deleted after 1 hour.

## Environment variables

```
ANTHROPIC_API_KEY=sk-ant-...    # Optional — enables Claude suggestions
```
