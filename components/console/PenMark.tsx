// Tangent's assistant mark: a single-weight line drawing of the Pen with a
// short ink stroke, in the spirit of Notion's hand-drawn mascot. Replaces the
// generic sparkle icon; inherits currentColor.

export default function PenMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={className} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.6 5.4 26.6 10.4 13.2 23.8 7.4 25.6 9.2 19.8Z" />
        <path d="M19.2 7.8 24.2 12.8" />
        <path d="M9.2 19.8 13.2 23.8" />
        <path d="M4.4 28.2c2.2-.9 4.1-.2 5.9.4 1.9.6 3.6.9 5.5-.2" />
      </svg>
    </span>
  );
}
