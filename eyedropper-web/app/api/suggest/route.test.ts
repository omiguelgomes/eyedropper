import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

// vi.hoisted ensures all mock references are available in vi.mock factories (which are hoisted)
const { mockReadFile, mockSharpMeta, mockSharpToBuffer, mockSuggestPoints, mockCreate, mockUtimesSync } =
  vi.hoisted(() => ({
    mockReadFile: vi.fn(),
    mockSharpMeta: vi.fn(),
    mockSharpToBuffer: vi.fn(),
    mockSuggestPoints: vi.fn(),
    mockCreate: vi.fn(),
    mockUtimesSync: vi.fn(),
  }))

vi.mock("fs", () => ({
  default: {
    promises: { readFile: mockReadFile },
    utimesSync: mockUtimesSync,
  },
  promises: { readFile: mockReadFile },
  utimesSync: mockUtimesSync,
}))

// Sharp is a chainable builder; every transform returns `this`, terminating in
// metadata() (Claude + SLIC) or toBuffer() (SLIC raw pixels).
vi.mock("sharp", () => {
  const chain: any = {
    metadata: mockSharpMeta,
    resize: vi.fn(() => chain),
    removeAlpha: vi.fn(() => chain),
    raw: vi.fn(() => chain),
    toBuffer: mockSharpToBuffer,
  }
  return { default: vi.fn(() => chain) }
})

vi.mock("@/lib/slic-suggest", () => ({
  suggestPoints: mockSuggestPoints,
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mockCreate }
  },
}))

describe("POST /api/suggest", () => {
  beforeEach(() => {
    mockReadFile.mockResolvedValue(Buffer.from("fake-image"))
    mockSharpMeta.mockResolvedValue({ width: 800, height: 600 })
    // Raw pixel buffer at the downscaled size; content is irrelevant since
    // suggestPoints is mocked. info dimensions drive the coordinate scale-back.
    mockSharpToBuffer.mockResolvedValue({
      data: Buffer.alloc(0),
      info: { width: 400, height: 300 },
    })
    mockSuggestPoints.mockReturnValue([{ x: 50, y: 100, color: "#ff0000" }])
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":0.5,"y":0.5,"description":"test color"}]' }],
    })
    process.env.ANTHROPIC_API_KEY = "test-key"
  })

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    vi.clearAllMocks()
  })

  it("returns 200 with points scaled back to original pixels for valid slic request", async () => {
    // Downscaled buffer is 400×300; original meta is 800×600, so a point at
    // (50,100) in the downscaled space maps to (100,200) at full res.
    mockSuggestPoints.mockReturnValue([
      { x: 50, y: 100, color: "#ff0000" },
      { x: 150, y: 200, color: "#00ff00" },
    ])

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.points).toEqual([
      { x: 100, y: 200, color: "#ff0000" },
      { x: 300, y: 400, color: "#00ff00" },
    ])
  })

  it("touches the upload dir mtime before running slic (idle TTL for cleanup cron)", async () => {
    const { POST } = await import("./route")
    const id = "12345678-1234-1234-1234-123456789abc"
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id, method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(req as any)
    expect(mockUtimesSync).toHaveBeenCalledWith(`/tmp/${id}`, expect.any(Date), expect.any(Date))
  })

  it("touches the upload dir mtime on the claude path too", async () => {
    const { POST } = await import("./route")
    const id = "12345678-1234-1234-1234-123456789abc"
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id, method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(req as any)
    expect(mockUtimesSync).toHaveBeenCalledWith(`/tmp/${id}`, expect.any(Date), expect.any(Date))
  })

  it("passes the downscaled raw pixels to suggestPoints", async () => {
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req as any)

    expect(mockSuggestPoints).toHaveBeenCalledOnce()
    const [img] = mockSuggestPoints.mock.calls[0]
    expect(img).toEqual({ width: 400, height: 300, data: expect.anything() })
  })

  it("returns 400 for invalid UUID", async () => {
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "../etc/passwd", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect(mockSuggestPoints).not.toHaveBeenCalled()
  })

  it("returns 400 for missing id", async () => {
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it("returns 500 when the image can't be read", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when sharp raw decoding fails", async () => {
    mockSharpToBuffer.mockRejectedValue(new Error("bad image"))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 400 for an unknown method", async () => {
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "magic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect(mockSuggestPoints).not.toHaveBeenCalled()
  })

  it("returns 400 for a malformed JSON body", async () => {
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    expect(mockSuggestPoints).not.toHaveBeenCalled()
  })

  it("returns 503 for claude method when no API key", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(503)
    expect(mockSuggestPoints).not.toHaveBeenCalled()
  })

  it("returns 200 with points for valid claude request", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":0.25,"y":0.5,"description":"warm highlight"},{"x":0.75,"y":0.25,"description":"deep shadow"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.points).toHaveLength(2)
    expect(json.points[0]).toEqual({ x: 200, y: 300, description: "warm highlight" })
    expect(json.points[1]).toEqual({ x: 600, y: 150, description: "deep shadow" })
  })

  it("returns 500 when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Sorry, I cannot help with that." }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when readFile throws", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when Anthropic SDK throws", async () => {
    mockCreate.mockRejectedValue(new Error("API error"))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when Claude returns an out-of-range coordinate", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":1.5,"y":0.5,"description":"too far right"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when Claude returns a negative coordinate", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":-0.1,"y":0.5,"description":"off canvas"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when Claude returns a non-numeric coordinate", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":"warm","y":0.5,"description":"not a number"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when Claude returns a null coordinate", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":null,"y":0.5,"description":"null x"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("accepts boundary coordinates 0 and 1", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":0,"y":1,"description":"corner"}]' }],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.points[0]).toEqual({ x: 0, y: 600, description: "corner" })
  })

  it("returns 500 when Claude response content is empty (refusal)", async () => {
    mockCreate.mockResolvedValue({ content: [] })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("finds the text block when a non-text block leads the content array", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "thinking", thinking: "considering the image" },
        { type: "text", text: '[{"x":0.5,"y":0.5,"description":"center"}]' },
      ],
    })

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "claude" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.points[0]).toEqual({ x: 400, y: 300, description: "center" })
  })
})
