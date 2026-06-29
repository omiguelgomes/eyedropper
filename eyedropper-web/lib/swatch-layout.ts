import type { EyedropperPoint } from "./types"

export type Side = "left" | "right" | "top" | "bottom"

export function assignSwatchLayout(
  points: EyedropperPoint[],
  canvasWidth: number,
  canvasHeight: number,
  imageOffsetY: number = 0
): EyedropperPoint[] {
  if (points.length === 0) return []

  // Step 1: Assign sides for "auto" points
  const withSides = points.map((p): EyedropperPoint => {
    if (p.swatchSide !== "auto") return p
    const cx = p.x
    const cy = p.y + imageOffsetY
    const dLeft = cx
    const dRight = canvasWidth - cx
    const dTop = cy
    const dBottom = canvasHeight - cy
    const min = Math.min(dLeft, dRight, dTop, dBottom)
    let side: Side
    if (min === dLeft) side = "left"
    else if (min === dRight) side = "right"
    else if (min === dTop) side = "top"
    else side = "bottom"
    return { ...p, swatchSide: side }
  })

  // Step 2: Group by side
  const groups: Record<Side, EyedropperPoint[]> = { left: [], right: [], top: [], bottom: [] }
  for (const p of withSides) {
    groups[p.swatchSide as Side].push(p)
  }

  // Step 3: Sort each group by coordinate along the edge (no-crossing guarantee)
  const byCanvasY = (a: EyedropperPoint, b: EyedropperPoint) =>
    (a.y + imageOffsetY) - (b.y + imageOffsetY)
  const byX = (a: EyedropperPoint, b: EyedropperPoint) => a.x - b.x
  groups.left.sort(byCanvasY)
  groups.right.sort(byCanvasY)
  groups.top.sort(byX)
  groups.bottom.sort(byX)

  // Step 4: Evenly distribute along full edge
  const result = new Map<string, EyedropperPoint>()
  for (const [side, group] of Object.entries(groups) as [Side, EyedropperPoint[]][]) {
    const n = group.length
    const L = (side === "left" || side === "right") ? canvasHeight : canvasWidth
    group.forEach((p, i) => {
      result.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
    })
  }

  return points.map(p => result.get(p.id) ?? p)
}

export function redistributeOnEdge(
  points: EyedropperPoint[],
  side: Side,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): EyedropperPoint[] {
  const L = side === "left" || side === "right" ? canvasHeight : canvasWidth
  const onEdge = points.filter(p => p.swatchSide === side && p.swatchOrder !== null)
  const sorted = [...onEdge].sort((a, b) => a.swatchOrder! - b.swatchOrder!)
  const n = sorted.length
  const updated = new Map<string, EyedropperPoint>()
  sorted.forEach((p, i) => {
    updated.set(p.id, { ...p, swatchOrder: Math.round(L * (i + 1) / (n + 1)) })
  })
  return points.map(p => updated.get(p.id) ?? p)
}

// Place a just-dragged swatch: keep its dropped swatchOrder unless it would
// overlap another swatch on the same edge (centers closer than 2*swatchRadius),
// in which case redistribute the whole edge evenly while preserving order.
// `points` must already contain the moved point at its dropped swatchOrder.
export function placeSwatchOnEdge(
  points: EyedropperPoint[],
  id: string,
  side: Side,
  canvasWidth: number,
  canvasHeight: number,
  swatchRadius: number
): EyedropperPoint[] {
  const moved = points.find(p => p.id === id)
  if (!moved || moved.swatchOrder === null) return points
  const overlaps = points.some(
    p =>
      p.id !== id &&
      p.swatchSide === side &&
      p.swatchOrder !== null &&
      Math.abs(p.swatchOrder - moved.swatchOrder!) < 2 * swatchRadius
  )
  if (!overlaps) return points
  return redistributeOnEdge(points, side, canvasWidth, canvasHeight, swatchRadius)
}
