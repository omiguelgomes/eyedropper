export function clampToImage(
  imageX: number,
  imageY: number,
  canvasWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(canvasWidth, imageX)),
    y: Math.max(0, Math.min(imageHeight, imageY)),
  }
}
