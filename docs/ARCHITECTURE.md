# Architecture

## Project structure

```
eyedropper-web/
├── app/
│   ├── page.tsx                  # Upload page
│   ├── editor/
│   │   └── page.tsx              # Editor page (receives ?id=)
│   └── api/
│       ├── upload/route.ts       # POST: accept image, save to /tmp
│       ├── suggest/route.ts      # POST: run SLIC or Claude
│       └── export/route.ts       # POST: render and return JPEG
├── components/
│   ├── Upload.tsx                # Drag-and-drop upload zone
│   ├── Editor/
│   │   ├── index.tsx             # Editor root — assembles panels
│   │   ├── Canvas.tsx            # Konva stage + layers
│   │   ├── EyedropperLayer.tsx   # Markers, swatches, connectors
│   │   ├── LabelLayer.tsx        # Draggable text labels
│   │   └── useEyedroppers.ts     # State + interaction logic
│   ├── StylePicker.tsx           # Horizontal style thumbnail scroll
│   ├── LabelPanel.tsx            # Right panel: per-label controls
│   └── ExportButton.tsx
├── lib/
│   ├── swatch-layout.ts          # Edge assignment + no-crossing sort (ported from Python)
│   ├── color-sample.ts           # Sample color from ImageData at x,y
│   ├── canvas-to-916.ts          # Pad image to 9:16, return dimensions
│   └── styles.ts                 # Load and type styles.json
├── scripts/
│   ├── slic_suggest.py           # SLIC superpixel point detection
│   └── requirements.txt          # numpy, scikit-image, Pillow
├── styles.json                   # Style definitions
└── public/
    └── fonts/                    # Any bundled fonts for export
```

## Data flow

### Upload
```
User drops file
  → /api/upload (multipart)
  → saves original to /tmp/<uuid>/original.jpg
  → returns { id, width, height }
  → client navigates to /editor?id=<uuid>
```

### Suggest
```
Editor mounts
  → POST /api/suggest { id, method: "slic" }
  → server: spawn python slic_suggest.py /tmp/<uuid>/original.jpg
  → returns [{ x, y, color: "#rrggbb" }]
  → client places EyedropperPoint nodes on canvas
```

### Color sampling (client-side)
```
User drags marker to new position
  → color-sample.ts reads ImageData from a hidden <canvas> element
     (original image drawn once at load, never modified)
  → returns averaged RGB over 4px radius
  → swatch fill color updates live
```

### Export
```
User clicks Download
  → client: Konva stage.toDataURL({ pixelRatio: 2 })
  → POST /api/export { dataUrl }
  → server: returns as JPEG blob
  → browser triggers download
```

Alternative (higher quality): POST full state to /api/export, re-render server-side with Pillow.
Use client-side Konva export for v1 (simpler). Add server re-render if quality is insufficient.

## State shape

```typescript
// Global editor state (React context or Zustand)
interface EditorState {
  imageId: string
  imageWidth: number
  imageHeight: number
  canvasWidth: number    // = imageWidth
  canvasHeight: number   // = imageWidth * (16/9), padded
  imageOffsetY: number   // pixels from top where image starts in 9:16 canvas

  points: EyedropperPoint[]
  selectedPointId: string | null
  style: Style
  labelDefaults: LabelDefaults
}

interface EyedropperPoint {
  id: string
  x: number          // on original image
  y: number          // on original image
  color: string      // hex, sampled
  swatchSide: "auto" | "left" | "right" | "top" | "bottom"
  swatchOrder: number | null
  label: {
    text: string
    visible: boolean
    x: number        // on canvas (draggable)
    y: number
    fontSize: number
    fontFamily: string
    color: string
  }
}
```

## Key implementation notes

### No-crossing guarantee
`swatch-layout.ts` mirrors the Python logic exactly:
- Assign each point to nearest canvas edge (or respect `swatchSide`)
- Sort each edge group by source point coordinate (y for left/right, x for top/bottom)
- Spread evenly over the full edge length

This is pure math — no rendering needed. Run it any time points change.

### Live color sampling
At editor load, draw the original image onto a hidden `<canvas>` element at 1× scale.
On every marker drag, call `ctx.getImageData(x-4, y-4, 8, 8)` and average the RGBA values.
This never modifies the visible canvas — it's a read-only pixel buffer.

### Python scripts on Vercel
Vercel supports Python via `@vercel/python` runtime, but it's limited.
Simpler approach: the `/api/suggest` route runs `python3 scripts/slic_suggest.py` via `child_process.spawn`.
SLIC dependencies (scikit-image, numpy) must be in `requirements.txt` and available at runtime.

**Alternative**: Port SLIC to JS/WASM and run entirely client-side — avoids Python on server entirely.
`slic-js` or `@seregpie/superpixels` are available npm packages.
Recommended for v1: try JS port first, fall back to Python spawn if quality is insufficient.

### Claude suggestions
`/api/suggest` with `method: "claude"`:
```typescript
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
      { type: "text", text: SUGGEST_PROMPT }
    ]
  }]
})
```
Returns JSON array of `{ x, y, description }`. Parse and return to client.
If `ANTHROPIC_API_KEY` is unset, route returns 503 and client hides the Claude button.
