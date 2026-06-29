export const VALID_TYPES = ["image/jpeg", "image/png"]
export const MAX_SIZE = 20 * 1024 * 1024

export function validateFile(file: File): string | null {
  if (!VALID_TYPES.includes(file.type)) return "Only JPEG and PNG files are supported."
  if (file.size > MAX_SIZE) return "File must be under 20MB."
  return null
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
