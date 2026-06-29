"use client"

import { useEffect, useState } from "react"
import type { Style } from "@/lib/styles"
import StyleThumbnail from "./StyleThumbnail"

interface Props {
  styles: Style[]
  activeStyleName: string
  onSelect: (style: Style) => void
}

export default function StylePicker({ styles, activeStyleName, onSelect }: Props) {
  // Load the sample drawing ONCE and share the decoded element across all
  // thumbnails. Hydration-safe per docs/project-context.md: browser-only object
  // created in useEffect, initialized null, thumbnails render a placeholder
  // until it resolves.
  const [sampleImg, setSampleImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const im = new window.Image()
    im.onload = () => setSampleImg(im)
    im.src = "/sample-drawing.jpg"
    return () => {
      im.onload = null
    }
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto">
      {styles.map((style) => {
        const isActive = style.name === activeStyleName
        return (
          <button
            key={style.name}
            type="button"
            onClick={() => onSelect(style)}
            aria-pressed={isActive}
            className={`flex flex-col items-center gap-1 rounded p-1 flex-shrink-0 border-2 transition-colors ${
              isActive
                ? "border-[var(--color-accent)]"
                : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
            }`}
          >
            <StyleThumbnail style={style} sampleImg={sampleImg} />
            <span className="text-[10px] text-[var(--color-text-secondary)]">{style.name}</span>
          </button>
        )
      })}
    </div>
  )
}
