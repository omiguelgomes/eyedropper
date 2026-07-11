"use client"

import type { EyedropperPoint } from "@/lib/types"
import { FONT_OPTIONS, FONT_CATEGORIES } from "@/lib/fonts"

interface Props {
  label: EyedropperPoint["label"]
  onUpdate: (patch: Partial<EyedropperPoint["label"]>) => void
}

// Right-panel per-selected-point label controls, shown in label-edit mode
// instead of PointPanel (UI.md:127-148). A single onUpdate(patch) keeps the
// surface minimal (partial merge) rather than five callbacks.
export default function LabelPanel({ label, onUpdate }: Props) {
  return (
    <section data-testid="label-panel">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Label
      </h3>
      <input
        type="text"
        aria-label="Label text"
        value={label.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        className="w-full text-sm px-2 py-1 mb-3 rounded border border-[var(--color-border)] bg-white text-[var(--color-text-primary)]"
      />

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Font
      </p>
      <select
        aria-label="Font family"
        value={label.fontFamily}
        onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        className="w-full text-sm px-2 py-1 mb-3 rounded border border-[var(--color-border)] bg-white text-[var(--color-text-primary)]"
      >
        {FONT_CATEGORIES.map((cat) => (
          <optgroup key={cat} label={cat}>
            {FONT_OPTIONS.filter((o) => o.category === cat).map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Size
      </p>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="range"
          aria-label="Font size"
          min={12}
          max={48}
          value={label.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="text-xs text-[var(--color-text-primary)] font-mono w-10 text-right">
          {label.fontSize}px
        </span>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
        Color
      </p>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="color"
          aria-label="Label color"
          value={label.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="w-8 h-8 rounded border border-[var(--color-border)] bg-white p-0"
        />
        <span className="text-xs text-[var(--color-text-primary)] font-mono">{label.color}</span>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
        <input
          type="checkbox"
          aria-label="Show label"
          checked={label.visible}
          onChange={(e) => onUpdate({ visible: e.target.checked })}
        />
        Show label
      </label>

    </section>
  )
}
