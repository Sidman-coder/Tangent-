"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import CodeInput from "../CodeInput";

const RESEND_SECONDS = 60;

type Busy = "google" | "email" | "verify" | null;

export default function SignInForm({
  next,
  initialError,
  initialEmail = "",
}: {
  next: string;
  initialError: string | null;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);
  const dest = safeNext(next);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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

  const sendEmail = async (): Promise<boolean> => {
    setBusy("email");
    setError(null);
    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: dest }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Couldn't send the email. Try again.");
        return false;
      }
      setResendIn(RESEND_SECONDS);
      return true;
    } catch {
      setError("Couldn't send the email. Check your connection and try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendEmail()) {
      setCode("");
      setResent(false);
      setStep("code");
    }
  };

  const verify = async (token: string) => {
    if (busy) return;
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, next: dest }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; next?: string; error?: string };
      if (data.ok) {
        // A full navigation so the server renders with the new session cookie.
        window.location.replace(safeNext(data.next ?? dest));
        return;
      }
      if (data.next === "/invite-only") {
        window.location.replace("/invite-only");
        return;
      }
      setError(data.error ?? "That code didn't work. Try again.");
      setCode("");
      setBusy(null);
    } catch {
      setError("Couldn't check the code. Check your connection and try again.");
      setBusy(null);
    }
  };

  if (step === "code") {
    return (
      <div className="auth-stack">
        <div role="status">
          <p className="auth-check-title">Check your email</p>
          <p className="auth-note">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below, or tap the link in the same email.
          </p>
        </div>
        <form
          className="auth-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void verify(code);
          }}
        >
          <CodeInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} disabled={busy === "verify"} invalid={!!error} />
          <Button type="submit" variant="primary" disabled={busy !== null || code.length !== 6}>
            {busy === "verify" ? "Signing you in…" : "Sign in"}
          </Button>
        </form>
        {error && <p className="auth-note auth-note--error" role="alert">{error}</p>}
        <div className="auth-row">
          <button
            type="button"
            className="auth-link auth-link--button"
            disabled={resendIn > 0 || busy !== null}
            onClick={async () => {
              if (await sendEmail()) {
                setCode("");
                setResent(true);
              }
            }}
          >
            {busy === "email" ? "Sending…" : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
          <button
            type="button"
            className="auth-link auth-link--button"
            disabled={busy !== null}
            onClick={() => {
              setStep("email");
              setError(null);
              setCode("");
            }}
          >
            Use a different email
          </button>
        </div>
        {resent && !error && <p className="auth-note auth-note--ok" role="status">New code sent. Older codes no longer work.</p>}
      </div>
    );
  }

  return (
    <div className="auth-stack">
      <Button variant="primary" onClick={signInWithGoogle} disabled={busy !== null}>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <div className="auth-divider">or sign in with email</div>

      <form className="auth-stack" onSubmit={submitEmail}>
        <label className="auth-label" htmlFor="auth-email">School or personal email</label>
        <input
          id="auth-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "auth-email-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" disabled={busy !== null || !email.trim()}>
          {busy === "email" ? "Sending…" : "Email me a code"}
        </Button>
      </form>

      {error && (
        <p id="auth-email-error" className="auth-note auth-note--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
