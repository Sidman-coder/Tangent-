"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";

export default function SignInForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [sent, setSent] = useState(false);
  const dest = safeNext(next);

  const signInWithGoogle = async () => {
    setBusy("google");
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
    });
    if (error) {
      setError("Couldn't start Google sign-in. Try again.");
      setBusy(null);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    setError(null);
    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: dest }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) setError(data.error ?? "Could not send the link. Try again.");
      else setSent(true);
    } catch {
      setError("Could not send the link. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="auth-stack">
      <Button variant="primary" onClick={signInWithGoogle} disabled={busy !== null}>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <div className="auth-divider">or use a sign-in link</div>

      {sent ? (
        <p className="auth-note auth-note--ok" role="status">
          If {email} is invited, a sign-in link is on its way. Open it in this browser.
        </p>
      ) : (
        <form className="auth-stack" onSubmit={sendMagicLink}>
          <label className="auth-label" htmlFor="auth-email">School or personal email</label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={busy !== null || !email}>
            {busy === "email" ? "Sending…" : "Email me a link"}
          </Button>
        </form>
      )}

      {error && <p className="auth-note auth-note--error" role="alert">{error}</p>}
    </div>
  );
}
