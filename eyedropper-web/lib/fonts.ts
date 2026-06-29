import {
  Cormorant_Garamond,
  Playfair_Display,
  Inter,
  DM_Serif_Display,
  Libre_Baskerville,
} from "next/font/google"

// next/font/google calls must be at module scope with literal args (build-time
// analyzed). Each returns an object exposing `.style.fontFamily` (the resolved
// @font-face family Konva/CSS must render with) and `.variable` (a CSS-variable
// class to attach to <body> so the @font-face rules exist document-wide).
const cormorant = Cormorant_Garamond({
  weight: "500",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
})
const playfair = Playfair_Display({
  style: "italic",
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
})
const libre = Libre_Baskerville({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-libre",
  display: "swap",
})

// CSS-variable class names for app/layout.tsx to attach to <body>.
export const fontVariables = [
  cormorant.variable,
  playfair.variable,
  inter.variable,
  dmSerif.variable,
  libre.variable,
]

// The 6 dropdown options in exact AC7 order. `label` is the stored,
// human-readable value (also shown in the dropdown); `family` is the resolved
// render family. "System" uses the device default serif (UX-DR12 / UI.md:167).
export const FONT_OPTIONS: { label: string; family: string }[] = [
  { label: "Cormorant Garamond Italic", family: cormorant.style.fontFamily },
  { label: "Playfair Display Italic", family: playfair.style.fontFamily },
  { label: "Inter", family: inter.style.fontFamily },
  { label: "DM Serif Display", family: dmSerif.style.fontFamily },
  { label: "Libre Baskerville Italic", family: libre.style.fontFamily },
  { label: "System", family: "serif" },
]

// Map a stored label.fontFamily (human label) to the actual render family.
// Falls back to the passed string (or "serif") if not a known option. Pure.
export function resolveFontFamily(label: string): string {
  const match = FONT_OPTIONS.find((o) => o.label === label)
  return match ? match.family : label || "serif"
}
