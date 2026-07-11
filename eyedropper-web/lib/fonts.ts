import {
  // Serif
  Cormorant_Garamond,
  Playfair_Display,
  DM_Serif_Display,
  Libre_Baskerville,
  EB_Garamond,
  Lora,
  Merriweather,
  Crimson_Text,
  // Handwriting
  Caveat,
  Dancing_Script,
  Pacifico,
  Satisfy,
  Sacramento,
  Shadows_Into_Light,
  Kalam,
  Gochi_Hand,
  // Sans
  Inter,
  Montserrat,
  Poppins,
  Raleway,
  Work_Sans,
  Nunito,
  Quicksand,
  // Display
  Bebas_Neue,
  Abril_Fatface,
  Lobster,
  Righteous,
  Comfortaa,
  Cinzel,
  Archivo_Black,
} from "next/font/google"

// next/font/google calls must be at module scope with literal args (build-time
// analyzed). Each returns an object exposing `.style.fontFamily` (the resolved
// @font-face family Konva/CSS must render with) and `.variable` (a CSS-variable
// class to attach to <body> so the @font-face rules exist document-wide).
// Variable fonts omit `weight`; fixed-weight faces pass an explicit "400" (or
// the weight that exists). The three original italic faces keep their italic
// style so labels created before this expansion render unchanged.

// --- Serif -----------------------------------------------------------------
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
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap",
})
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
})
const merriweather = Merriweather({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
})
const crimson = Crimson_Text({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-crimson",
  display: "swap",
})

// --- Handwriting -----------------------------------------------------------
// Caveat is the companion handwriting font for the pastel style (Story 3.5).
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
})
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
})
const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pacifico",
  display: "swap",
})
const satisfy = Satisfy({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-satisfy",
  display: "swap",
})
const sacramento = Sacramento({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sacramento",
  display: "swap",
})
const shadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-shadows-into-light",
  display: "swap",
})
const kalam = Kalam({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-kalam",
  display: "swap",
})
const gochiHand = Gochi_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gochi-hand",
  display: "swap",
})

// --- Sans ------------------------------------------------------------------
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
})
const poppins = Poppins({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
})
const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  display: "swap",
})
const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
})
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
})
const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
})

// --- Display ---------------------------------------------------------------
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
})
const abrilFatface = Abril_Fatface({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-abril-fatface",
  display: "swap",
})
const lobster = Lobster({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lobster",
  display: "swap",
})
const righteous = Righteous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-righteous",
  display: "swap",
})
const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  display: "swap",
})
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
})
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
})

// CSS-variable class names for app/layout.tsx to attach to <body>.
export const fontVariables = [
  cormorant.variable,
  playfair.variable,
  dmSerif.variable,
  libre.variable,
  ebGaramond.variable,
  lora.variable,
  merriweather.variable,
  crimson.variable,
  caveat.variable,
  dancingScript.variable,
  pacifico.variable,
  satisfy.variable,
  sacramento.variable,
  shadowsIntoLight.variable,
  kalam.variable,
  gochiHand.variable,
  inter.variable,
  montserrat.variable,
  poppins.variable,
  raleway.variable,
  workSans.variable,
  nunito.variable,
  quicksand.variable,
  bebasNeue.variable,
  abrilFatface.variable,
  lobster.variable,
  righteous.variable,
  comfortaa.variable,
  cinzel.variable,
  archivoBlack.variable,
]

export type FontCategory = "Serif" | "Handwriting" | "Sans" | "Display"

// The dropdown options, grouped by category for <optgroup> rendering in
// LabelPanel. `label` is the stored, human-readable value (also shown in the
// dropdown); `family` is the resolved render family. "System" uses the device
// default serif (UX-DR12 / UI.md:167). Cormorant Garamond Italic stays first so
// it remains the default seed in apiPointsToEyedroppers.
export const FONT_OPTIONS: { label: string; family: string; category: FontCategory }[] = [
  // Serif
  { label: "Cormorant Garamond Italic", family: cormorant.style.fontFamily, category: "Serif" },
  { label: "Playfair Display Italic", family: playfair.style.fontFamily, category: "Serif" },
  { label: "DM Serif Display", family: dmSerif.style.fontFamily, category: "Serif" },
  { label: "Libre Baskerville Italic", family: libre.style.fontFamily, category: "Serif" },
  { label: "EB Garamond", family: ebGaramond.style.fontFamily, category: "Serif" },
  { label: "Lora", family: lora.style.fontFamily, category: "Serif" },
  { label: "Merriweather", family: merriweather.style.fontFamily, category: "Serif" },
  { label: "Crimson Text", family: crimson.style.fontFamily, category: "Serif" },
  { label: "System", family: "serif", category: "Serif" },
  // Handwriting
  { label: "Caveat", family: caveat.style.fontFamily, category: "Handwriting" },
  { label: "Dancing Script", family: dancingScript.style.fontFamily, category: "Handwriting" },
  { label: "Pacifico", family: pacifico.style.fontFamily, category: "Handwriting" },
  { label: "Satisfy", family: satisfy.style.fontFamily, category: "Handwriting" },
  { label: "Sacramento", family: sacramento.style.fontFamily, category: "Handwriting" },
  { label: "Shadows Into Light", family: shadowsIntoLight.style.fontFamily, category: "Handwriting" },
  { label: "Kalam", family: kalam.style.fontFamily, category: "Handwriting" },
  { label: "Gochi Hand", family: gochiHand.style.fontFamily, category: "Handwriting" },
  // Sans
  { label: "Inter", family: inter.style.fontFamily, category: "Sans" },
  { label: "Montserrat", family: montserrat.style.fontFamily, category: "Sans" },
  { label: "Poppins", family: poppins.style.fontFamily, category: "Sans" },
  { label: "Raleway", family: raleway.style.fontFamily, category: "Sans" },
  { label: "Work Sans", family: workSans.style.fontFamily, category: "Sans" },
  { label: "Nunito", family: nunito.style.fontFamily, category: "Sans" },
  { label: "Quicksand", family: quicksand.style.fontFamily, category: "Sans" },
  // Display
  { label: "Bebas Neue", family: bebasNeue.style.fontFamily, category: "Display" },
  { label: "Abril Fatface", family: abrilFatface.style.fontFamily, category: "Display" },
  { label: "Lobster", family: lobster.style.fontFamily, category: "Display" },
  { label: "Righteous", family: righteous.style.fontFamily, category: "Display" },
  { label: "Comfortaa", family: comfortaa.style.fontFamily, category: "Display" },
  { label: "Cinzel", family: cinzel.style.fontFamily, category: "Display" },
  { label: "Archivo Black", family: archivoBlack.style.fontFamily, category: "Display" },
]

// Category order for grouped rendering in the font dropdown.
export const FONT_CATEGORIES: FontCategory[] = ["Serif", "Handwriting", "Sans", "Display"]

// Map a stored label.fontFamily (human label) to the actual render family.
// Falls back to the passed string (or "serif") if not a known option. Pure.
export function resolveFontFamily(label: string): string {
  const match = FONT_OPTIONS.find((o) => o.label === label)
  return match ? match.family : label || "serif"
}
