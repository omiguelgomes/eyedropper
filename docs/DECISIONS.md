# Design Decisions & Tradeoffs

## Why Konva.js over plain Canvas API
Konva gives us free hit-testing, drag-and-drop, layer management, and `toDataURL` export without writing any of that from scratch. The plain Canvas API would require reimplementing all interaction logic manually. Tradeoff: ~200KB bundle addition. Worth it.

## Why not Fabric.js
Fabric is older, heavier, and has a more complex API for what we need. Konva is more actively maintained and React-native. Either would work.

## Why export via `stage.toDataURL()` (client-side) instead of server re-render
Simpler for v1. The Konva stage is the source of truth — exporting it directly guarantees what you see is what you get. Server re-render would require serializing the full canvas state and re-running the Pillow pipeline, which is more moving parts. If export quality is an issue (JPEG artifacts, font differences), add server re-render in v2.

## Why not store uploads in S3 / Vercel Blob
This app has no user accounts and no need for persistence. Uploads live in `/tmp` for 1 hour and are deleted by a cleanup cron. Keeps the setup to zero external services. If the app grows, add Vercel Blob storage then.

## Why Haiku for Claude suggestions, not Sonnet/Opus
Cost. Point detection is a simple vision task — identify colored regions. Haiku handles it well at ~$0.001 per image. Sonnet would be overkill and 10× more expensive at scale.

## Why SLIC in Python rather than porting to JS
The Python scikit-image SLIC implementation is battle-tested and already validated against the hand.jpeg test case. Porting to JS introduces risk. The Python script is ~50 lines and runs in ~200ms. If Vercel's Python support is problematic, there's a JS fallback option (`@seregpie/superpixels` npm package) documented in ARCHITECTURE.md.

## Why not use the existing Python Pillow script for export
The existing `color_eyedropper.py` is a good starting point but was designed for CLI use. For the web app, the canvas state is the source of truth (user has dragged things around, edited labels), so exporting from Konva directly is more correct. The Python rendering logic (bezier curves, swatch placement) is effectively replaced by the Konva layer.

## Swatch placement algorithm: ported from Python, not reimplemented
`swatch-layout.ts` is a direct port of `_assign_sides()` and `_place_swatches_aligned()` from the Python script. This ensures the no-crossing guarantee and visual consistency. Don't rewrite this from scratch.

## No-crossing guarantee approach
Swatches are sorted along each edge in the same order as their source markers. This makes it geometrically impossible for lines to cross. This is a hard requirement — don't relax it.

## Label dragging: free position, not edge-constrained
In the Python script, labels were constrained to be "inward" from the swatch. In the web app, labels are freely draggable to any position within the canvas. The user can see what looks good. This is simpler and more flexible.

## Desktop-only for v1
The editor requires precise drag interaction and enough screen space to see the canvas + sidebars. Mobile would require a completely different interaction model (touch, pinch-zoom, smaller panels). Not worth it for a personal-use tool.
