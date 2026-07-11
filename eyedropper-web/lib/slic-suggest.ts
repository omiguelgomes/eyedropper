// Pure-JS port of scripts/slic_suggest.py — SLIC superpixel segmentation plus
// greedy color-diverse point selection. Runs in the Node serverless runtime
// (Vercel has no python3), so the SLIC suggestion method works without Python.
//
// The segmentation runs in CIELAB space (like skimage's slic); the background
// rejection, size filter and diversity selection all operate in 0–255 RGB to
// match the reference script exactly.

export interface RgbImage {
  width: number
  height: number
  // Row-major RGB, length width * height * 3.
  data: Uint8Array | Uint8ClampedArray | Buffer
}

export interface SuggestedPoint {
  x: number
  y: number
  color: string
}

// sRGB (0–255) → CIELAB, D65 reference white.
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rf = r / 255
  let gf = g / 255
  let bf = b / 255
  rf = rf > 0.04045 ? ((rf + 0.055) / 1.055) ** 2.4 : rf / 12.92
  gf = gf > 0.04045 ? ((gf + 0.055) / 1.055) ** 2.4 : gf / 12.92
  bf = bf > 0.04045 ? ((bf + 0.055) / 1.055) ** 2.4 : bf / 12.92

  const x = (rf * 0.4124 + gf * 0.3576 + bf * 0.1805) / 0.95047
  const y = rf * 0.2126 + gf * 0.7152 + bf * 0.0722
  const z = (rf * 0.0193 + gf * 0.1192 + bf * 0.9505) / 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}

// SLIC: returns a per-pixel label array (length width*height). n_segments is a
// target — the actual count depends on the grid that tiles the image.
export function slicSegments(
  img: RgbImage,
  nSegments = 80,
  compactness = 10
): Int32Array {
  const { width: w, height: h, data } = img
  const n = w * h

  // Precompute LAB for every pixel.
  const lab = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const [l, a, bb] = rgbToLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])
    lab[i * 3] = l
    lab[i * 3 + 1] = a
    lab[i * 3 + 2] = bb
  }

  // Grid spacing S so that ~nSegments centers tile the image.
  const S = Math.max(1, Math.round(Math.sqrt(n / nSegments)))
  const cols = Math.max(1, Math.round(w / S))
  const rows = Math.max(1, Math.round(h / S))

  // Cluster centers: [cx, cy, L, a, b] per cluster.
  const cx: number[] = []
  const cy: number[] = []
  const cl: number[] = []
  const ca: number[] = []
  const cb: number[] = []
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = Math.min(w - 1, Math.floor((gx + 0.5) * (w / cols)))
      const py = Math.min(h - 1, Math.floor((gy + 0.5) * (h / rows)))
      const p = py * w + px
      cx.push(px)
      cy.push(py)
      cl.push(lab[p * 3])
      ca.push(lab[p * 3 + 1])
      cb.push(lab[p * 3 + 2])
    }
  }
  const k = cx.length

  const labels = new Int32Array(n).fill(-1)
  const dist = new Float64Array(n)
  const invS2 = (compactness / S) ** 2

  const ITERS = 10
  for (let iter = 0; iter < ITERS; iter++) {
    dist.fill(Infinity)
    for (let c = 0; c < k; c++) {
      const x0 = Math.max(0, Math.floor(cx[c] - S))
      const x1 = Math.min(w - 1, Math.ceil(cx[c] + S))
      const y0 = Math.max(0, Math.floor(cy[c] - S))
      const y1 = Math.min(h - 1, Math.ceil(cy[c] + S))
      const ccl = cl[c]
      const cca = ca[c]
      const ccb = cb[c]
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const p = y * w + x
          const dl = lab[p * 3] - ccl
          const da = lab[p * 3 + 1] - cca
          const db = lab[p * 3 + 2] - ccb
          const dc2 = dl * dl + da * da + db * db
          const dx = x - cx[c]
          const dy = y - cy[c]
          const ds2 = dx * dx + dy * dy
          const d = dc2 + ds2 * invS2
          if (d < dist[p]) {
            dist[p] = d
            labels[p] = c
          }
        }
      }
    }

    // Recompute centers from assigned members.
    const sumX = new Float64Array(k)
    const sumY = new Float64Array(k)
    const sumL = new Float64Array(k)
    const sumA = new Float64Array(k)
    const sumB = new Float64Array(k)
    const count = new Int32Array(k)
    for (let p = 0; p < n; p++) {
      const c = labels[p]
      if (c < 0) continue
      const x = p % w
      const y = (p - x) / w
      sumX[c] += x
      sumY[c] += y
      sumL[c] += lab[p * 3]
      sumA[c] += lab[p * 3 + 1]
      sumB[c] += lab[p * 3 + 2]
      count[c]++
    }
    for (let c = 0; c < k; c++) {
      if (count[c] === 0) continue
      cx[c] = sumX[c] / count[c]
      cy[c] = sumY[c] / count[c]
      cl[c] = sumL[c] / count[c]
      ca[c] = sumA[c] / count[c]
      cb[c] = sumB[c] / count[c]
    }
  }

  return labels
}

// Mean of the outer `border` px ring, in 0–255 RGB. Mirrors sample_bg_color.
function sampleBgColor(img: RgbImage, border = 10): [number, number, number] {
  const { width: w, height: h, data } = img
  const b = Math.min(border, Math.floor(h / 2) || 1, Math.floor(w / 2) || 1)
  let r = 0
  let g = 0
  let bl = 0
  let cnt = 0
  const add = (p: number) => {
    r += data[p * 3]
    g += data[p * 3 + 1]
    bl += data[p * 3 + 2]
    cnt++
  }
  for (let y = 0; y < b; y++) for (let x = 0; x < w; x++) add(y * w + x)
  for (let y = h - b; y < h; y++) for (let x = 0; x < w; x++) add(y * w + x)
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) add(y * w + x)
  for (let y = 0; y < h; y++) for (let x = w - b; x < w; x++) add(y * w + x)
  return [r / cnt, g / cnt, bl / cnt]
}

interface Candidate {
  cx: number
  cy: number
  color: [number, number, number]
  size: number
  distFromBg: number
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// Port of suggest_points(): segment, reject background/tiny segments, then
// greedily pick color-diverse points. Coordinates are in `img` pixel space.
export function suggestPoints(
  img: RgbImage,
  nPoints = 12,
  bgThreshold = 28.0,
  minSize = 200
): SuggestedPoint[] {
  const { width: w, height: h, data } = img
  const labels = slicSegments(img)
  const bg = sampleBgColor(img)

  let maxSeg = 0
  for (let p = 0; p < labels.length; p++) if (labels[p] > maxSeg) maxSeg = labels[p]
  const nSegs = maxSeg + 1

  const sumR = new Float64Array(nSegs)
  const sumG = new Float64Array(nSegs)
  const sumB = new Float64Array(nSegs)
  const sumX = new Float64Array(nSegs)
  const sumY = new Float64Array(nSegs)
  const count = new Int32Array(nSegs)
  for (let p = 0; p < labels.length; p++) {
    const s = labels[p]
    if (s < 0) continue
    const x = p % w
    const y = (p - x) / w
    sumR[s] += data[p * 3]
    sumG[s] += data[p * 3 + 1]
    sumB[s] += data[p * 3 + 2]
    sumX[s] += x
    sumY[s] += y
    count[s]++
  }

  const candidates: Candidate[] = []
  for (let s = 0; s < nSegs; s++) {
    const size = count[s]
    if (size === 0) continue
    const color: [number, number, number] = [
      sumR[s] / size,
      sumG[s] / size,
      sumB[s] / size,
    ]
    const distFromBg = dist3(color, bg)
    if (distFromBg >= bgThreshold && size > minSize) {
      candidates.push({
        cx: Math.round(sumX[s] / size),
        cy: Math.round(sumY[s] / size),
        color,
        size,
        distFromBg,
      })
    }
  }

  if (candidates.length === 0) return []

  // Greedy diverse color selection — mirrors the Python ordering exactly:
  // seed with the most background-distinct segment, then repeatedly add the
  // candidate whose nearest chosen color is farthest away.
  candidates.sort((a, b) => b.distFromBg - a.distFromBg)
  const pool = candidates.slice()
  const chosen: Candidate[] = [pool.shift()!]

  while (chosen.length < nPoints && pool.length > 0) {
    let bestIdx = 0
    let bestMinDist = -1
    for (let i = 0; i < pool.length; i++) {
      let minDist = Infinity
      for (const c of chosen) {
        const d = dist3(pool[i].color, c.color)
        if (d < minDist) minDist = d
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist
        bestIdx = i
      }
    }
    chosen.push(pool.splice(bestIdx, 1)[0])
  }

  return chosen.map((c) => ({
    x: c.cx,
    y: c.cy,
    color: toHex(c.color[0], c.color[1], c.color[2]),
  }))
}
