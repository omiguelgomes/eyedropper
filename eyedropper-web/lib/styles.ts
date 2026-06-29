import stylesJson from "../styles.json"

export interface Style {
  name: string
  swatchRadius: number
  swatchBorderColor: string
  swatchBorderWidth: number
  connectorType: "curved" | "straight" | "none"
  connectorColor: string
  connectorWidth: number
  markerStyle: "ring" | "dot" | "none"
  markerColor: string
  labelPosition: "beside" | "below" | "none"
}

export function loadStyles(): Style[] {
  return stylesJson as Style[]
}
