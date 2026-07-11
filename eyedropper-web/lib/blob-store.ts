import { put, get, list, del, type PutBlobResult } from "@vercel/blob"

// Uploaded images are stored in Vercel Blob rather than /tmp so every serverless
// invocation can reach them. /tmp is per-instance on Vercel, so image/suggest
// requests routed to a different Lambda than the upload saw an empty disk (the
// intermittent "image may have expired" failure). Blob is shared across all
// invocations. Objects are keyed `uploads/<uuid>.jpg` with private access.
//
// Auth: on Vercel (production/preview) OIDC is used automatically
// (VERCEL_OIDC_TOKEN + BLOB_STORE_ID, injected by the platform). Locally OIDC
// is not issued for the "development" environment, so a BLOB_READ_WRITE_TOKEN
// in .env.local is passed explicitly — an explicit token wins over OIDC, and
// when the env var is absent (prod) the SDK falls back to OIDC.

const PREFIX = "uploads/"

// undefined in prod (no env var) → SDK uses OIDC; set locally → used directly.
const token = process.env.BLOB_READ_WRITE_TOKEN

function blobPath(id: string): string {
  return `${PREFIX}${id}.jpg`
}

// Store the re-encoded JPEG. `addRandomSuffix: false` keeps the pathname
// deterministic so it can be re-derived from the id alone (no URL to persist).
export function putUpload(id: string, buffer: Buffer): Promise<PutBlobResult> {
  return put(blobPath(id), buffer, {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: false,
    // The id is a fresh uuid per upload, so a re-put can only be an overwrite of
    // the same logical upload; allow it rather than 409ing.
    allowOverwrite: true,
    token,
  })
}

// Fetch the stored JPEG bytes for server-side use (Sharp decode, Claude upload,
// same-origin proxy). Returns null when the object is absent (expired/cleaned up
// or never uploaded).
export async function getUploadBuffer(id: string): Promise<Buffer | null> {
  const result = await get(blobPath(id), { access: "private", token })
  if (!result || result.statusCode !== 200) return null
  return Buffer.from(await new Response(result.stream).arrayBuffer())
}

// Delete every upload blob older than maxAgeMs (by Blob's uploadedAt). Returns
// the pathnames deleted. Used by the cleanup cron.
export async function deleteExpiredUploads(now: number, maxAgeMs: number): Promise<string[]> {
  const { blobs } = await list({ prefix: PREFIX, token })
  const expired = blobs.filter((b) => now - b.uploadedAt.getTime() > maxAgeMs)
  if (expired.length === 0) return []
  await del(expired.map((b) => b.url), { token })
  return expired.map((b) => b.pathname)
}
