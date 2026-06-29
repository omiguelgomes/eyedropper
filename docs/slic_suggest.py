#!/usr/bin/env python3
"""
SLIC-based color point suggestion.
Usage: python slic_suggest.py <image_path> [--n <count>]
Output: JSON array of { x, y, color } to stdout
"""
import sys
import json
import argparse
import numpy as np
from PIL import Image
from skimage.segmentation import slic
from skimage.util import img_as_float

def sample_bg_color(img_np):
    h, w = img_np.shape[:2]
    border = np.concatenate([
        img_np[:10, :].reshape(-1, 3),
        img_np[-10:, :].reshape(-1, 3),
        img_np[:, :10].reshape(-1, 3),
        img_np[:, -10:].reshape(-1, 3),
    ])
    return border.mean(axis=0)

def to_hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def suggest_points(image_path, n_points=12, bg_threshold=28.0):
    img_pil = Image.open(image_path).convert("RGB")
    img_np = np.array(img_pil)

    img_float = img_as_float(img_np)
    segments = slic(img_float, n_segments=80, compactness=10, sigma=1, start_label=0)

    bg = sample_bg_color(img_np)
    n_segs = segments.max() + 1
    candidates = []

    for sid in range(n_segs):
        mask = segments == sid
        px = img_np[mask]
        ys, xs = np.where(mask)
        mean_color = px.mean(axis=0)
        size = mask.sum()
        dist_from_bg = np.linalg.norm(mean_color - bg)
        if dist_from_bg >= bg_threshold and size > 200:
            cx, cy = int(xs.mean()), int(ys.mean())
            candidates.append((cx, cy, mean_color, size, dist_from_bg))

    if not candidates:
        return []

    # Greedy diverse color selection
    candidates.sort(key=lambda x: -x[4])
    chosen = [candidates.pop(0)]

    while len(chosen) < n_points and candidates:
        best_idx = 0
        best_min_dist = -1
        for i, cand in enumerate(candidates):
            min_dist = min(np.linalg.norm(cand[2] - c[2]) for c in chosen)
            if min_dist > best_min_dist:
                best_min_dist = min_dist
                best_idx = i
        chosen.append(candidates.pop(best_idx))

    return [{"x": cx, "y": cy, "color": to_hex(color)} for cx, cy, color, *_ in chosen]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    parser.add_argument("--n", type=int, default=12)
    args = parser.parse_args()

    points = suggest_points(args.image_path, n_points=args.n)
    print(json.dumps(points))
