import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { triggerDownload } from "./download"

describe("triggerDownload", () => {
  const createObjectURL = vi.fn(() => "blob:fake-url")
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL })
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("sets the download filename, clicks the anchor once, and revokes the object URL", () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    let captured: HTMLAnchorElement | null = null
    const realCreate = document.createElement.bind(document)
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = realCreate(tag)
        if (tag === "a") captured = el as HTMLAnchorElement
        return el
      })

    const blob = new Blob(["x"], { type: "image/jpeg" })
    triggerDownload(blob, "eyedropper-export.jpg")

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(captured).not.toBeNull()
    expect(captured!.download).toBe("eyedropper-export.jpg")
    expect(captured!.href).toBe("blob:fake-url")
    expect(clickSpy).toHaveBeenCalledTimes(1)
    // The anchor is cleaned up from the document after the click.
    expect(captured!.isConnected).toBe(false)

    // Revocation is deferred to the next tick so the browser can start the
    // download before the object URL is released.
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url")

    createSpy.mockRestore()
    clickSpy.mockRestore()
  })
})
