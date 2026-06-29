import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import fs, { existsSync } from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"

const SLIC_TIMEOUT_MS = 30_000

// Reused across requests; only constructed once a Claude call is made (after the
// API-key guard), so the keyless case never instantiates it.
let anthropicClient: Anthropic | null = null

const SUGGEST_PROMPT = `Identify approximately 12 distinct, color-diverse regions in this image that would make interesting color palette annotation points. Focus on the subject, not the background.

For each point return:
- x: horizontal position as a 0.0–1.0 fraction of image width (left=0, right=1)
- y: vertical position as a 0.0–1.0 fraction of image height (top=0, bottom=1)
- description: 1–4 words describing this color zone (e.g. "warm highlight", "deep shadow")

Return ONLY a valid JSON array, no other text:
[{"x": 0.3, "y": 0.45, "description": "warm highlight"}, ...]`

export async function POST(request: NextRequest) {
  let body: { id?: string; method?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { id, method } = body ?? {}

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  if (method === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Claude not available" }, { status: 503 })
    }

    const imagePath = path.join("/tmp", id, "original.jpg")
    let buffer: Buffer
    let imageWidth: number
    let imageHeight: number
    try {
      buffer = await fs.promises.readFile(imagePath)
      const meta = await sharp(buffer).metadata()
      imageWidth = meta.width!
      imageHeight = meta.height!
    } catch {
      return NextResponse.json({ error: "Failed to read image" }, { status: 500 })
    }

    try {
      anthropicClient ??= new Anthropic()
      const response = await anthropicClient.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: buffer.toString("base64"),
              },
            },
            { type: "text", text: SUGGEST_PROMPT },
          ],
        }],
      })

      // Scan for the first text block rather than assuming index 0 — content can
      // be empty (e.g. a refusal) or lead with a non-text block.
      const textBlock = response.content.find((b) => b.type === "text")
      const text = textBlock?.type === "text" ? textBlock.text : ""
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("No JSON array in response")
      const raw: Array<{ x: number; y: number; description: string }> = JSON.parse(jsonMatch[0])

      const points = raw.map((p) => {
        if (
          !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
          p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 ||
          !p.description
        ) {
          throw new Error("Malformed point from Claude")
        }
        return {
          x: Math.round(p.x * imageWidth),
          y: Math.round(p.y * imageHeight),
          description: p.description,
        }
      })

      return NextResponse.json({ points })
    } catch {
      return NextResponse.json({ error: "Claude suggestion failed" }, { status: 500 })
    }
  }

  if (method !== "slic") {
    return NextResponse.json({ error: "Unknown method" }, { status: 400 })
  }

  const imagePath = path.join("/tmp", id, "original.jpg")
  const scriptPath = path.join(process.cwd(), "scripts", "slic_suggest.py")
  const venvPython = path.join(process.cwd(), "scripts", ".venv", "bin", "python3")
  const pythonBin = existsSync(venvPython) ? venvPython : "python3"

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(pythonBin, [scriptPath, imagePath])

    let stdout = ""
    let stderr = ""
    let settled = false

    const finish = (response: NextResponse) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(response)
    }

    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      finish(NextResponse.json({ error: "SLIC timed out" }, { status: 500 }))
    }, SLIC_TIMEOUT_MS)

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        console.error("SLIC failed:", stderr)
        finish(NextResponse.json({ error: "SLIC failed" }, { status: 500 }))
        return
      }
      try {
        const points = JSON.parse(stdout)
        finish(NextResponse.json({ points }))
      } catch {
        finish(NextResponse.json({ error: "Invalid SLIC output" }, { status: 500 }))
      }
    })

    proc.on("error", (err: Error) => {
      console.error("SLIC spawn failed:", err.message)
      finish(NextResponse.json({ error: "Spawn failed" }, { status: 500 }))
    })
  })
}
