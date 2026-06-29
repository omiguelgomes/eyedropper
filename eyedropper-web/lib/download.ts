// Trigger a browser download of a Blob as `filename`. The `download` attribute
// plus a same-origin object URL is what makes the browser save the file instead
// of navigating/opening a new tab.
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick, not synchronously: some browsers (notably Safari)
  // dispatch the download asynchronously and revoking the object URL inline can
  // abort it for larger blobs.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
