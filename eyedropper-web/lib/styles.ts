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
  // Optional pastel/textured-swatch fields (Story 3.5). Absent on the four flat
  // built-in styles, which fall back to the crisp fill+stroke Circle render.
  // Public paths under /textures served from public/textures/.
  swatchTexture?: string
  borderTexture?: string
}

export function loadStyles(): Style[] {
  return stylesJson as Style[]
}
