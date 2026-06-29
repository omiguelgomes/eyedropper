import type { Style } from "./styles"

export interface LabelDefaults {
  fontSize: number
  fontFamily: string
  color: string
  visible: boolean
}

export interface EyedropperPoint {
  id: string
  x: number
  y: number
  color: string
  swatchSide: "auto" | "left" | "right" | "top" | "bottom"
  swatchOrder: number | null
  label: {
    text: string
    visible: boolean
    x: number
    y: number
    fontSize: number
    fontFamily: string
    color: string
  }
}

export interface EditorState {
  imageId: string
  imageWidth: number
  imageHeight: number
  canvasWidth: number
  canvasHeight: number
  imageOffsetY: number
  points: EyedropperPoint[]
  selectedPointId: string | null
  style: Style
  labelDefaults: LabelDefaults
}
