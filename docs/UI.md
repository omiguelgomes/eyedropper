# UI Spec

## Upload Page (`/`)

Full-screen centered layout. Clean, minimal.

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│         [  Drop image here  ]           │
│         [  or click to pick ]           │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

- Drop zone: dashed border, rounded, ~400×300px
- On hover: border brightens
- Accepts JPEG, PNG, max 20MB
- Shows filename + size after selection, then "Continue →" button

---

## Editor Page (`/editor`)

Three-panel layout, full viewport height, no scrolling.

```
┌──────────┬─────────────────────┬─────────────────┐
│          │                     │                 │
│  LEFT    │      CANVAS         │   RIGHT         │
│  SIDEBAR │      (9:16)         │   SIDEBAR       │
│          │                     │                 │
│          │                     │                 │
│          │                     │                 │
└──────────┴─────────────────────┴─────────────────┘
```

### Left sidebar (~200px)

**Suggest section**
```
Suggest points
[ SLIC (auto) ]
[ Claude ✦ ]       ← hidden if no API key
```

**Tools**
```
○  Add point       ← click mode
↖  Select/drag     ← default mode
```

**Style**
Horizontal thumbnail strip (or vertical list):
```
[ float_clean ] [ float ] [ grid ] [ minimal ]
```
Selected style is highlighted.

**Labels**
```
[ Edit labels ]    ← toggles label editing mode
```

---

### Canvas (center, flex-1)

The canvas is always 9:16 ratio.  
Width = min(viewport_width - sidebars, viewport_height * 9/16).  
Centered horizontally and vertically.

The image sits inside the canvas, padded to fill 9:16 (background color from image border).

**In default mode (Select/drag)**:
- Hover over marker → cursor: move
- Drag marker → moves sample point, live color update
- Drag swatch → moves swatch along its edge
- Right-click marker or swatch → context menu: "Remove point"
- Click empty canvas → nothing

**In add mode**:
- Cursor: crosshair over image area
- Click on image → places new marker, auto-samples color, adds swatch
- Right-click marker or swatch → context menu: "Remove point" (right-click removal is available in both modes)

**Visual elements** (drawn by Konva):
- Faint background fill (9:16 area outside image)
- Original image (never modified)
- Connector lines (curved bezier, per style)
- Swatch circles (filled, with white border)
- Marker rings (on image, at sampling point)
- Labels (draggable text, only in label editing mode)

---

### Right sidebar (~280px)

**Default (no point selected)**:
```
Export
[ Download 9:16 JPEG ]

─────────────────────
Selected point
(nothing selected)
```

**Point selected**:
```
Point #3
Color: ████  #8b5e52

Swatch side
[ auto ] [ left ] [ right ] [ top ] [ bottom ]

Remove
[ × Remove this point ]

─────────────────────
Export
[ Download 9:16 JPEG ]
```

**In label editing mode** (point selected):
```
Label
[________________]   ← text input

Font
[ Cormorant Garamond ▾ ]

Size  [──●──────]  24px

Color  [████]  #1e1e1e

[ ☐ Show label ]

─────────────────────
Apply to all labels
[ Font ] [ Size ] [ Color ]

─────────────────────
Export
[ Download 9:16 JPEG ]
```

---

## Style thumbnails

Each style thumbnail is a 60×80px miniature preview rendered at app load time (static, from a sample image). Shows the connector and swatch style at a glance.

---

## Font options

5 presets (loaded via Google Fonts / next/font):
1. Cormorant Garamond Italic — default, elegant
2. Playfair Display Italic
3. Inter — clean, modern
4. DM Serif Display
5. Libre Baskerville Italic

Plus: "System" (uses device default serif).

---

## Color palette (UI chrome)

| Token | Value |
|-------|-------|
| Background | `#fafaf9` (warm off-white) |
| Sidebar bg | `#f4f3f1` |
| Border | `#e8e5e0` |
| Text primary | `#1a1a1a` |
| Text secondary | `#6b6b6b` |
| Accent | `#c4956a` (warm terracotta) |
| Accent hover | `#b08050` |

Minimal, warm, editorial — suits an art context.

---

## Responsive

- Minimum supported width: 1024px (desktop only for now)
- Mobile: show "Open on desktop" message
- No tablet breakpoints needed for v1
