// One color ramp for urgency, shared by the WebGL orb, its static fallback,
// and the section glow so all three always agree. Color means urgency here:
// calm accent violet → amber → red, never decoration.

type RGB = [number, number, number];

const CALM: RGB = [124, 92, 255]; // --accent (dark theme value, reads on both)
const WARN: RGB = [245, 166, 35]; // --amber
const HOT: RGB = [239, 68, 68]; //  --red

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** sRGB 0–255 for an urgency score in [0, 1]. */
export function urgencyRgb(score: number): RGB {
  const s = Math.min(1, Math.max(0, score));
  return s < 0.5 ? mix(CALM, WARN, s / 0.5) : mix(WARN, HOT, (s - 0.5) / 0.5);
}

/** "r g b" for use inside rgb(var(--x) / alpha). */
export function urgencyRgbVar(score: number): string {
  return urgencyRgb(score).map((v) => Math.round(v)).join(" ");
}
