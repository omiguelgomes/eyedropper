import { get, list, del } from "@vercel/blob"

// Uploaded images are stored in Vercel Blob rather than /tmp so every serverless
// invocation can reach them. /tmp is per-instance on Vercel, so image/suggest
// requests routed to a different Lambda than the upload saw an empty disk (the
// intermittent "image may have expired" failure). Blob is shared across all
// invocations. Objects are keyed `uploads/<uuid>` with private access.
//
// Uploads go straight from the browser to Blob via a client upload (see
// app/api/upload/route.ts) rather than being POSTed through a function, so the
// original bytes (JPEG or PNG) are stored as-is — Vercel functions cap request
// bodies at ~4.5MB, which a full-res photo blows past. The pathname has no
// extension because the content type is now variable; it is stored on the blob
// and read back via `get`.
//
// Auth: on Vercel (production/preview) OIDC is used automatically for reads
// (VERCEL_OIDC_TOKEN + BLOB_STORE_ID, injected by the platform). Locally OIDC
// is not issued for the "development" environment, so a BLOB_READ_WRITE_TOKEN
// in .env.local is passed explicitly — an explicit token wins over OIDC, and
// when the env var is absent (prod) the SDK falls back to OIDC. Note the token
// route (handleUpload) requires BLOB_READ_WRITE_TOKEN in every environment,
// including prod, because OIDC cannot mint client upload tokens.

const PREFIX = "uploads/"

// undefined in prod (no env var) → SDK uses OIDC; set locally → used directly.
const token = process.env.BLOB_READ_WRITE_TOKEN

function blobPath(id: string): string {
  return `${PREFIX}${id}`
}

// Fetch the stored image bytes and content type for server-side use (Sharp
// decode, Claude upload, same-origin proxy). Returns null when the object is
// absent (expired/cleaned up or never uploaded).
export async function getUploadBuffer(
  id: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const result = await get(blobPath(id), { access: "private", token })
  if (!result || result.statusCode !== 200) return null
  return {
    buffer: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: result.blob.contentType,
  }
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
