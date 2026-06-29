import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"

// vi.hoisted ensures all mock references are available in vi.mock factories (which are hoisted)
const { mockSpawn, mockReadFile, mockSharpMeta, mockCreate } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockReadFile: vi.fn(),
  mockSharpMeta: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock("child_process", () => ({
  default: { spawn: mockSpawn },
  spawn: mockSpawn,
}))

vi.mock("fs", () => ({
  default: {
    promises: { readFile: mockReadFile },
    existsSync: vi.fn(() => false),
  },
  promises: { readFile: mockReadFile },
  existsSync: vi.fn(() => false),
}))

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: mockSharpMeta })),
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mockCreate }
  },
}))

// Returns a proc that fires its events as a micro-task AFTER spawn() returns it,
// giving the route time to attach listeners.
function makeMockProc(stdoutData: string, exitCode: number) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  // fire via Promise so it runs after the synchronous listener-attachment block in route.ts
  Promise.resolve().then(() => Promise.resolve()).then(() => {
    if (stdoutData) proc.stdout.emit("data", Buffer.from(stdoutData))
    proc.emit("close", exitCode)
  })
  return proc
}

function makeMockProcStderr(stderrData: string, exitCode: number) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  Promise.resolve().then(() => Promise.resolve()).then(() => {
    proc.stderr.emit("data", Buffer.from(stderrData))
    proc.emit("close", exitCode)
  })
  return proc
}

function makeMockProcError(message: string) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  Promise.resolve().then(() => Promise.resolve()).then(() => {
    proc.emit("error", new Error(message))
  })
  return proc
}

describe("POST /api/suggest", () => {
  beforeEach(() => {
    mockSpawn.mockClear()
    mockReadFile.mockResolvedValue(Buffer.from("fake-image"))
    mockSharpMeta.mockResolvedValue({ width: 800, height: 600 })
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '[{"x":0.5,"y":0.5,"description":"test color"}]' }],
    })
    process.env.ANTHROPIC_API_KEY = "test-key"
  })

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    vi.clearAllMocks()
  })

  it("returns 200 with points for valid slic request", async () => {
    const mockPoints = [
      { x: 100, y: 200, color: "#ff0000" },
      { x: 300, y: 400, color: "#00ff00" },
    ]
    mockSpawn.mockImplementation(() => makeMockProc(JSON.stringify(mockPoints), 0))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.points).toEqual(mockPoints)
  })

  it("calls spawn with python3 and correct image path", async () => {
    const mockPoints = [{ x: 10, y: 20, color: "#aabbcc" }]
    mockSpawn.mockImplementation(() => makeMockProc(JSON.stringify(mockPoints), 0))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req as any)

    expect(mockSpawn).toHaveBeenCalledOnce()
    const [cmd, args] = mockSpawn.mock.calls[0]
    expect(cmd).toMatch(/python3$/)  // may be a venv path
    expect(args[1]).toBe("/tmp/12345678-1234-1234-1234-123456789abc/original.jpg")
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
    expect(mockSpawn).not.toHaveBeenCalled()
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

  it("returns 500 when spawn exits with non-zero code", async () => {
    mockSpawn.mockImplementation(() => makeMockProcStderr("ModuleNotFoundError: no module", 1))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it("returns 500 when spawn emits error event", async () => {
    mockSpawn.mockImplementation(() => makeMockProcError("python3 not found"))

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
    expect(mockSpawn).not.toHaveBeenCalled()
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
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it("returns 500 when stdout is not valid JSON", async () => {
    mockSpawn.mockImplementation(() => makeMockProc("not json at all", 0))

    const { POST } = await import("./route")
    const req = new Request("http://localhost/api/suggest", {
      method: "POST",
      body: JSON.stringify({ id: "12345678-1234-1234-1234-123456789abc", method: "slic" }),
      headers: { "Content-Type": "application/json" },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
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
    expect(mockSpawn).not.toHaveBeenCalled()
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
