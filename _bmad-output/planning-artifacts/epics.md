---
stepsCompleted: ["step-01-validate-prerequisites", "step-01-confirmed", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - "docs/SPEC.md"
  - "docs/ARCHITECTURE.md"
  - "docs/UI.md"
  - "docs/DECISIONS.md"
---

# eyedropper - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Color Eyedropper Web App, decomposing the requirements from the PRD (SPEC.md), UX Design (UI.md), and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The app shall provide a drag-and-drop upload zone that accepts JPEG and PNG files up to 20MB.
FR2: After upload, the app shall redirect the user to `/editor?id=<upload_id>`.
FR3: The `/api/upload` endpoint shall save the original image to `/tmp/<uuid>/original.jpg` and return `{ id, width, height }`.
FR4: On editor load, the app shall automatically suggest eyedropper points using SLIC (default method).
FR5: The `/api/suggest` endpoint shall accept `{ id, method: "slic" | "claude" }` and return `{ points: [{ x, y, color }] }`.
FR6: SLIC point detection shall run via Python script, segment the image into superpixels, and return ~12 most color-diverse subject points, filtering out background-like colors.
FR7: If `ANTHROPIC_API_KEY` is set, the app shall offer Claude (`claude-haiku-4-5`) as an alternative suggestion method that returns points with x/y coordinates and short descriptions.
FR8: If `ANTHROPIC_API_KEY` is not set, the Claude suggestion button shall be hidden.
FR9: The editor shall display the original image (never modified) inside a 9:16 canvas frame.
FR10: Each eyedropper point shall consist of a ring marker on the image, a swatch circle on the canvas edge, and a connector line between them.
FR11: Dragging a marker shall move the sampling point and update the swatch color live (4px radius average sampling).
FR12: Dragging a swatch shall reposition it along its assigned canvas edge.
FR13: Clicking an empty area on the image in "add mode" shall create a new eyedropper point.
FR14: Right-clicking a marker or swatch shall show a context menu with a "Remove" option.
FR15: Clicking a swatch shall select it and show options in the right panel.
FR16: The swatch layout algorithm shall auto-assign each swatch to its nearest canvas edge and sort swatches along each edge in the spatial order of their markers (no-crossing guarantee).
FR17: The app shall support 4 built-in styles: `float_clean`, `float`, `grid`, `minimal`, defined in `styles.json`.
FR18: A style picker shall display thumbnail previews; the selected style shall be highlighted.
FR19: The app shall support a label editing mode where each swatch's label text is editable in a text field on the canvas.
FR20: Labels shall be freely draggable to any position within the canvas.
FR21: Per-label controls shall include: font family (5 presets + system), font size (12–48px), color, and visibility toggle.
FR22: Global label controls shall allow applying font, size, or color to all labels at once.
FR23: If Claude suggested descriptions, they shall pre-fill the label text fields.
FR24: The export shall produce a JPEG at quality 95, at 2× the uploaded image's width, in 9:16 ratio.
FR25: Export shall use `stage.toDataURL({ pixelRatio: 2 })` from the Konva stage (client-side for v1).
FR26: Clicking "Download" shall trigger a browser download of the exported JPEG.
FR27: The 9:16 canvas shall be padded with the background color detected from the image's border pixels.
FR28: Uploads shall be ephemeral — deleted after 1 hour, with no user accounts or database.

### NonFunctional Requirements

NFR1: The original image pixels shall never be modified at any point (upload, canvas display, export).
NFR2: The app shall work without an `ANTHROPIC_API_KEY` — SLIC is always available as the default.
NFR3: No user accounts and no database — the app is stateless beyond the ephemeral `/tmp` upload.
NFR4: The minimum supported screen width is 1024px (desktop-only for v1); mobile shows an "Open on desktop" message.
NFR5: The exported JPEG shall be 9:16 aspect ratio without exception.
NFR6: Swatch lines shall never cross (enforced by the no-crossing sort algorithm).
NFR7: The Python SLIC script shall run in approximately 200ms.
NFR8: JPEG export quality shall be 95, rendered at 2× pixel ratio for Retina/phone screens.
NFR9: The only required environment variable is `ANTHROPIC_API_KEY` (optional); all other config is static.
NFR10: The app shall be deployable on Vercel free tier.

### Additional Requirements

- **Project scaffold**: Next.js 15 App Router project with TypeScript, Tailwind CSS, Konva.js + react-konva, Sharp, Anthropic SDK. Structure must match the directory layout in ARCHITECTURE.md.
- **Python scripts**: `scripts/slic_suggest.py` and `scripts/requirements.txt` (numpy, scikit-image, Pillow) must be present and executable via `child_process.spawn` from the API route.
- **Hidden color sampling canvas**: A hidden `<canvas>` element must be loaded with the original image at mount for client-side pixel sampling; it is never rendered to the user.
- **`swatch-layout.ts`**: Must be a direct port of `_assign_sides()` and `_place_swatches_aligned()` from the Python script — no reimplementation from scratch.
- **`styles.json`**: Checked into repo; defines the 4 built-in styles with the schema from SPEC.md.
- **State management**: `EditorState` and `EyedropperPoint` interfaces from ARCHITECTURE.md must be implemented (React context or Zustand).
- **Claude API integration**: Use `claude-haiku-4-5-20251001`, return JSON `[{ x, y, description }]`; if key unset, `/api/suggest?method=claude` returns 503.
- **Cleanup cron**: Uploads in `/tmp` must be deleted after 1 hour (cron job or Vercel scheduled function).
- **`canvas-to-916.ts`**: Utility that pads image to 9:16, returning dimensions and `imageOffsetY`.
- **Font loading**: 5 Google Font presets loaded via `next/font` for use in label editing and export.

### UX Design Requirements

UX-DR1: Upload page shall be full-screen centered with a dashed-border rounded drop zone (~400×300px) that brightens on hover, shows filename+size after selection, and a "Continue →" button before navigating to editor.
UX-DR2: Editor layout shall be a fixed three-panel layout (left sidebar ~200px, center canvas flex-1, right sidebar ~280px) at full viewport height with no page scrolling.
UX-DR3: Left sidebar shall contain four distinct sections: Suggest (SLIC + optional Claude buttons), Tools (Add point / Select-drag mode toggle), Style (thumbnail strip of 4 styles), Labels (Edit labels toggle button).
UX-DR4: The canvas shall maintain a strict 9:16 ratio: `width = min(viewport_width - sidebars, viewport_height * 9/16)`, centered horizontally and vertically.
UX-DR5: In Select/drag mode: marker shows `cursor: move` on hover; drag marker moves sample point with live color update; drag swatch moves along edge; right-click shows "Remove point" context menu.
UX-DR6: In Add mode: cursor shows crosshair over image area; click places new marker, auto-samples color, and adds swatch.
UX-DR7: Right sidebar in default state (no point selected) shall show only the Export section with "Download 9:16 JPEG" button.
UX-DR8: Right sidebar with a point selected shall show: Point number, color swatch + hex value, Swatch side buttons (auto/left/right/top/bottom), Remove button, and Export section.
UX-DR9: Right sidebar in label editing mode (point selected) shall show: text input, font family dropdown (5 presets), font size slider (12–48px), color picker, visibility toggle, apply-to-all controls (Font/Size/Color), and Export section.
UX-DR10: Style thumbnails shall be 60×80px miniature previews rendered at app load from a sample image.
UX-DR11: UI color tokens shall use the defined palette: background `#fafaf9`, sidebar `#f4f3f1`, border `#e8e5e0`, text primary `#1a1a1a`, text secondary `#6b6b6b`, accent `#c4956a`, accent hover `#b08050`.
UX-DR12: Font presets shall include: Cormorant Garamond Italic (default), Playfair Display Italic, Inter, DM Serif Display, Libre Baskerville Italic, and System serif.

### FR Coverage Map

FR1: Epic 1 — Upload zone, JPEG/PNG ≤20MB
FR2: Epic 1 — Redirect to /editor?id=
FR3: Epic 1 — /api/upload endpoint
FR4: Epic 2 — Auto-suggest on editor load
FR5: Epic 2 — /api/suggest endpoint
FR6: Epic 2 — SLIC Python script
FR7: Epic 2 — Claude suggestion via Haiku
FR8: Epic 2 — Hide Claude button if no key
FR9: Epic 2 — 9:16 canvas with original image
FR10: Epic 2 — Ring marker + swatch + connector
FR11: Epic 2 — Drag marker → live color update
FR12: Epic 2 — Drag swatch along edge
FR13: Epic 2 — Click to add new point
FR14: Epic 2 — Right-click → Remove context menu
FR15: Epic 2 — Click swatch → select
FR16: Epic 2 — No-crossing swatch layout algorithm
FR17: Epic 3 — 4 built-in styles in styles.json
FR18: Epic 3 — Style thumbnail picker
FR19: Epic 3 — Label editing mode
FR20: Epic 3 — Labels freely draggable
FR21: Epic 3 — Per-label controls (font, size, color, visibility)
FR22: Epic 3 — Apply-to-all label controls
FR23: Epic 3 — Claude descriptions pre-fill labels
FR24: Epic 4 — JPEG quality 95, 2× pixel ratio
FR25: Epic 4 — Client-side Konva toDataURL() export
FR26: Epic 4 — Download button triggers browser download
FR27: Epic 1 — 9:16 padding with border-sampled background color
FR28: Epic 4 — Ephemeral uploads, 1-hour cleanup cron

## Epic List

### Epic 1: Foundation, Upload & Editor Shell
The user can upload a drawing and see it displayed correctly in a 9:16 editor canvas within the three-panel layout — the working skeleton that all subsequent epics build on.
**FRs covered:** FR1, FR2, FR3, FR27
**NFRs:** NFR3, NFR4, NFR9, NFR10
**UX-DRs:** UX-DR1, UX-DR2, UX-DR4, UX-DR11

### Epic 2: Color Point Detection & Interactive Editing
The user can auto-detect color points (SLIC always; Claude when key is set), then drag markers and swatches, add/remove points, and see colors update live — the core creative interaction of the app.
**FRs covered:** FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16
**NFRs:** NFR1, NFR2, NFR6, NFR7
**UX-DRs:** UX-DR3 (Suggest + Tools sections), UX-DR5, UX-DR6, UX-DR8

### Epic 3: Style System & Label Editing
The user can choose from 4 visual annotation styles and edit label text, font, size, and color per point — with Claude-provided descriptions pre-filling labels when available.
**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23
**UX-DRs:** UX-DR3 (Style + Labels sections), UX-DR9, UX-DR10, UX-DR12

### Epic 4: Export & Production Cleanup
The user can download a crisp 9:16 JPEG of their annotated drawing; uploads are automatically cleaned up after 1 hour.
**FRs covered:** FR24, FR25, FR26, FR28
**NFRs:** NFR5, NFR8
**UX-DRs:** UX-DR7

### Epic 5: Free Swatch Placement & Alignment
The user can drag swatches anywhere on the 9:16 canvas (not just along an edge), with CAD-style alignment snapping and guide lines so swatches can be composed freely yet kept tidy. Reworks the edge-locked swatch model established in Epic 2.
**Note:** Relaxes the "no swatch lines cross" non-negotiable (SPEC.md non-negotiable #3 / CLAUDE constraint #3) — the no-crossing guarantee now applies only to the generated initial layout; manual free placement is the artist's responsibility. Derived from deferred work recorded during Story 3.1 (see `deferred-work.md`).

---

## Epic 1: Foundation, Upload & Editor Shell

The user can upload a drawing and see it displayed correctly in a 9:16 editor canvas within the three-panel layout — the working skeleton that all subsequent epics build on.

### Story 1.1: Project Scaffold & Core Libraries

As a **developer**,
I want a configured Next.js 15 App Router project with all required dependencies and directory structure,
So that the codebase is ready for feature development with no setup gaps.

**Acceptance Criteria:**

**Given** a new repository
**When** `npm run dev` is run after setup
**Then** the dev server starts without errors

**Given** the project is set up
**When** `package.json` is inspected
**Then** it includes: `next@15`, `react-konva`, `konva`, `tailwindcss`, `sharp`, `@anthropic-ai/sdk`

**Given** the project is set up
**When** the directory structure is inspected
**Then** it matches the layout from ARCHITECTURE.md: `app/`, `components/Editor/`, `lib/`, `scripts/`, `styles.json`, `public/fonts/`

**Given** `lib/` exists
**When** its files are inspected
**Then** `color-sample.ts`, `canvas-to-916.ts`, `swatch-layout.ts` (stub), and `styles.ts` are present with the `EditorState` and `EyedropperPoint` TypeScript interfaces from ARCHITECTURE.md

**Given** `scripts/` exists
**When** its files are inspected
**Then** `slic_suggest.py` and `requirements.txt` (numpy, scikit-image, Pillow) are present

**Given** `styles.json` is present
**When** its contents are inspected
**Then** it contains the 4 built-in style definitions (`float_clean`, `float`, `grid`, `minimal`) with the complete schema from SPEC.md

**Given** Tailwind is configured
**When** `tailwind.config` or `globals.css` is inspected
**Then** the design token colors from UI.md (`#fafaf9`, `#f4f3f1`, `#e8e5e0`, `#1a1a1a`, `#6b6b6b`, `#c4956a`, `#b08050`) are defined as CSS variables or Tailwind theme extensions

---

### Story 1.2: Image Upload Page & API

As an **artist**,
I want to drag-and-drop or click to upload my drawing (JPEG/PNG ≤20MB),
So that I can start annotating it with color points.

**Acceptance Criteria:**

**Given** I open the app at `/`
**When** the page renders
**Then** I see a full-screen centered layout with a dashed-border rounded drop zone (~400×300px)

**Given** I hover over the drop zone
**When** my cursor is over it
**Then** the border brightens to the accent color (`#c4956a`)

**Given** I drop or select a valid JPEG or PNG file ≤20MB
**When** the file is accepted
**Then** the drop zone shows the filename and file size, and a "Continue →" button appears

**Given** I click "Continue →"
**When** the upload is submitted
**Then** the file is POSTed to `/api/upload` as multipart form data, the original file is saved to `/tmp/<uuid>/original.jpg`, and the browser redirects to `/editor?id=<uuid>` using the id returned by the API

**Given** `/api/upload` completes
**When** the response is inspected
**Then** it returns `{ id, width, height }` where width/height are the image's natural dimensions

**Given** I try to upload a file >20MB or a non-JPEG/PNG file
**When** the file is dropped or selected
**Then** I see a clear error message and the upload is rejected without calling the API

**Given** the screen width is <1024px
**When** the upload page loads
**Then** I see an "Open on desktop" message instead of the upload zone

---

### Story 1.3: Editor Shell & 9:16 Canvas

As an **artist**,
I want to see my uploaded image displayed inside a 9:16 canvas within a three-panel editor layout,
So that I can see the exact export frame before annotating.

**Acceptance Criteria:**

**Given** I navigate to `/editor?id=<uuid>`
**When** the page loads
**Then** I see the three-panel layout: left sidebar (~200px), center canvas (flex-1), right sidebar (~280px), all filling full viewport height with no page scrolling

**Given** the editor renders
**When** the canvas dimensions are measured
**Then** the canvas is 9:16 ratio: `width = min(viewport_width − sidebars, viewport_height × 9/16)`, centered horizontally and vertically

**Given** the editor loads the image
**When** the image is displayed
**Then** it is padded to fill the 9:16 frame using the background color detected from the image's border pixels (`canvas-to-916.ts`); the original image pixels are never cropped, color-adjusted, or resized

**Given** all UI chrome is rendered
**When** colors are inspected
**Then** they use the design tokens: background `#fafaf9`, sidebar bg `#f4f3f1`, borders `#e8e5e0`, primary text `#1a1a1a`, secondary text `#6b6b6b`, accent `#c4956a`

**Given** the right sidebar renders with no point selected
**When** its contents are checked
**Then** only the Export section is visible with a "Download 9:16 JPEG" button (non-functional placeholder in this story)

**Given** the left sidebar renders
**When** its contents are checked
**Then** placeholder sections for Suggest, Tools, Style, and Labels are visible as stubs

**Given** the screen width is <1024px on the editor page
**When** the page loads
**Then** I see an "Open on desktop" message

---

## Epic 2: Color Point Detection & Interactive Editing

The user can auto-detect color points (SLIC always; Claude when key is set), then drag markers and swatches, add/remove points, and see colors update live — the core creative interaction of the app.

### Story 2.1: SLIC Point Suggestion via Python

As an **artist**,
I want the editor to automatically suggest ~12 color points from my image on load using SLIC,
So that I have a useful starting palette without any manual work.

**Acceptance Criteria:**

**Given** I arrive at `/editor?id=<uuid>`
**When** the editor finishes loading
**Then** `/api/suggest` is called automatically with `{ id, method: "slic" }`

**Given** `/api/suggest` is called with `method: "slic"`
**When** the server handles the request
**Then** it spawns `python3 scripts/slic_suggest.py /tmp/<uuid>/original.jpg` via `child_process.spawn` and returns `{ points: [{ x, y, color }] }` where `color` is a hex string

**Given** the SLIC script runs
**When** it returns results
**Then** it returns approximately 12 points representing color-diverse subject areas, with background-like colors (similar to border-sampled background) filtered out

**Given** SLIC returns points
**When** the client receives them
**Then** eyedropper point nodes are placed on the canvas at the returned coordinates with the returned colors

**Given** the left sidebar "Suggest" section is rendered
**When** SLIC is running
**Then** the "SLIC (auto)" button shows a loading state; when complete, it returns to its default state

---

### Story 2.2: Claude Point Suggestion (Optional)

As an **artist**,
I want to optionally re-suggest points using Claude for richer, description-annotated results,
So that I get smarter color zone detection with label text pre-filled.

**Acceptance Criteria:**

**Given** `ANTHROPIC_API_KEY` is set in the environment
**When** the left sidebar "Suggest" section renders
**Then** a "Claude ✦" button is visible alongside the SLIC button

**Given** `ANTHROPIC_API_KEY` is not set
**When** the left sidebar "Suggest" section renders
**Then** the "Claude ✦" button is not rendered at all

**Given** I click "Claude ✦"
**When** the request is sent
**Then** `/api/suggest` is called with `{ id, method: "claude" }`, the server calls `claude-haiku-4-5-20251001` with the image as base64, and the response is parsed as `[{ x, y, description }]`

**Given** Claude returns points
**When** they are applied
**Then** existing points are replaced; each point's `label.text` is pre-filled with the description from Claude

**Given** `/api/suggest` is called with `method: "claude"` but `ANTHROPIC_API_KEY` is not set
**When** the server handles the request
**Then** it returns HTTP 503

**Given** I click "Claude ✦"
**When** the request is in-flight
**Then** the button shows a loading state; on completion or error, it returns to its default state

---

### Story 2.3: Eyedropper Points Rendering & Color Sampling

As an **artist**,
I want to see each suggested color point rendered as a ring marker on the image connected to a swatch circle on the canvas edge,
So that I can visually associate each swatch with its source location on the drawing.

**Acceptance Criteria:**

**Given** points are loaded (from SLIC or Claude)
**When** the `EyedropperLayer` renders
**Then** each point shows: a ring marker (~12px radius, white) at its `(x, y)` on the image, a swatch circle (~40px radius, filled with sampled color, white border) on the canvas edge, and a connector line between them per the current style

**Given** the editor mounts
**When** the image is loaded into the Konva stage
**Then** a hidden `<canvas>` element is also populated with the original image at 1× scale for pixel sampling — this element is not visible to the user

**Given** a point exists at `(x, y)`
**When** `color-sample.ts` is called
**Then** it reads an 8×8 pixel area centred on `(x, y)` from the hidden canvas using `ctx.getImageData(x-4, y-4, 8, 8)` and returns the averaged RGB as a hex string

**Given** `swatch-layout.ts` is invoked with the current points
**When** it runs
**Then** each swatch is assigned to its nearest canvas edge and swatches on each edge are sorted in the spatial order of their source markers (no lines cross), spread evenly along the full edge

---

### Story 2.4: Drag Markers & Live Color Update

As an **artist**,
I want to drag a ring marker to a new position on the image,
So that I can precisely choose which pixel area a swatch represents.

**Acceptance Criteria:**

**Given** I am in Select/drag mode
**When** I hover over a ring marker
**Then** the cursor changes to `move`

**Given** I drag a ring marker to a new position
**When** the drag updates
**Then** the marker moves to the new position, `color-sample.ts` re-samples the color at the new coordinates, and the connected swatch fill color updates live during the drag

**Given** I drag a marker to a new position
**When** the drag ends
**Then** `swatch-layout.ts` is re-run to recalculate all swatch edge assignments and positions, maintaining the no-crossing guarantee

**Given** I drag a marker outside the image bounds
**When** the drag ends
**Then** the marker snaps back to the nearest valid point within the image area

---

### Story 2.5: Drag Swatches Along Edge

As an **artist**,
I want to drag a swatch circle to reposition it along its canvas edge,
So that I can fine-tune the layout before exporting.

**Acceptance Criteria:**

**Given** I am in Select/drag mode
**When** I drag a swatch circle
**Then** the swatch moves along its assigned canvas edge only — it cannot be dragged to a different edge or off the edge

**Given** I drag a swatch
**When** the drag ends
**Then** the swatch's `swatchOrder` is updated to reflect its new position; the connector line from the marker updates accordingly

**Given** I drag a swatch that would overlap another swatch on the same edge
**When** the drag ends
**Then** the other swatches on that edge are redistributed to avoid overlap while maintaining their relative order

---

### Story 2.6: Add & Remove Points

As an **artist**,
I want to add new color points by clicking on the image and remove any point via right-click,
So that I can fully customise which colors are annotated.

**Acceptance Criteria:**

**Given** I click "Add point" in the left sidebar Tools section
**When** the mode changes
**Then** the cursor shows a crosshair when hovering over the image area

**Given** I am in Add mode and click on the image
**When** the click is registered
**Then** a new `EyedropperPoint` is created at the clicked coordinates, its color is sampled immediately via `color-sample.ts`, a swatch is added, and `swatch-layout.ts` is re-run

**Given** I right-click on a ring marker
**When** the context menu appears
**Then** it shows a single option: "Remove point"

**Given** I right-click on a swatch circle
**When** the context menu appears
**Then** it shows a single option: "Remove point"

**Given** I select "Remove point" from the context menu
**When** the action is confirmed
**Then** the point (marker, swatch, connector) is removed and `swatch-layout.ts` is re-run for the remaining points

---

### Story 2.7: Point Selection & Right Panel State

As an **artist**,
I want to click a swatch to select it and see its details in the right panel,
So that I can inspect and adjust individual point properties.

**Acceptance Criteria:**

**Given** I click a swatch circle
**When** it becomes selected
**Then** the right sidebar updates to show: "Point #N", the color hex value with a filled swatch preview, swatch side buttons (auto / left / right / top / bottom) with the current assignment highlighted, and a "× Remove this point" button

**Given** a point is selected and I click a swatch side button
**When** the button is pressed
**Then** the point's `swatchSide` is updated to the chosen value (overriding auto-assignment) and `swatch-layout.ts` is re-run

**Given** a point is selected and I click "× Remove this point"
**When** the action completes
**Then** the point is removed identically to the right-click → Remove flow (Story 2.6)

**Given** I click on empty canvas space (not a marker or swatch)
**When** the click registers
**Then** the selection is cleared and the right panel returns to the default "no point selected" state showing only the Export section

---

## Epic 3: Style System & Label Editing

The user can choose from 4 visual annotation styles and edit label text, font, size, and color per point — with Claude-provided descriptions pre-filling labels when available.

### Story 3.1: Style Picker & Live Style Switching

As an **artist**,
I want to pick from 4 built-in annotation styles and see the canvas update instantly,
So that I can choose the visual look that best suits my drawing before exporting.

**Acceptance Criteria:**

**Given** the editor loads
**When** the left sidebar Style section renders
**Then** it shows a horizontal thumbnail strip with one 60×80px preview per style: `float_clean`, `float`, `grid`, `minimal`; the active style is highlighted with the accent color border

**Given** the style thumbnails render
**When** they are generated
**Then** each is a miniature preview rendered from a sample image at app load time, showing the connector type and swatch style at a glance

**Given** I click a style thumbnail
**When** the selection changes
**Then** the Konva canvas immediately redraws all connectors, swatch borders, and markers using the new style's properties (connector type, colors, widths, marker style) without a page reload

**Given** `styles.json` is loaded
**When** `lib/styles.ts` parses it
**Then** all 4 style objects are typed and available with the full schema: `swatchRadius`, `swatchBorderColor`, `swatchBorderWidth`, `connectorType`, `connectorColor`, `connectorWidth`, `markerStyle`, `markerColor`, `labelPosition`

---

### Story 3.2: Label Editing Mode & Text Input

As an **artist**,
I want to switch into label editing mode and type custom text for each color swatch,
So that I can name each color zone for my audience.

**Acceptance Criteria:**

**Given** I click "Edit labels" in the left sidebar Labels section
**When** label editing mode activates
**Then** the canvas switches to show editable text labels next to each swatch; the "Edit labels" button appears toggled/active

**Given** I am in label editing mode and a point has a label
**When** the `LabelLayer` renders
**Then** each swatch with a visible label shows its `label.text` as an editable text field on the canvas at the label's `(x, y)` position

**Given** Claude suggestions were used
**When** label editing mode is first entered
**Then** each label's text field is pre-filled with the description returned by Claude for that point

**Given** I type in a label text field
**When** the input changes
**Then** the `EyedropperPoint.label.text` is updated in state and the canvas label re-renders with the new text immediately

**Given** I click "Edit labels" again while in label editing mode
**When** the toggle is pressed
**Then** label editing mode deactivates; labels remain on the canvas as static text per the current style's `labelPosition` setting

---

### Story 3.3: Label Dragging & Per-Label Controls

As an **artist**,
I want to drag labels freely on the canvas and control their font, size, color, and visibility individually,
So that I can achieve a polished, publication-ready layout.

**Acceptance Criteria:**

**Given** I am in label editing mode
**When** I drag a label text element on the canvas
**Then** it moves freely to any position within the canvas bounds; its `label.x` and `label.y` are updated in state

**Given** I select a point while in label editing mode
**When** the right sidebar renders
**Then** it shows the label controls: text input, font family dropdown (6 options: 5 Google Font presets + System), font size slider (12–48px), color picker, and a "Show label" checkbox

**Given** I change the font family for a selected point's label
**When** the dropdown value changes
**Then** `label.fontFamily` updates and the canvas label re-renders with the new font immediately

**Given** I move the font size slider
**When** the slider value changes
**Then** `label.fontSize` updates and the canvas label re-renders at the new size immediately

**Given** I change the label color
**When** the color picker value changes
**Then** `label.color` updates and the canvas label re-renders with the new color immediately

**Given** I uncheck "Show label"
**When** the checkbox changes
**Then** `label.visible` is set to `false` and the label is hidden on the canvas and excluded from export

**Given** the font presets are loaded
**When** the font family dropdown renders
**Then** it lists: Cormorant Garamond Italic (default), Playfair Display Italic, Inter, DM Serif Display, Libre Baskerville Italic, and System; all Google Fonts are loaded via `next/font`

---

### Story 3.4: Apply-to-All Label Controls

As an **artist**,
I want to apply a font, size, or color setting to all labels at once,
So that I can quickly achieve a consistent typographic style across the whole palette.

**Acceptance Criteria:**

**Given** I am in label editing mode with the right sidebar visible
**When** the "Apply to all labels" section renders
**Then** it shows three buttons: "Font", "Size", "Color"

**Given** a point is selected with a specific font family set
**When** I click "Font" under "Apply to all labels"
**Then** every point's `label.fontFamily` is updated to match the selected point's font family; the canvas re-renders all labels with the new font

**Given** a point is selected with a specific font size set
**When** I click "Size" under "Apply to all labels"
**Then** every point's `label.fontSize` is updated to match the selected point's font size; the canvas re-renders all labels at the new size

**Given** a point is selected with a specific label color set
**When** I click "Color" under "Apply to all labels"
**Then** every point's `label.color` is updated to match the selected point's color; the canvas re-renders all labels with the new color

---

## Epic 4: Export & Production Cleanup

The user can download a crisp 9:16 JPEG of their annotated drawing; uploads are automatically cleaned up after 1 hour.

### Story 4.1: JPEG Export & Download

As an **artist**,
I want to click "Download 9:16 JPEG" and get an instant, crisp download of my annotated canvas,
So that I can post the final image to Instagram or TikTok.

**Acceptance Criteria:**

**Given** the editor has points, styles, and labels configured
**When** I click "Download 9:16 JPEG" in the right sidebar
**Then** `stage.toDataURL({ pixelRatio: 2 })` is called on the Konva stage, the result is POSTed to `/api/export`, and the server returns a JPEG blob

**Given** `/api/export` receives the data URL
**When** it processes the request
**Then** it converts the data URL to a JPEG at quality 95 using Sharp and returns it as a `image/jpeg` response

**Given** the browser receives the JPEG response
**When** the download is triggered
**Then** the browser saves the file (e.g. `eyedropper-export.jpg`) without opening a new tab

**Given** the exported image is inspected
**When** its dimensions are measured
**Then** it is 9:16 aspect ratio at 2× the original uploaded image's width (e.g. original 800px wide → export 1600×2844px)

**Given** the right sidebar renders with no point selected
**When** it is inspected
**Then** "Download 9:16 JPEG" is the only element shown in the Export section (the button is always visible regardless of selection state)

**Given** the export is in-flight
**When** the button state is checked
**Then** the button shows a loading/disabled state; on completion it returns to its default state

---

### Story 4.2: Upload Cleanup Cron

As a **system operator**,
I want uploaded files in `/tmp` to be automatically deleted after 1 hour,
So that the server does not accumulate stale files from past sessions.

**Acceptance Criteria:**

**Given** a Vercel scheduled function (or equivalent cron) is configured
**When** it runs
**Then** it scans `/tmp` for upload directories older than 1 hour and deletes them

**Given** a directory in `/tmp/<uuid>/` was created more than 1 hour ago
**When** the cleanup runs
**Then** the entire `<uuid>/` directory and its contents are deleted

**Given** a directory in `/tmp/<uuid>/` was created less than 1 hour ago
**When** the cleanup runs
**Then** it is left untouched

**Given** the cron is deployed to Vercel
**When** the project is inspected
**Then** a `vercel.json` cron entry (or equivalent) is present that schedules the cleanup function to run at least once per hour

---

## Epic 5: Free Swatch Placement & Alignment

The user can drag swatches anywhere on the 9:16 canvas with CAD-style alignment snapping, replacing the edge-locked model from Epic 2. Generation and the initial auto-layout stay exactly as today; the change is purely in how swatches move after generation.

**Decided design (from grilling, 2026-06-30):**
- Edges become *initial layout only*. Generation/auto-layout is unchanged; the first time a swatch is dragged it detaches from its edge and gains an absolute `(x, y)` on the canvas.
- The "no connector lines cross" guarantee is dropped for manually-placed swatches (still holds for the generated layout). SPEC non-negotiable #3 / CLAUDE constraint #3 to be relaxed accordingly.
- Swatches may be placed anywhere within the 9:16 canvas (including the letterbox padding), clamped to canvas bounds. Swatch-on-swatch overlap is prevented by **blocking the drop** (stop at nearest non-overlapping position) — no push-aside, no cascading.
- The "Swatch side" control (auto/left/right/top/bottom) is removed from the right panel.
- Re-layout rules: re-suggest replaces all points (fresh auto layout); adding a point auto-places only the new one; switching style and removing a point preserve existing manual positions.
- Snapping (Story 5.2) is soft (small pixel threshold, pull away to escape) with no modifier override and no toggle; snap targets are other swatches' center X/Y, even spacing/distribution, canvas edges + centerlines, and the swatch's own marker; CAD/Figma-style guide lines are drawn during the drag.

### Story 5.1: Free-Floating Swatch Placement

As an **artist**,
I want to drag a swatch to any position on the 9:16 canvas instead of only along its edge,
So that I can compose the layout freely rather than being constrained to the four edges.

**Acceptance Criteria:**

**Given** I am in Select/drag mode
**When** I drag a swatch circle
**Then** the swatch moves freely in two dimensions and can be dropped at any position within the 9:16 canvas (including over the image and in the letterbox padding), clamped so the swatch stays fully inside the canvas

**Given** I have not yet dragged a swatch
**When** points are generated (SLIC/Claude) or a new point is added
**Then** the swatch is placed by the existing auto edge-layout exactly as before this story

**Given** I drag a swatch for the first time
**When** the drag ends
**Then** the swatch is stored as a free-floating swatch with an absolute canvas `(x, y)` and no longer participates in edge redistribution; its connector line from the marker follows the new position

**Given** I drop a swatch where it would overlap another swatch
**When** the drag ends
**Then** the drop is blocked — the swatch settles at the nearest position that does not overlap any other swatch (no other swatch is moved)

**Given** I have manually placed one or more swatches
**When** I switch style, or remove a different point
**Then** the manually-placed swatches keep their positions (no auto re-layout is run)

**Given** I have manually placed one or more swatches
**When** I re-run a suggestion (SLIC/Claude)
**Then** all points are replaced and laid out fresh by the auto edge-layout (manual positions are not preserved, since the point set is entirely new)

**Given** a swatch is selected in Select/drag mode
**When** I view the right panel
**Then** the "Swatch side" (auto/left/right/top/bottom) control is no longer shown

**Given** swatches have been freely placed such that connector lines cross
**When** I view or export the canvas
**Then** the crossing lines are allowed (the no-crossing guarantee applies only to the generated initial layout)

### Story 5.2: CAD-Style Alignment Snapping & Guides

As an **artist**,
I want swatches to snap into alignment with other swatches, the canvas, and their own markers while I drag them, with guide lines showing the alignment,
So that I can keep a freely-composed layout tidy and visually aligned without manual pixel-nudging.

**Acceptance Criteria:**

**Given** I am dragging a free-floating swatch
**When** its center comes within a small pixel threshold of sharing an X or Y coordinate with another swatch's center
**Then** the swatch snaps to that shared coordinate, and a guide line is drawn through the aligned centers

**Given** I am dragging a free-floating swatch
**When** it reaches a position where the spacing between three or more swatches becomes equal
**Then** the swatch snaps to the equal-spacing position and a distribution guide is shown

**Given** I am dragging a free-floating swatch
**When** its center approaches a canvas edge or the horizontal/vertical centerline of the 9:16 frame
**Then** the swatch snaps to that edge/centerline and a guide line is shown

**Given** I am dragging a free-floating swatch
**When** its center aligns horizontally or vertically with its own marker on the image
**Then** the swatch snaps to that alignment and a guide line is shown

**Given** a swatch has snapped to an alignment
**When** I keep dragging past the snap threshold
**Then** the swatch pulls away freely (soft snap — no modifier key needed to escape)

**Given** I release a swatch after any snap
**When** the drag ends
**Then** all guide lines disappear and the swatch stays at its final position; overlap-blocking from Story 5.1 still applies

---
