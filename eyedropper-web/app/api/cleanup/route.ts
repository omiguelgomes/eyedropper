import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const MAX_AGE_MS = 60 * 60 * 1000
const UUID_RE = /^[0-9a-f-]{36}$/

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  const tmpDir = "/tmp"

  let entries: string[]
  try {
    entries = fs.readdirSync(tmpDir)
  } catch (err) {
    console.error("Cleanup failed to read /tmp:", err)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }

  const deleted: string[] = []
  for (const name of entries) {
    if (!UUID_RE.test(name)) continue
    const full = path.join(tmpDir, name)
    try {
      const stat = fs.statSync(full)
      if (!stat.isDirectory()) continue
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        fs.rmSync(full, { recursive: true, force: true })
        deleted.push(name)
      }
    } catch (err) {
      console.error(`Cleanup skipped /tmp/${name}:`, err)
      continue
    }
  }

  return NextResponse.json({ deleted, count: deleted.length })
}
