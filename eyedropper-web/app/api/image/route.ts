import { NextRequest, NextResponse } from "next/server"
import { getUploadBuffer } from "@/lib/blob-store"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 })
  }
  // Proxy the bytes same-origin rather than redirecting to the blob URL: the
  // client draws this onto a canvas for pixel color sampling, and a cross-origin
  // image would taint the canvas and break getImageData.
  const buffer = await getUploadBuffer(id)
  if (!buffer) {
    return new NextResponse("Not found", { status: 404 })
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=3600",
    },
  })
}
