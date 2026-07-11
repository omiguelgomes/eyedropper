import { describe, it, expect, vi, beforeEach } from "vitest"

const mockPutUpload = vi.fn()
const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from("jpeg-bytes"))
const mockMetadata = vi.fn().mockResolvedValue({ width: 800, height: 600 })
const mockJpeg = vi.fn()
const mockSharpInstance = { metadata: mockMetadata, jpeg: mockJpeg }
mockJpeg.mockReturnValue({ toBuffer: mockToBuffer })

vi.mock("@/lib/blob-store", () => ({ putUpload: mockPutUpload }))
vi.mock("sharp", () => ({ default: vi.fn(() => mockSharpInstance) }))
vi.mock("crypto", () => ({
  default: { randomUUID: vi.fn(() => "test-uuid-1234") },
}))

function makeReq(file: File | null, headers: Record<string, string> = {}) {
  const form = new FormData()
  if (file) form.append("file", file)
  return {
    formData: vi.fn().mockResolvedValue(form),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as any
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMetadata.mockResolvedValue({ width: 800, height: 600 })
    mockJpeg.mockReturnValue({ toBuffer: mockToBuffer })
    mockToBuffer.mockResolvedValue(Buffer.from("jpeg-bytes"))
    mockPutUpload.mockResolvedValue(undefined)
  })

  it("returns 400 when no file provided", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("No file provided")
  })

  it("returns id, width, height on success", async () => {
    const { POST } = await import("./route")
    const file = new File([new ArrayBuffer(100)], "photo.jpg", { type: "image/jpeg" })
    const res = await POST(makeReq(file))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("test-uuid-1234")
    expect(body.width).toBe(800)
    expect(body.height).toBe(600)
  })

  it("stores the re-encoded jpeg in blob under the uuid", async () => {
    const { POST } = await import("./route")
    const file = new File([new ArrayBuffer(100)], "photo.png", { type: "image/png" })
    await POST(makeReq(file))
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 95 })
    expect(mockPutUpload).toHaveBeenCalledWith("test-uuid-1234", expect.any(Buffer))
  })

  it("returns 400 when the image cannot be decoded", async () => {
    mockMetadata.mockRejectedValue(new Error("Input buffer contains unsupported image format"))
    const { POST } = await import("./route")
    const file = new File([new ArrayBuffer(100)], "corrupt.jpg", { type: "image/jpeg" })
    const res = await POST(makeReq(file))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid or corrupt image")
  })

  it("returns 400 when image dimensions are missing", async () => {
    mockMetadata.mockResolvedValue({ width: undefined, height: undefined })
    const { POST } = await import("./route")
    const file = new File([new ArrayBuffer(100)], "nodims.jpg", { type: "image/jpeg" })
    const res = await POST(makeReq(file))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Could not read image dimensions")
  })

  it("returns 400 when the file field is not a File", async () => {
    const { POST } = await import("./route")
    const form = new FormData()
    form.append("file", "just-a-string")
    const res = await POST({
      formData: vi.fn().mockResolvedValue(form),
      headers: { get: () => null },
    } as any)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("No file provided")
  })

  it("returns 413 when content-length exceeds the cap", async () => {
    const { POST } = await import("./route")
    const file = new File([new ArrayBuffer(100)], "huge.jpg", { type: "image/jpeg" })
    const big = String(60 * 1024 * 1024)
    const res = await POST(makeReq(file, { "content-length": big }))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe("Payload too large")
  })
})
