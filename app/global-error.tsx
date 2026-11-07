"use client";

// The last resort when the root layout itself fails (audit H2). It replaces
// the whole document, so it carries its own minimal styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f7f6fb", color: "#1c1a26" }}>
        <main role="alert" style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Tangent didn&apos;t load.</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>Your tasks are safe. Try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: "none", background: "#5641b8", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
