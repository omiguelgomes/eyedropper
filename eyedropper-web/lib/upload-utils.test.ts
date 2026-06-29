import { describe, it, expect } from "vitest"
import { validateFile, formatSize, MAX_SIZE } from "./upload-utils"

function makeFile(name: string, type: string, size: number): File {
  const buf = new ArrayBuffer(size)
  return new File([buf], name, { type })
}

describe("validateFile", () => {
  it("accepts JPEG", () => {
    expect(validateFile(makeFile("a.jpg", "image/jpeg", 100))).toBeNull()
  })

  it("accepts PNG", () => {
    expect(validateFile(makeFile("a.png", "image/png", 100))).toBeNull()
  })

  it("rejects non-image type", () => {
    expect(validateFile(makeFile("a.pdf", "application/pdf", 100))).toBe(
      "Only JPEG and PNG files are supported."
    )
  })

  it("rejects WebP", () => {
    expect(validateFile(makeFile("a.webp", "image/webp", 100))).toBe(
      "Only JPEG and PNG files are supported."
    )
  })

  it("rejects empty MIME type", () => {
    expect(validateFile(makeFile("unknown", "", 100))).toBe(
      "Only JPEG and PNG files are supported."
    )
  })

  it("rejects file exactly at limit + 1 byte", () => {
    expect(validateFile(makeFile("big.jpg", "image/jpeg", MAX_SIZE + 1))).toBe(
      "File must be under 20MB."
    )
  })

  it("accepts file exactly at limit", () => {
    expect(validateFile(makeFile("exact.jpg", "image/jpeg", MAX_SIZE))).toBeNull()
  })
})

describe("formatSize", () => {
  it("formats KB for sizes under 1MB", () => {
    expect(formatSize(512 * 1024)).toBe("512.0 KB")
  })

  it("formats MB for sizes 1MB and above", () => {
    expect(formatSize(1.5 * 1024 * 1024)).toBe("1.5 MB")
  })

  it("formats exactly 1MB as MB", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB")
  })

  it("formats small KB with one decimal", () => {
    expect(formatSize(1024)).toBe("1.0 KB")
  })

  it("formats zero bytes as KB", () => {
    expect(formatSize(0)).toBe("0.0 KB")
  })

  it("formats just under 1MB as KB", () => {
    expect(formatSize(1024 * 1024 - 1)).toBe("1024.0 KB")
  })
})
