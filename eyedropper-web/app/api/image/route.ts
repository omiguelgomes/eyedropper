import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const filePath = path.join("/tmp", id, "original.jpg")
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 })
  }
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=3600",
    },
  })
}
