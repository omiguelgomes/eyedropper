"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { validateFile, formatSize } from "@/lib/upload-utils"

export default function Upload() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024)
  }, [])

  function handleFile(file: File) {
    const err = validateFile(file)
    if (err) {
      setError(err)
      setSelectedFile(null)
      return
    }
    setError(null)
    setSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", selectedFile)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      if (!res.ok) {
        setError("Upload failed. Please try again.")
        setUploading(false)
        return
      }
      const data = await res.json()
      router.push(`/editor?id=${data.id}`)
    } catch {
      setError("Upload failed. Please try again.")
      setUploading(false)
    }
  }

  // null = not yet measured (SSR / first paint); avoid rendering until measured to prevent hydration mismatch
  if (isMobile === null) return null

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <p className="text-[var(--color-text-secondary)] text-center px-8">
          Please open this app on a desktop (1024px+).
        </p>
      </div>
    )
  }

  const borderColor = isDragOver
    ? "border-[var(--color-accent)]"
    : "border-[var(--color-border)]"

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-6">
        <div
          className={`w-[400px] h-[300px] border-2 border-dashed ${borderColor} rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 hover:border-[var(--color-accent)]`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="text-center px-6">
              <p className="text-[var(--color-text-primary)] font-medium text-sm break-all">{selectedFile.name}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{formatSize(selectedFile.size)}</p>
            </div>
          ) : (
            <div className="text-center px-6">
              <p className="text-[var(--color-text-primary)] text-sm">Drop image here</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">or click to pick</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-3">JPEG or PNG · max 20MB</p>
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          ref={inputRef}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {error && (
          <p className="text-red-500 text-sm text-center max-w-[400px]">{error}</p>
        )}

        {selectedFile && !error && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-60 transition-colors duration-150"
          >
            {uploading ? "Uploading…" : "Continue →"}
          </button>
        )}
      </div>
    </div>
  )
}
