import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"
import { suggestPoints } from "@/lib/slic-suggest"
import { getUploadBuffer } from "@/lib/blob-store"

// SLIC runs in-process (Vercel's Node runtime has no python3). Segmenting a
// full-res JPEG in JS is slow, so we downscale to this max dimension, run SLIC,
// then scale the resulting points back to original-image pixel coordinates.
const SLIC_MAX_DIM = 500

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

    let buffer: Buffer
    let mediaType: string
    let imageWidth: number
    let imageHeight: number
    try {
      const stored = await getUploadBuffer(id)
      if (!stored) throw new Error("Upload not found")
      buffer = stored.buffer
      mediaType = stored.contentType
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
                media_type: mediaType as "image/jpeg" | "image/png",
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

  try {
    const stored = await getUploadBuffer(id)
    if (!stored) {
      console.error("SLIC failed: upload not found for", id)
      return NextResponse.json({ error: "SLIC failed" }, { status: 500 })
    }
    const buffer = stored.buffer
    const meta = await sharp(buffer).metadata()
    const origW = meta.width!
    const origH = meta.height!

    // Downscale for speed; SLIC quality is scale-invariant for point placement.
    const scale = Math.min(1, SLIC_MAX_DIM / Math.max(origW, origH))
    const { data, info } = await sharp(buffer)
      .resize({
        width: Math.max(1, Math.round(origW * scale)),
        height: Math.max(1, Math.round(origH * scale)),
        fit: "fill",
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // The Python size filter (minSize=200) is area-based at full res, so scale
    // it by the downscale ratio² to keep the same effective filtering.
    const minSize = Math.max(1, Math.round(200 * scale * scale))
    const pts = suggestPoints(
      { width: info.width, height: info.height, data },
      12,
      28.0,
      minSize
    )

    // Map back to original-image pixel coordinates (clients expect these).
    const sx = origW / info.width
    const sy = origH / info.height
    const points = pts.map((p) => ({
      x: Math.round(p.x * sx),
      y: Math.round(p.y * sy),
      color: p.color,
    }))

    return NextResponse.json({ points })
  } catch (err) {
    console.error("SLIC failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "SLIC failed" }, { status: 500 })
  }
}
