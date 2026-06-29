import type { EyedropperPoint } from "./types"

// Broadcast one label presentation field (font/size/color) from the selected
// point to every point. Pure so it can be unit-tested without standing up
// EditorShell (Story 3.4). Reads the selected value fresh from the passed-in
// array — callers thread `prev` from inside setPoints so there is no stale
// closure. Returns the array unchanged when there is no selection (cheap no-op).
export function applyFieldToAll(
  points: EyedropperPoint[],
  selectedId: string | null,
  field: "fontFamily" | "fontSize" | "color"
): EyedropperPoint[] {
  const selected = selectedId ? points.find((p) => p.id === selectedId) : undefined
  if (!selected) return points
  const value = selected.label[field]
  return points.map((p) => ({ ...p, label: { ...p.label, [field]: value } }))
}
