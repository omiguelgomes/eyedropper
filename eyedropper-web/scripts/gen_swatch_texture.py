#!/usr/bin/env python3
"""Generate the pastel colored-pencil swatch texture(s) for the `pastel` style.

Reproducible generator for `public/textures/swatch-pencil.png` (Story 3.6).

Why this exists
---------------
The `pastel` swatch is rendered (in `components/Editor/EyedropperLayer.tsx`) as:

    disc(sampledColor)
      x swatch-pencil.png (multiply)      # pencil striation darkens the disc
      n swatch-pencil.png (destination-in) # clip the disc to the feathered alpha
      + swatch-border.png (over)          # white chalk ring on top

So for every OPAQUE pixel of `swatch-pencil.png`, the visible result is
`disc_color x pencil_luminance`. If the pencil is opaque but near-white, the
multiply does nothing and the flat disc color shows through -> the "part
flat-colour circle, part pencil" split. The fix is to make the directional
pencil striation cover the WHOLE opaque footprint (only subtle density
variation, no strokeless patch, no flat rim) while keeping the darkest value
bounded so the sampled colour still reads faithfully.

Texture contract (must not break — the render pipeline is unchanged):
  * 256x256 RGBA, square (scaled to the swatch diameter at render time).
  * Striation lives in the LUMINANCE (grayscale, near-white with darker cores) —
    it is multiplied, so any colour here would tint every swatch.
  * Circular FEATHERED alpha — this is the visible mask (destination-in) and the
    soft edge; no hard flat rim.
  * Darkest value bounded: min luminance ~= MIN_LUM (<=~25% darken) so AC2 holds.

Run:
    cd eyedropper-web/scripts
    .venv/bin/python3 gen_swatch_texture.py
    # writes ../public/textures/swatch-pencil.png

Deterministic (fixed SEED) so re-running reproduces the identical asset.
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

# --- Tunables ---------------------------------------------------------------
SIZE = 256                 # output is SIZE x SIZE RGBA
SEED = 20260702            # fixed -> reproducible

# Alpha (visible mask) geometry, in pixels from centre.
DISC_R = 112               # radius where alpha is still fully opaque interior
FEATHER = 16               # soft rim width: alpha ramps 1->0 across this band

# Striation look.
BASE_ANGLE_DEG = -32.0     # dominant coloured-pencil stroke direction
ANGLE_JITTER_DEG = 14.0    # per-stroke angular spread around the base angle
GRID_STEP = 9.0            # seed spacing across the disc (smaller -> denser)
GRID_JITTER = 6.0          # random offset applied to each grid seed
STROKE_LEN = (16.0, 34.0)  # min/max stroke length (px)
DAB_STEP = 1.8             # spacing between gaussian dabs along a stroke (px)
DAB_SIGMA = 1.3            # cross-stroke softness of each dab (px)
DAB_AMP = (0.06, 0.13)     # per-dab darkness deposited (min/max, pre-clamp)

# Overall darkening budget. Final luminance = 1 - darkness, clamped so the
# darkest pencil core never dips below MIN_LUM (bounds AC2 faithfulness).
MIN_LUM = 0.75             # darkest allowed pencil value (<=25% darken)
BASE_DARK = (0.03, 0.06)   # subtle low-frequency floor so no pixel stays pure white
# ---------------------------------------------------------------------------


def _radial_alpha() -> np.ndarray:
    """Feathered circular alpha in [0,1], SIZE x SIZE."""
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    c = (SIZE - 1) / 2.0
    dist = np.hypot(xx - c, yy - c)
    # 1 inside DISC_R, ramps smoothly to 0 across FEATHER using smoothstep.
    t = (dist - DISC_R) / FEATHER
    t = np.clip(t, 0.0, 1.0)
    smooth = t * t * (3.0 - 2.0 * t)  # smoothstep
    return 1.0 - smooth


def _value_noise(coarse: np.ndarray) -> np.ndarray:
    """Smooth low-frequency noise in [0,1] via bilinear upsampling of a coarse grid."""
    # Bilinear upsample the coarse grid to SIZE x SIZE.
    img = Image.fromarray((coarse * 255).astype(np.uint8), mode="L")
    img = img.resize((SIZE, SIZE), resample=Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def _deposit_dab(dark: np.ndarray, cx: float, cy: float, amp: float, sigma: float) -> None:
    """Add a small gaussian darkness dab into `dark` (clamped to bounds later)."""
    rad = int(np.ceil(sigma * 3))
    x0, x1 = max(0, int(cx) - rad), min(SIZE, int(cx) + rad + 1)
    y0, y1 = max(0, int(cy) - rad), min(SIZE, int(cy) + rad + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    g = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2.0 * sigma * sigma)))
    dark[y0:y1, x0:x1] += amp * g


def generate_pencil() -> Image.Image:
    rng = np.random.default_rng(SEED)
    c = (SIZE - 1) / 2.0

    # 1) Subtle low-frequency floor so no interior pixel is pure white (removes
    #    the flat-colour band even between strokes) with gentle density variation.
    noise = _value_noise(rng.random((10, 10)).astype(np.float32))
    dark = BASE_DARK[0] + (BASE_DARK[1] - BASE_DARK[0]) * noise

    # 2) Directional strokes seeded on a jittered grid across the whole disc so
    #    coverage is uniform (no strokeless patch). Only seeds inside the disc.
    base = np.radians(BASE_ANGLE_DEG)
    coords = np.arange(c - DISC_R, c + DISC_R + GRID_STEP, GRID_STEP)
    for gy in coords:
        for gx in coords:
            sx = gx + rng.uniform(-GRID_JITTER, GRID_JITTER)
            sy = gy + rng.uniform(-GRID_JITTER, GRID_JITTER)
            if np.hypot(sx - c, sy - c) > DISC_R + 2:
                continue
            angle = base + np.radians(rng.uniform(-ANGLE_JITTER_DEG, ANGLE_JITTER_DEG))
            length = rng.uniform(*STROKE_LEN)
            amp = rng.uniform(*DAB_AMP)
            dx, dy = np.cos(angle), np.sin(angle)
            # Centre the stroke on the seed.
            n = max(1, int(length / DAB_STEP))
            for k in range(n + 1):
                t = (k / n - 0.5) * length
                _deposit_dab(dark, sx + dx * t, sy + dy * t, amp / 3.0, DAB_SIGMA)

    # 3) Clamp darkness to the budget -> luminance floor MIN_LUM.
    dark = np.clip(dark, 0.0, 1.0 - MIN_LUM)
    lum = 1.0 - dark

    alpha = _radial_alpha()

    rgb = np.clip(lum * 255.0, 0, 255).astype(np.uint8)
    a = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    out = np.dstack([rgb, rgb, rgb, a])
    return Image.fromarray(out, mode="RGBA")


# --- Border ring tunables ---------------------------------------------------
# The border is a rough white chalk RING drawn `over` (RGB is white; the ring
# shape lives entirely in the ALPHA). To read as CHALK — not a hard vector line —
# tiny low-opacity dabs are SCATTERED across a soft radial band. Each dab's
# radius is drawn from a normal distribution about RING_R, so density is highest
# at the centreline and fades out both ways: the inner and outer edges feather
# on their own (no hard rim). Dabs are spread evenly around 360° for symmetry,
# then a speckle GRAIN mask punches gaps so the stroke breaks up like real chalk.
RING_R = 120.0             # mean ring radius (px from centre); sits at swatch edge
RING_WIDTH = 6.0           # radial std-dev of dab scatter (px) — band softness
RING_SIGMA = 1.6           # per-dab size (px) — small so grain reads as chalk dust
RING_DABS = 9000           # many faint dabs build the grainy band
RING_AMP = (0.05, 0.16)    # per-dab alpha deposited (min/max) — low, builds up
GRAIN_STEP = 3.0           # speckle cell size (px); smaller -> finer chalk grain
GRAIN_FLOOR = 0.35         # grain multiplies alpha in [GRAIN_FLOOR, 1] -> broken coverage


# Thin-ring variant tunables — the `pastel ring` style. Same chalk technique,
# a much slimmer band: tighter radial scatter, fewer dabs (band area shrinks),
# smaller per-dab size so the grain still reads at the reduced width. Radius sits
# a touch inward so the slim ring hugs the disc edge rather than floating outside.
THIN_RING_R = 116.0        # mean ring radius (px) — nearer the disc edge
THIN_RING_WIDTH = 2.2      # radial std-dev (px) — much narrower band
THIN_RING_SIGMA = 1.2      # per-dab size (px)
THIN_RING_DABS = 5000      # fewer dabs for the smaller band area
THIN_RING_AMP = (0.05, 0.16)


def _make_border(
    ring_r: float, ring_width: float, ring_sigma: float, ring_dabs: int,
    ring_amp: tuple[float, float], seed_offset: int,
) -> Image.Image:
    """Symmetric grainy white chalk ring; shape carried by alpha, RGB pure white.

    Parameterized so the bold (default) and thin ring share one implementation —
    the only difference between the two assets is the band geometry passed in.
    """
    rng = np.random.default_rng(SEED + seed_offset)
    c = (SIZE - 1) / 2.0
    alpha = np.zeros((SIZE, SIZE), dtype=np.float32)

    # Evenly spread angles (statistical symmetry) with a full-jitter offset each,
    # radius scattered normally about the centreline so the band feathers.
    base_angles = np.linspace(0.0, 2.0 * np.pi, ring_dabs, endpoint=False)
    for a0 in base_angles:
        angle = a0 + rng.uniform(0.0, 2.0 * np.pi / ring_dabs)
        r = ring_r + rng.normal(0.0, ring_width)
        cx = c + r * np.cos(angle)
        cy = c + r * np.sin(angle)
        amp = rng.uniform(*ring_amp)
        _deposit_dab(alpha, cx, cy, amp, ring_sigma)

    # Speckle grain: fine value noise in [GRAIN_FLOOR, 1] multiplies the band so
    # coverage is broken and uneven — dusty chalk rather than a solid ring.
    coarse = rng.random((int(SIZE / GRAIN_STEP), int(SIZE / GRAIN_STEP))).astype(np.float32)
    grain = GRAIN_FLOOR + (1.0 - GRAIN_FLOOR) * _value_noise(coarse)
    alpha *= grain

    a = np.clip(alpha, 0.0, 1.0)
    rgb = np.full((SIZE, SIZE), 255, dtype=np.uint8)  # pure white chalk
    a8 = np.clip(a * 255.0, 0, 255).astype(np.uint8)
    out = np.dstack([rgb, rgb, rgb, a8])
    return Image.fromarray(out, mode="RGBA")


def generate_border() -> Image.Image:
    """The bold (default) chalk ring — swatch-border.png."""
    return _make_border(RING_R, RING_WIDTH, RING_SIGMA, RING_DABS, RING_AMP, 1)


def generate_thin_border() -> Image.Image:
    """The slim chalk ring — swatch-border-thin.png (`pastel ring` style)."""
    return _make_border(
        THIN_RING_R, THIN_RING_WIDTH, THIN_RING_SIGMA, THIN_RING_DABS, THIN_RING_AMP, 2
    )


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    tex_dir = os.path.normpath(os.path.join(here, "..", "public", "textures"))

    pencil_path = os.path.join(tex_dir, "swatch-pencil.png")
    img = generate_pencil()
    img.save(pencil_path)
    print(f"wrote {pencil_path}  ({img.width}x{img.height} {img.mode})")

    border_path = os.path.join(tex_dir, "swatch-border.png")
    border = generate_border()
    border.save(border_path)
    print(f"wrote {border_path}  ({border.width}x{border.height} {border.mode})")

    thin_path = os.path.join(tex_dir, "swatch-border-thin.png")
    thin = generate_thin_border()
    thin.save(thin_path)
    print(f"wrote {thin_path}  ({thin.width}x{thin.height} {thin.mode})")


if __name__ == "__main__":
    main()
