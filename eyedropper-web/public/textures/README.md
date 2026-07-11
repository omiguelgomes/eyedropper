# Swatch textures (pastel / colored-pencil style)

Assets for the `pastel` swatch style. They let a swatch keep the per-point
**sampled color** while gaining the colored-pencil striation fill and rough
chalk-ring border seen in the artist's examples.

`swatch-pencil.png` is **synthesized procedurally** by the committed generator
`../../scripts/gen_swatch_texture.py` (Story 3.6). `swatch-border.png` was
extracted from the artist's annotated hand study
(`~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg`, the red top-row
swatch).

Both are **256×256 RGBA, tintable** — they carry texture/shape via luminance +
alpha, not color.

| file | what it is | how to use |
|------|-----------|-----------|
| `swatch-pencil.png` | Near-white grayscale **directional pencil striation covering the whole disc** (subtle density variation, no strokeless patch, no flat rim), on a feathered circular alpha. | **Multiply** over a solid disc filled with the point's sampled color, then mask by its own alpha. Darkest stroke core ≈ 25% darken (min luminance ≈ 0.75) at only a few percent of pixels; mean darkening ≈ 10%, so the tint stays faithful across light/mid/dark colors. |
| `swatch-border.png` | White rough chalk ring, transparent elsewhere. | Draw **on top** of the filled swatch, as-is (no tint). It is white like the source; recolor by multiplying if a non-white border is ever wanted. |

**Why the striation must cover the whole opaque footprint:** the render
multiplies the disc color by the pencil luminance for every opaque pixel. Where
the pencil is opaque but near-white (≈1.0) the multiply does nothing and the
flat disc color shows through. The old asset had a large near-white opaque
region → the swatch split into "part flat colour, part pencil". The current
asset carries darker directional strokes across the entire disc (Story 3.6), so
the whole face reads as pencil.

## Render pipeline (shipped — `pastel` style, Story 3.5 + 3.6)

```
disc(sampledColor)                     // solid fill
  × swatch-pencil.png (multiply)       // pencil striation
  ∩ swatch-pencil.png (destination-in) // clip to the feathered circle
  + swatch-border.png (over)           // rough chalk ring on top
```

Implemented in `components/Editor/EyedropperLayer.tsx` (`TexturedSwatch`): a
`Konva.Circle` filled with the sampled color, then a `Konva.Image` of
`swatch-pencil` with `globalCompositeOperation="multiply"`, the same image again
with `"destination-in"` to clip to the feathered alpha, then a `Konva.Image` of
`swatch-border` on top. All inside a **cached `Group`** so the multiply
composites within the group's own offscreen buffer and never tints the photo or
neighbouring swatches. The `pastel` entry in `styles.json` carries the
`swatchTexture` / `borderTexture` paths that point here. **Do not change this
pipeline to tune the look — regenerate the asset instead** (that is what Story
3.6 did).

## Regeneration

`swatch-pencil.png` is fully reproducible:

```bash
cd eyedropper-web/scripts
.venv/bin/python3 gen_swatch_texture.py   # writes ../public/textures/swatch-pencil.png
```

The generator (`gen_swatch_texture.py`) is deterministic (fixed `SEED`) and
depends only on `numpy` + `Pillow` (in `scripts/.venv`) — no external JPEG. It
synthesizes many short directional strokes across the whole disc, applies a
feathered radial alpha, and clamps the darkest value to `MIN_LUM` (≈0.75). Tune
the look via the constants at the top of the script (stroke density, angle,
darkening budget) and re-run.

`swatch-border.png` is still the extracted chalk ring (not regenerated in Story
3.6). Re-extract from the source JPEG if it ever needs work.

## Companion font

The labels in the artist's examples are neat print handwriting. It **cannot be
extracted from a JPEG** — the matched Google font is **Caveat** (upright,
marker-like). Wire it into `lib/fonts.ts` (`Caveat` from `next/font/google`) as
part of the style story, not before — an unused font import would be dead code
today.
