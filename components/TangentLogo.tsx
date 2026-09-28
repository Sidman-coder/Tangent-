import { useId } from "react";

// Tangent's logo, the P2 "Touch" mark: a straight line that touches the curve
// (you) at exactly one point, then rises past it to the dot (your goal).
// Geometry and colors come from the brand kit and stay fixed regardless of
// the app theme; the "tile" variant is the app-icon version on an iris tile.

const LINE = { x1: -76.109, y1: -15.473, x2: -2.736, y2: -86.328 };
const ARC = "M -51.494 7.237 A 52 52 0 0 1 12.58 -50.455";

export default function TangentLogo({
  size = 30,
  variant = "tile",
  className,
}: {
  size?: number;
  variant?: "tile" | "mark";
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const tile = variant === "tile";
  const curve = tile ? "#F5F3FA" : "#B3A5F0";
  const scale = tile ? 0.55856 : 0.75676;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {tile && (
        <>
          <defs>
            <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5B48A8" />
              <stop offset="1" stopColor="#372A70" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="22" fill={`url(#${id}-tile)`} />
        </>
      )}
      <g transform={`translate(50 50) scale(${scale}) translate(31.750 42.250)`}>
        <linearGradient id={`${id}-line`} gradientUnits="userSpaceOnUse" {...LINE}>
          <stop offset="0.431" stopColor={curve} />
          <stop offset="1" stopColor="#5CC8BD" />
        </linearGradient>
        <path d={ARC} fill="none" stroke={curve} strokeWidth="12" strokeLinecap="round" />
        <line {...LINE} stroke={`url(#${id}-line)`} strokeWidth="12" strokeLinecap="round" />
        <circle cx={LINE.x2} cy={LINE.y2} r="11.4" fill="#5CC8BD" />
      </g>
    </svg>
  );
}
