"use client"

import { useState } from "react"

interface ExportButtonProps {
  onExport: () => Promise<void>
  // Short label for the current aspect ratio (e.g. "9:16", "3:2"), shown in the
  // button text so it reflects whatever ratio will be exported.
  ratioLabel: string
}

export default function ExportButton({ onExport, ratioLabel }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleClick = async () => {
    setIsExporting(true)
    try {
      await onExport()
    } catch {
      // The button has no error UI in this story; a failed export just returns
      // to the default enabled state (AC6). Swallow so the click handler does
      // not produce an unhandled rejection.
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isExporting}
      className={`w-full py-2 px-4 rounded bg-[var(--color-accent)] text-white text-sm ${
        isExporting ? "opacity-60 cursor-wait" : ""
      }`}
    >
      {isExporting ? "Exporting…" : `Download ${ratioLabel} JPEG`}
    </button>
  )
}
