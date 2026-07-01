# Swatch textures (pastel / colored-pencil style)

Assets extracted from the artist's annotated hand study
(`~/Downloads/WhatsApp Image 2026-06-11 at 12.50.04.jpeg`, the red top-row
swatch) for a future "pastel" swatch style. They let a swatch keep the
per-point **sampled color** while gaining the colored-pencil scribble fill and
rough chalk-ring border seen in the artist's examples.

Both are **256×256 RGBA, tintable** — they carry texture/shape, not color.

| file | what it is | how to use |
|------|-----------|-----------|
| `swatch-pencil.png` | Near-white grayscale directional scribble, circular alpha (feathered rim). | **Multiply** over a solid disc filled with the point's sampled color, then mask by its own alpha. Darkest stroke ≈ 22% darken, so the tint stays faithful. |
| `swatch-border.png` | White rough chalk ring, transparent elsewhere. | Draw **on top** of the filled swatch, as-is (no tint). It is white like the source; recolor by multiplying if a non-white border is ever wanted. |

## Intended render (mirrors the sharp preview used to validate the assets)

```
disc(sampledColor)               // solid fill
  × swatch-pencil.png (multiply) // pencil striation
  ∩ swatch-pencil.png (alpha)    // clip to the feathered circle
  + swatch-border.png (over)     // rough chalk ring on top
```

In Konva this is an image node (or two) rather than the current `Circle`:
`fill = sampledColor` disc → a `Konva.Image` of `swatch-pencil` with
`globalCompositeOperation="multiply"` → a `Konva.Image` of `swatch-border` on
top. This needs **new `Style` fields** (e.g. `swatchTexture`, `borderTexture`)
and new rendering in `EyedropperLayer.tsx` — the current renderer only draws a
flat `fill` + crisp `stroke` `Circle` and has no texture support. That is the
work of the deferred "custom styles" story
(`_bmad-output/implementation-artifacts/deferred-work.md`).

## Regeneration

Source crop + generator are transient (were run from the project dir so `sharp`
resolves). Center/radius constants and the luminance normalization live in the
generator; re-extract from the same JPEG if the look needs tweaking.

## Companion font

The labels in the artist's examples are neat print handwriting. It **cannot be
extracted from a JPEG** — the matched Google font is **Caveat** (upright,
marker-like). Wire it into `lib/fonts.ts` (`Caveat` from `next/font/google`) as
part of the style story, not before — an unused font import would be dead code
today.
