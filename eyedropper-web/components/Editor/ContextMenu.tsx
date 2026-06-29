"use client"

interface Props {
  x: number
  y: number
  onRemove: () => void
}

export default function ContextMenu({ x, y, onRemove }: Props) {
  return (
    <div
      data-testid="context-menu"
      className="fixed z-50 rounded border border-[var(--color-border)] bg-white shadow-md py-1"
      style={{ left: x, top: y }}
      // Prevent the window mousedown close-listener from firing for clicks
      // inside the menu (so the button click is not pre-empted by close).
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onRemove}
        className="block w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--color-bg)] text-[var(--color-text-primary)]"
      >
        Remove point
      </button>
    </div>
  )
}
