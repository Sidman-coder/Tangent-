"use client";

import Link from "next/link";
import { useEffect } from "react";
import TangentLogo from "@/components/TangentLogo";

// A page that failed to render: a calm way to retry instead of Next's default
// screen (audit H2). The error's text is never shown; it can hold internals.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.warn("[page] render failed", error.digest ?? "");
  }, [error]);

  return (
    <main className="not-found" id="main-content">
      <div className="not-found-card" role="alert">
        <TangentLogo size={48} />
        <h1>This page didn&apos;t load.</h1>
        <p>Your tasks are safe. Try again, or go back to Today.</p>
        <button type="button" className="not-found-home" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="not-found-home">
          Back to Today
        </Link>
      </div>
    </main>
  );
}
