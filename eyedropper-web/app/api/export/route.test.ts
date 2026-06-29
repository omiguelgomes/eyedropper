import { describe, it, expect, vi, beforeEach } from "vitest"

const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from("jpeg"))
const mockJpeg = vi.fn().mockReturnValue({ toBuffer: mockToBuffer })
const mockSharp = vi.fn((_buffer: Buffer) => ({ jpeg: mockJpeg }))

vi.mock("sharp", () => ({ default: mockSharp }))

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as any
}

describe("POST /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToBuffer.mockResolvedValue(Buffer.from("jpeg"))
    mockJpeg.mockReturnValue({ toBuffer: mockToBuffer })
  })

  it("returns 200 image/jpeg, encodes at quality 95, and returns the sharp buffer", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "data:image/png;base64,AAAA" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="eyedropper-export.jpg"'
    )
    expect(mockJpeg).toHaveBeenCalledWith({ quality: 95 })
    const out = Buffer.from(await res.arrayBuffer())
    expect(out.equals(Buffer.from("jpeg"))).toBe(true)
  })

  it("base64-decodes the data URL and passes a Buffer to sharp", async () => {
    const { POST } = await import("./route")
    await POST(makeReq({ dataUrl: "data:image/png;base64,AAAA" }))
    expect(mockSharp).toHaveBeenCalledTimes(1)
    const arg = mockSharp.mock.calls[0][0]
    expect(Buffer.isBuffer(arg)).toBe(true)
    // "AAAA" base64 decodes to three zero bytes.
    expect((arg as Buffer).equals(Buffer.from("AAAA", "base64"))).toBe(true)
  })

  it("returns 400 when dataUrl is missing", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
  })

  it("returns 400 when dataUrl is an empty string", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
  })

  it("returns 400 when dataUrl is not a data:image/ string", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "https://example.com/x.png" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
  })

  it("returns 400 for an SVG data URL (non-raster type is rejected)", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
    expect(mockSharp).not.toHaveBeenCalled()
  })

  it("returns 400 for a data:image/ URL without a ;base64, payload", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "data:image/png,not-base64" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
    expect(mockSharp).not.toHaveBeenCalled()
  })

  it("returns 400 when the base64 payload is empty", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "data:image/png;base64," }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid data URL")
    expect(mockSharp).not.toHaveBeenCalled()
  })

  it("returns 413 when content-length exceeds the cap", async () => {
    const { POST } = await import("./route")
    const big = String(60 * 1024 * 1024)
    const res = await POST(makeReq({ dataUrl: "data:image/png;base64,AAAA" }, { "content-length": big }))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe("Payload too large")
    expect(mockSharp).not.toHaveBeenCalled()
  })

  it("returns 400 when the request body is not valid JSON", async () => {
    const { POST } = await import("./route")
    const req = {
      json: vi.fn().mockRejectedValue(new Error("bad json")),
      headers: { get: () => null },
    } as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid request body")
  })

  it("returns 500 when sharp fails to encode", async () => {
    mockToBuffer.mockRejectedValue(new Error("decode error"))
    const { POST } = await import("./route")
    const res = await POST(makeReq({ dataUrl: "data:image/png;base64,AAAA" }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("Export failed")
  })
})
