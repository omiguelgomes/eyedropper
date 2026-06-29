export interface CanvasLayout {
  canvasWidth: number
  canvasHeight: number
  imageOffsetY: number
}

export function canvasTo916(imageWidth: number, imageHeight: number): CanvasLayout {
  const canvasWidth = imageWidth
  const canvasHeight = Math.round(imageWidth * 16 / 9)
  const imageOffsetY = imageHeight < canvasHeight
    ? Math.round((canvasHeight - imageHeight) / 2)
    : 0
  return { canvasWidth, canvasHeight, imageOffsetY }
}
