"use client"

import { useState } from "react"
import { PRESETS, parseRatio, ratiosEqual, type Ratio } from "@/lib/aspect"

interface Props {
  ratio: Ratio
  onSelect: (ratio: Ratio) => void
}

export default function AspectPicker({ ratio, onSelect }: Props) {
  const [custom, setCustom] = useState("")
  // Invalid only when the field is non-empty and unparseable — an empty field is
  // neutral, not an error.
  const parsed = custom.trim() === "" ? null : parseRatio(custom)
  const invalid = custom.trim() !== "" && parsed === null

  const applyCustom = () => {
    if (parsed) {
      onSelect(parsed)
      setCustom("")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const isActive = ratiosEqual(ratio, preset)
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onSelect({ w: preset.w, h: preset.h })}
              aria-pressed={isActive}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="text"
          aria-label="Custom aspect ratio"
          placeholder="e.g. 3:2"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustom()
          }}
          className={`flex-1 min-w-0 text-xs px-2 py-1 rounded border bg-white ${
            invalid ? "border-red-500" : "border-[var(--color-border)]"
          }`}
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={!parsed}
          className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-white disabled:opacity-50 hover:border-[var(--color-accent)] transition-colors"
        >
          Set
        </button>
      </div>
      {invalid && <p className="text-[10px] text-red-600">Use W:H, e.g. 3:2</p>}
    </div>
  )
}
