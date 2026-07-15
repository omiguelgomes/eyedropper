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
  const upload = await getUploadBuffer(id)
  if (!upload) {
    return new NextResponse("Not found", { status: 404 })
  }
  return new NextResponse(new Uint8Array(upload.buffer), {
    headers: {
      "Content-Type": upload.contentType,
      "Cache-Control": "max-age=3600",
    },
  })
}
