import { NextRequest, NextResponse } from "next/server"
import { deleteExpiredUploads } from "@/lib/blob-store"

const MAX_AGE_MS = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()

  try {
    const deleted = await deleteExpiredUploads(now, MAX_AGE_MS)
    return NextResponse.json({ deleted, count: deleted.length })
  } catch (err) {
    console.error("Cleanup failed:", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}
