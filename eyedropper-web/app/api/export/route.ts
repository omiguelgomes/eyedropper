import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

// Cap the incoming data URL so a large or concurrent request cannot allocate an
// unbounded decode buffer (plus Sharp's working memory) and pressure the server.
const MAX_DATA_URL_BYTES = 50 * 1024 * 1024

export async function POST(request: NextRequest) {
  // Reject oversized bodies before buffering them into memory.
  const contentLength = Number(request.headers.get("content-length"))
  if (contentLength > MAX_DATA_URL_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  let body: { dataUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { dataUrl } = body ?? {}
  if (typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Invalid data URL" }, { status: 400 })
  }

  // Belt-and-suspenders to the content-length guard above (the header can be
  // absent): cap the parsed string before decoding.
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  // Match the prefix and capture the payload in one pass so validation and
  // stripping cannot disagree: require a raster MIME and an explicit `;base64,`
  // (an SVG or non-base64 data URL would otherwise pass a loose startsWith check
  // and feed the raw prefix to Buffer.from as garbage).
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/)
  if (!match) {
    return NextResponse.json({ error: "Invalid data URL" }, { status: 400 })
  }

  // The incoming data URL is already the final 9:16 bitmap at the correct
  // resolution (the client sets pixelRatio). Sharp only re-encodes PNG→JPEG q95;
  // it must NOT resize, pad, or otherwise alter the dimensions.
  const buffer = Buffer.from(match[1], "base64")
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Invalid data URL" }, { status: 400 })
  }

  try {
    const jpeg = await sharp(buffer).jpeg({ quality: 95 }).toBuffer()
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="eyedropper-export.jpg"',
      },
    })
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
