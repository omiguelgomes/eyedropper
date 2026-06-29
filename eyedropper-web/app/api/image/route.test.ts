import { describe, it, expect, vi, beforeEach } from "vitest"

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}))

function makeReq(id: string | null) {
  const url = id !== null
    ? `http://localhost/api/image?id=${id}`
    : "http://localhost/api/image"
  return { nextUrl: new URL(url) } as any
}

describe("GET /api/image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("returns 404 when id is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeReq(null))
    expect(res.status).toBe(404)
  })

  it("returns 404 for invalid id (path traversal attempt)", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeReq("../etc/passwd"))
    expect(res.status).toBe(404)
  })

  it("returns 404 for id with invalid characters", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeReq("invalid-UUID-with-UPPERCASE"))
    expect(res.status).toBe(404)
  })

  it("returns 404 when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false)
    const { GET } = await import("./route")
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const res = await GET(makeReq(validId))
    expect(res.status).toBe(404)
  })

  it("returns 200 with image/jpeg content-type when file exists", async () => {
    const fakeBuffer = Buffer.from("fake-jpeg-data")
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(fakeBuffer)
    const { GET } = await import("./route")
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const res = await GET(makeReq(validId))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
  })

  it("returns Cache-Control header on success", async () => {
    const fakeBuffer = Buffer.from("fake-jpeg-data")
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(fakeBuffer)
    const { GET } = await import("./route")
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const res = await GET(makeReq(validId))
    expect(res.headers.get("Cache-Control")).toBe("max-age=3600")
  })

  it("returns the file bytes from readFileSync as the body", async () => {
    const fakeBuffer = Buffer.from("fake-jpeg-data")
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(fakeBuffer)
    const { GET } = await import("./route")
    const validId = "550e8400-e29b-41d4-a716-446655440000"
    const res = await GET(makeReq(validId))
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(fakeBuffer)).toBe(true)
    expect(mockReadFileSync).toHaveBeenCalledWith(`/tmp/${validId}/original.jpg`)
  })
})
