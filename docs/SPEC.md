# Color Eyedropper Web App — Spec

## Purpose

A web app for an artist to upload a drawing, get color palette suggestions, drag/edit eyedropper points, style them, and export a 9:16 image for Instagram/TikTok.

No AI required to run the app. Claude is optional and improves suggestions when available.

---

## Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 15 (App Router) | Vercel-native, server actions, API routes |
| Canvas | Konva.js + react-konva | Best-in-class interactive canvas for React |
| Styling | Tailwind CSS | Fast, no bloat |
| Fonts | next/font + Google Fonts | For label typography in the export |
| Image processing (server) | Sharp | Fast Node.js image resizing/padding |
| Point detection (server) | Python via child_process OR pre-ported JS | SLIC in Python; fallback to JS k-means |
| AI suggestions (server) | Anthropic SDK (`claude-haiku-4-5`) | Optional, key in Vercel env vars |
| Deployment | Vercel | Free tier sufficient for personal use |

---

## User Flow

```
1. Upload image
      ↓
2. Auto-suggest points (SLIC or Claude)
      ↓
3. Edit canvas — drag, add, remove eyedroppers
      ↓
4. Choose style
      ↓
5. (Optional) Edit labels — text, font, size, color, position
      ↓
6. Export → 9:16 JPEG
```

---

## Pages / Routes

### `/` — Upload
- Drag-and-drop or click to upload an image (JPEG/PNG, max 20MB)
- Redirects to `/editor?id=<upload_id>` after upload

### `/editor` — Main Editor
Full-page canvas editor. Three panels: canvas (center), tools (left sidebar), style/export (right sidebar).

### `/api/upload` — POST
- Accepts multipart image upload
- Saves to `/tmp/<id>/original.jpg`
- Returns `{ id, width, height }`

### `/api/suggest` — POST
- Body: `{ id, method: "slic" | "claude" }`
- Runs SLIC (Python) or Claude Vision analysis
- Returns `{ points: [{ x, y, color }] }`

### `/api/export` — POST
- Body: `{ id, points, style, labels }`
- Renders final 9:16 JPEG server-side with Pillow (Python) or Sharp+Canvas
- Returns JPEG blob for download

---

## Editor Canvas

The canvas shows the original image (never modified) inside a 9:16 frame. The frame is the export preview — what she sees is what she gets.

### Canvas layout
- Canvas fills viewport height, centered horizontally
- Black letterbox bars if screen is wider than 9:16
- The original image is padded to 9:16 (same as the current Python script: fill with background color)

### Eyedropper points (Konva layer)
Each point is:
- A small ring marker (white circle, ~12px radius) on the image
- A swatch circle (filled, ~40px radius) on the canvas edge
- A curved line connecting them

Interaction:
- **Drag marker** → moves the sampling point; swatch color updates live
- **Drag swatch** → repositions swatch along its edge
- **Click empty area on image** → adds a new point
- **Right-click marker or swatch** → context menu: "Remove"
- **Click swatch** → selects it (shows options in right panel)

Color is sampled from the uploaded image pixels (4px radius average) at the marker position.

### Swatch arrangement
Same algorithm as the Python script:
- Auto-assign each swatch to its nearest canvas edge
- Sort swatches along each edge in the same spatial order as their markers (no-crossing guarantee)
- Evenly distribute along the full edge

---

## Suggestion Methods

### SLIC (always available)
- Runs on the server via a small Python script
- Segments the image into superpixels, picks ~12 most color-diverse subject points
- Filters out background-like colors (RGB distance from border-sampled background)
- No API key required

### Claude (optional, requires `ANTHROPIC_API_KEY` env var)
- Calls `claude-haiku-4-5` with the image
- Prompt: identify up to 14 interesting color zones on the subject, never background
- Returns points with x/y coordinates and short descriptions (used as default label text)
- Falls back silently to SLIC if key is not set

The UI shows both options. If `ANTHROPIC_API_KEY` is not set, the Claude button is hidden.

---

## Style System

Styles are defined in `styles.json` (checked into the repo). She can request new styles by editing this file.

Each style controls:

```json
{
  "name": "float_clean",
  "swatchRadius": 48,
  "swatchBorderColor": "#ffffff",
  "swatchBorderWidth": 3,
  "connectorType": "curved | straight | none",
  "connectorColor": "#1e1e1e",
  "connectorWidth": 2,
  "markerStyle": "ring | dot | none",
  "markerColor": "#ffffff",
  "labelPosition": "beside | below | none"
}
```

Built-in styles (same as CLI tool):
| Name | Connector | Labels |
|------|-----------|--------|
| `float_clean` | curved | none |
| `float` | curved | beside swatch |
| `grid` | none (numbered) | below swatch |
| `minimal` | straight | none |

Style picker: horizontal scroll of thumbnail previews. Selected style is highlighted.

---

## Label Editing (Step 5)

When she switches to "Labels" mode in the right panel:

- Each swatch with a label shows an editable text field next to it on the canvas
- Text draggable to any position within the canvas
- Per-label controls in right panel:
  - Font family (dropdown: 5 preset options + system fonts)
  - Font size (slider: 12–48px)
  - Color (color picker)
  - Toggle visibility
- Global label controls:
  - Apply font/size/color to all labels at once
- If Claude suggested descriptions, they pre-fill the text fields; otherwise empty

---

## Export

- **Format**: JPEG, quality 95
- **Size**: 9:16 at 2× the uploaded image's width (crisp on Retina/phone screens)
- **What's exported**: exact canvas state — image + swatches + connectors + labels
- **Server-side rendering**: Konva's `stage.toDataURL()` at 2× scale, OR server-side re-render with Python/Pillow for pixel-perfect quality
- Download triggered immediately on click ("Download" button in right panel)

---

## Non-negotiables

1. **Original image pixels are never modified** — not cropped, not color-adjusted, not resized.
2. **9:16 output always** — canvas padded with background color detected from image borders.
3. **No swatch lines cross** — sort swatches along each edge to match the spatial order of their source markers.
4. **Works without an API key** — SLIC is always available.
5. **No accounts, no database** — uploads are ephemeral (deleted after 1 hour), no login required.

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Optional. Enables Claude suggestions.
```

That's the only env var. Everything else is static.

---

## Out of scope (for now)

- User accounts / saving sessions
- Multiple images in one session
- Uploading custom styles via UI (edit `styles.json` directly)
- Pencil-texture swatch rendering
- Video/animated export
