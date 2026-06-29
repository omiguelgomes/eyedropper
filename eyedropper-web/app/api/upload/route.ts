import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import fs from "fs"
import path from "path"
import crypto from "crypto"

// Cap the upload so a large or concurrent request cannot buffer an unbounded
// body into memory before Sharp ever sees it.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"))
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const dir = path.join("/tmp", id)
  fs.mkdirSync(dir, { recursive: true })

  try {
    const buffer = Buffer.from(await (file as File).arrayBuffer())
    const image = sharp(buffer)
    const metadata = await image.metadata()

    if (metadata.width == null || metadata.height == null) {
      return NextResponse.json({ error: "Could not read image dimensions" }, { status: 400 })
    }

    await image.jpeg({ quality: 95 }).toFile(path.join(dir, "original.jpg"))

    return NextResponse.json({
      id,
      width: metadata.width,
      height: metadata.height,
    })
  } catch {
    return NextResponse.json({ error: "Invalid or corrupt image" }, { status: 400 })
  }
}
