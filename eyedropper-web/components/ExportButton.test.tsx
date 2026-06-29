import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ExportButton from "./ExportButton"

describe("ExportButton", () => {
  it("renders an enabled button labelled 'Download 9:16 JPEG' by default (AC5)", () => {
    render(<ExportButton onExport={vi.fn().mockResolvedValue(undefined)} />)
    const button = screen.getByRole("button", { name: "Download 9:16 JPEG" })
    expect(button).toBeEnabled()
  })

  it("calls onExport when clicked", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ExportButton onExport={onExport} />)
    await user.click(screen.getByRole("button"))
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it("shows a disabled 'Exporting…' state while in-flight, then re-enables on success (AC6)", async () => {
    let resolveExport: () => void = () => {}
    const onExport = vi.fn(
      () => new Promise<void>((r) => { resolveExport = r })
    )
    const user = userEvent.setup()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByRole("button"))

    // In-flight: disabled and shows the loading label.
    const loading = screen.getByRole("button", { name: "Exporting…" })
    expect(loading).toBeDisabled()

    resolveExport()

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download 9:16 JPEG" })).toBeEnabled()
    )
  })

  it("re-enables the button even if onExport rejects (AC6)", async () => {
    const onExport = vi.fn().mockRejectedValue(new Error("export failed"))
    const user = userEvent.setup()
    render(<ExportButton onExport={onExport} />)

    await user.click(screen.getByRole("button"))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download 9:16 JPEG" })).toBeEnabled()
    )
  })
})
