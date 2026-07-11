# Eyedropper

A web app for turning a drawing into a shareable color-palette breakdown. Upload an image, get suggested color sample points, drag and style them, and export a 9:16 image ready for Instagram or TikTok.

## Features

- **Upload** a drawing or photo.
- **Suggested palette points** via SLIC superpixels (always available) or Claude (optional).
- **Edit** eyedropper points — drag, add, remove, restyle.
- **Labels & swatches** with CAD-style snapping and no crossing connector lines.
- **Export** a 9:16 image, auto-padded with a background color detected from the image borders.

No accounts, no database — uploads are ephemeral and cleaned up automatically.

## Getting started

The app lives in [`eyedropper-web/`](eyedropper-web/):

```bash
cd eyedropper-web
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Palette suggestion via SLIC needs a Python venv:

```bash
cd eyedropper-web/scripts
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

## Environment variables

| Variable            | Required | Purpose                                    |
| ------------------- | -------- | ------------------------------------------ |
| `ANTHROPIC_API_KEY` | No       | Enables Claude-based palette suggestions.  |
| `CRON_SECRET`       | No       | Bearer-protects the cleanup cron endpoint. |

The app works fully without an API key — SLIC is always available, Claude is the optional upgrade.

## Tech stack

Next.js 15 (App Router) · React 19 · Konva.js · Tailwind v4 · Sharp · Python SLIC · Anthropic SDK.

## Documentation

See [`docs/`](docs/) for the product spec, architecture, and UI notes.
