import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const dir = path.join("/tmp", id)
  const filePath = path.join(dir, "original.jpg")
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 })
  }
  // Bump the dir's mtime so the cleanup cron treats time-since-last-access,
  // not time-since-upload, as the idle TTL (see cleanup/route.ts).
  try {
    const nowDate = new Date()
    fs.utimesSync(dir, nowDate, nowDate)
  } catch {
    // Non-fatal: serving the image must not fail if the touch races a delete.
  }
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=3600",
    },
  })
}
