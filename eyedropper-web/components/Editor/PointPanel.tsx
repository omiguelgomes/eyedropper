"use client"

interface Props {
  pointNumber: number
  color: string
  onRemove: () => void
}

export default function PointPanel({ pointNumber, color, onRemove }: Props) {
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

      <button
        onClick={onRemove}
        className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-border)] bg-white text-red-600 hover:border-red-600 transition-colors"
      >
        × Remove this point
      </button>
    </section>
  )
}
