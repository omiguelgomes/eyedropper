export function clampToImage(
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(imageWidth, imageX)),
    y: Math.max(0, Math.min(imageHeight, imageY)),
  }
}
