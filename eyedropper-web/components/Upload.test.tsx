import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import Upload from "./Upload"
import { MAX_SIZE } from "@/lib/upload-utils"

const { mockPush, mockUpload } = vi.hoisted(() => ({ mockPush: vi.fn(), mockUpload: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@vercel/blob/client", () => ({ upload: mockUpload }))

function makeFile(name: string, type: string, size = 100): File {
  const buf = new ArrayBuffer(size)
  return new File([buf], name, { type })
}

// Trigger the hidden file input directly via fireEvent (userEvent skips hidden elements)
function uploadFile(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } })
}

describe("Upload component", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true })
    mockPush.mockClear()
    mockUpload.mockReset()
    vi.unstubAllGlobals()
    vi.stubGlobal("crypto", { randomUUID: () => "abc-123" })
  })

  it("shows mobile message when window.innerWidth < 1024", async () => {
    Object.defineProperty(window, "innerWidth", { value: 800, writable: true, configurable: true })
    render(<Upload />)
    await waitFor(() => {
      expect(screen.getByText(/Please open this app on a desktop/i)).toBeInTheDocument()
    })
  })

  it("shows drop zone on desktop", async () => {
    render(<Upload />)
    await waitFor(() => {
      expect(screen.getByText("Drop image here")).toBeInTheDocument()
    })
  })

  it("shows error for non-JPEG/PNG file", async () => {
    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("doc.pdf", "application/pdf"))

    expect(screen.getByText("Only JPEG and PNG files are supported.")).toBeInTheDocument()
  })

  it("shows error for file over 20MB", async () => {
    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("big.jpg", "image/jpeg", MAX_SIZE + 1))

    expect(screen.getByText("File must be under 20MB.")).toBeInTheDocument()
  })

  it("shows filename, size, and Continue button for valid JPEG", async () => {
    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("photo.jpg", "image/jpeg", 2 * 1024 * 1024))

    expect(screen.getByText("photo.jpg")).toBeInTheDocument()
    expect(screen.getByText("2.0 MB")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
  })

  it("shows filename, size, and Continue button for valid PNG", async () => {
    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("image.png", "image/png", 512 * 1024))

    expect(screen.getByText("image.png")).toBeInTheDocument()
    expect(screen.getByText("512.0 KB")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
  })

  it("accepts a valid file dropped onto the zone and highlights on drag-over", async () => {
    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))
    const zone = document.querySelector(".border-dashed") as HTMLElement

    fireEvent.dragOver(zone)
    expect(zone.className).toContain("border-[var(--color-accent)]")

    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("dropped.jpg", "image/jpeg", 1024)] } })
    expect(screen.getByText("dropped.jpg")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
  })

  it("uploads to Blob and navigates to /editor on success", async () => {
    mockUpload.mockResolvedValue({ url: "https://blob/uploads/abc-123" })

    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("photo.jpg", "image/jpeg", 1024))

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/editor?id=abc-123"))
    expect(mockUpload).toHaveBeenCalledWith(
      "uploads/abc-123",
      expect.any(File),
      expect.objectContaining({ access: "private", handleUploadUrl: "/api/upload", contentType: "image/jpeg" })
    )
  })

  it("shows an error and does not navigate when the upload rejects", async () => {
    mockUpload.mockRejectedValue(new Error("network down"))

    render(<Upload />)
    await waitFor(() => screen.getByText("Drop image here"))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    uploadFile(input, makeFile("photo.jpg", "image/jpeg", 1024))

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => expect(screen.getByText("Upload failed. Please try again.")).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalled()
  })
})
