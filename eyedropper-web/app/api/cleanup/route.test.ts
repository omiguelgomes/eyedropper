import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockDeleteExpiredUploads = vi.fn()

vi.mock("@/lib/blob-store", () => ({ deleteExpiredUploads: mockDeleteExpiredUploads }))

const FIXED_NOW = 1_700_000_000_000
const HOUR_MS = 60 * 60 * 1000
const UUID = "550e8400-e29b-41d4-a716-446655440000"

function reqWithAuth(authorization?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? authorization ?? null : null) } } as any
}

describe("GET /api/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW)
    mockDeleteExpiredUploads.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.CRON_SECRET
  })

  it("deletes expired uploads and reports them", async () => {
    mockDeleteExpiredUploads.mockResolvedValue([`uploads/${UUID}.jpg`])
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockDeleteExpiredUploads).toHaveBeenCalledWith(FIXED_NOW, HOUR_MS)
    expect(body.deleted).toEqual([`uploads/${UUID}.jpg`])
    expect(body.count).toBe(1)
  })

  it("reports zero when nothing is expired", async () => {
    mockDeleteExpiredUploads.mockResolvedValue([])
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.count).toBe(0)
  })

  it("returns 500 when the blob delete fails", async () => {
    mockDeleteExpiredUploads.mockRejectedValue(new Error("blob down"))
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe("Cleanup failed")
  })

  it("stays open when CRON_SECRET is unset", async () => {
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth())
    expect(res.status).toBe(200)
  })

  it("returns 401 when CRON_SECRET is set but the Authorization header is wrong", async () => {
    process.env.CRON_SECRET = "s3cret"
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth("Bearer wrong"))
    expect(res.status).toBe(401)
    expect(mockDeleteExpiredUploads).not.toHaveBeenCalled()
  })

  it("proceeds when CRON_SECRET is set and the Authorization header matches", async () => {
    process.env.CRON_SECRET = "s3cret"
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth("Bearer s3cret"))
    expect(res.status).toBe(200)
  })
})
