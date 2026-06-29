"use client"

import type { EyedropperPoint } from "@/lib/types"

const SIDES: EyedropperPoint["swatchSide"][] = ["auto", "left", "right", "top", "bottom"]

interface Props {
  pointNumber: number
  color: string
  swatchSide: EyedropperPoint["swatchSide"]
  onSetSide: (side: EyedropperPoint["swatchSide"]) => void
  onRemove: () => void
}

export default function PointPanel({ pointNumber, color, swatchSide, onSetSide, onRemove }: Props) {
  return (
    <section data-testid="point-panel">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Point #{pointNumber}
      </h3>

      <div className="flex items-center gap-2 mb-3">
        <span
          data-testid="point-color-preview"
          className="inline-block w-6 h-6 rounded border border-[var(--color-border)]"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-[var(--color-text-primary)] font-mono">{color}</span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Swatch side
      </p>
      <div className="flex flex-wrap gap-1 mb-3">
        {SIDES.map((side) => (
          <button
            key={side}
            onClick={() => onSetSide(side)}
            aria-pressed={swatchSide === side}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              swatchSide === side
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
            }`}
          >
            {side}
          </button>
        ))}
      </div>

      <button
        onClick={onRemove}
        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white text-red-600 hover:border-red-600 transition-colors"
      >
        × Remove this point
      </button>
    </section>
  )
}
