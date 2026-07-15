import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"

// Vercel functions cap request bodies at ~4.5MB, so a full-res photo POSTed here
// would be rejected with a 413 before the handler ran. Instead the browser
// uploads the file directly to Vercel Blob; this route only mints the
// short-lived client token (handleUpload), enforcing the type/size limits and
// pathname it is allowed to write. See lib/blob-store.ts for storage details.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

// Client uploads to `uploads/<uuid>` (no extension — the content type is stored
// on the blob). Reject any other pathname so a token can't be minted for an
// arbitrary write.
const ALLOWED_PATHNAME = /^uploads\/[0-9a-f-]{36}$/

// Minting client tokens requires the static read-write token; OIDC alone
// cannot. Vercel provisions BLOB_READ_WRITE_TOKEN automatically when a Blob
// store is connected to the project, in every environment.
const token = process.env.BLOB_READ_WRITE_TOKEN

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        if (!ALLOWED_PATHNAME.test(pathname)) {
          throw new Error("Invalid upload path")
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
