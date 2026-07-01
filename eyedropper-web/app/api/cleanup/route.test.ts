import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockReaddirSync = vi.fn()
const mockStatSync = vi.fn()
const mockRmSync = vi.fn()

vi.mock("fs", () => ({
  default: {
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    rmSync: mockRmSync,
  },
}))

const FIXED_NOW = 1_700_000_000_000
const HOUR_MS = 60 * 60 * 1000
const UUID = "550e8400-e29b-41d4-a716-446655440000"
const UUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

function dirStat(mtimeMs: number) {
  return { isDirectory: () => true, mtimeMs }
}

function reqWithAuth(authorization?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? authorization ?? null : null) } } as any
}

describe("GET /api/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.CRON_SECRET
  })

  it("deletes a UUID dir older than 1 hour (AC2)", async () => {
    mockReaddirSync.mockReturnValue([UUID])
    mockStatSync.mockReturnValue(dirStat(FIXED_NOW - 2 * HOUR_MS))
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockRmSync).toHaveBeenCalledWith(`/tmp/${UUID}`, { recursive: true, force: true })
    expect(body.deleted).toContain(UUID)
    expect(body.count).toBe(1)
  })

  it("leaves a UUID dir younger than 1 hour untouched (AC3)", async () => {
    mockReaddirSync.mockReturnValue([UUID])
    mockStatSync.mockReturnValue(dirStat(FIXED_NOW - 60 * 1000))
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(mockRmSync).not.toHaveBeenCalled()
    expect(body.deleted).not.toContain(UUID)
    expect(body.count).toBe(0)
  })

  it("does not delete a dir exactly 1 hour old, but deletes one just over (strict >, boundary)", async () => {
    mockReaddirSync.mockReturnValue([UUID, UUID2])
    mockStatSync.mockImplementation((full: string) => {
      if (full === `/tmp/${UUID}`) return dirStat(FIXED_NOW - HOUR_MS) // exactly 1h
      return dirStat(FIXED_NOW - HOUR_MS - 1) // just over 1h
    })
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(mockRmSync).not.toHaveBeenCalledWith(`/tmp/${UUID}`, expect.anything())
    expect(mockRmSync).toHaveBeenCalledWith(`/tmp/${UUID2}`, { recursive: true, force: true })
    expect(body.deleted).toEqual([UUID2])
  })

  it("ignores entries not matching the UUID pattern (AC5)", async () => {
    mockReaddirSync.mockReturnValue(["some-os-tempfile", "T"])
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(mockStatSync).not.toHaveBeenCalled()
    expect(mockRmSync).not.toHaveBeenCalled()
    expect(body.count).toBe(0)
  })

  it("ignores a UUID-named entry that is not a directory (AC5)", async () => {
    mockReaddirSync.mockReturnValue([UUID])
    mockStatSync.mockReturnValue({ isDirectory: () => false, mtimeMs: FIXED_NOW - 2 * HOUR_MS })
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(mockRmSync).not.toHaveBeenCalled()
    expect(body.count).toBe(0)
  })

  it("skips an entry that throws and continues with the rest (AC6)", async () => {
    mockReaddirSync.mockReturnValue([UUID, UUID2])
    mockStatSync.mockImplementation((full: string) => {
      if (full === `/tmp/${UUID}`) throw new Error("ENOENT: gone concurrently")
      return dirStat(FIXED_NOW - 2 * HOUR_MS)
    })
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(mockRmSync).toHaveBeenCalledWith(`/tmp/${UUID2}`, { recursive: true, force: true })
    expect(body.deleted).toEqual([UUID2])
  })

  it("returns 500 when /tmp cannot be read (AC1)", async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("EACCES")
    })
    const { GET } = await import("./route")
    const res = await GET({} as any)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe("Cleanup failed")
  })

  it("stays open when CRON_SECRET is unset", async () => {
    mockReaddirSync.mockReturnValue([])
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth())
    expect(res.status).toBe(200)
  })

  it("returns 401 when CRON_SECRET is set but the Authorization header is wrong", async () => {
    process.env.CRON_SECRET = "s3cret"
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth("Bearer wrong"))
    expect(res.status).toBe(401)
    expect(mockReaddirSync).not.toHaveBeenCalled()
  })

  it("proceeds when CRON_SECRET is set and the Authorization header matches", async () => {
    process.env.CRON_SECRET = "s3cret"
    mockReaddirSync.mockReturnValue([])
    const { GET } = await import("./route")
    const res = await GET(reqWithAuth("Bearer s3cret"))
    expect(res.status).toBe(200)
  })
})
