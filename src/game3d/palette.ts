// The box's colours, in one place. Walnut, aluminium, graphite and smoked
// glass are the materials; amber is the only accent until the finale, which
// switches to the token's blue.
export const PALETTE = {
  walnut: 0x3a2416,
  walnutPanel: 0x40281a,
  aluminum: 0xa4a8ad,
  // Small machined parts, a little brighter than the box hardware.
  aluminumBright: 0xc8ccd1,
  graphite: 0x232427,
  graphiteLight: 0x2a2b2f,
  smokedGlass: 0x0d0e10,
  amber: 0xffa63a,
  // Light thrown by amber parts: same hue, paler.
  amberLight: 0xffc98a,
  tokenBlue: 0x4d8dff,
  // Page and scene background.
  night: 0x0b0d10,
} as const;

// For canvas, SVG and CSS: 0xffa63a → "#ffa63a".
export function css(hex: number) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
