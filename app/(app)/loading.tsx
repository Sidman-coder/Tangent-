// Shown while an app page loads, instead of a blank screen (audit H2).
export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-dot" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
