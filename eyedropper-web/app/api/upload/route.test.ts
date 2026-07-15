import { describe, it, expect, vi, beforeEach } from "vitest"

// The route delegates to @vercel/blob/client's handleUpload; we mock it and
// assert on the onBeforeGenerateToken policy the route hands it (allowed types,
// size cap, pathname validation).
const mockHandleUpload = vi.fn()
vi.mock("@vercel/blob/client", () => ({ handleUpload: mockHandleUpload }))

function makeReq(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as any
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the handleUpload result", async () => {
    mockHandleUpload.mockResolvedValue({ type: "blob.generate-client-token", clientToken: "tok" })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ type: "blob.generate-client-token" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ type: "blob.generate-client-token", clientToken: "tok" })
  })

  it("allows a valid uploads/<uuid> pathname and enforces type + size limits", async () => {
    let policy: any
    mockHandleUpload.mockImplementation(async ({ onBeforeGenerateToken }: any) => {
      policy = await onBeforeGenerateToken("uploads/550e8400-e29b-41d4-a716-446655440000")
      return { type: "blob.generate-client-token", clientToken: "tok" }
    })
    const { POST } = await import("./route")
    await POST(makeReq({ type: "blob.generate-client-token" }))
    expect(policy.allowedContentTypes).toEqual(["image/jpeg", "image/png"])
    expect(policy.maximumSizeInBytes).toBe(20 * 1024 * 1024)
    expect(policy.addRandomSuffix).toBe(false)
  })

  it("rejects a pathname outside uploads/<uuid>", async () => {
    mockHandleUpload.mockImplementation(async ({ onBeforeGenerateToken }: any) => {
      await onBeforeGenerateToken("uploads/../etc/passwd")
      return { type: "blob.generate-client-token", clientToken: "tok" }
    })
    const { POST } = await import("./route")
    const res = await POST(makeReq({ type: "blob.generate-client-token" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid upload path")
  })

  it("returns 400 when handleUpload throws", async () => {
    mockHandleUpload.mockRejectedValue(new Error("bad token"))
    const { POST } = await import("./route")
    const res = await POST(makeReq({ type: "blob.upload-completed" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("bad token")
  })
})
