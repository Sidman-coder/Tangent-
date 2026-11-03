"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import NewPasswordFields, { PasswordInput, newPasswordProblem } from "@/components/auth/PasswordFields";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import CodeInput from "../CodeInput";

const RESEND_SECONDS = 60;
// Per device, and kept by a full sign-out (lib/auth/clear-local.ts).
const METHOD_KEY = "tangent-signin-method";

type Busy = "google" | "email" | "verify" | "password" | "save" | null;
type Method = "password" | "code";
// "signin": the code signs you in. "reset": forgot password, so the code leads
// to "Set a new password".
type Purpose = "signin" | "reset";

function readMethod(): Method {
  try {
    return localStorage.getItem(METHOD_KEY) === "password" ? "password" : "code";
  } catch {
    return "code";
  }
}

function saveMethod(m: Method) {
  try {
    localStorage.setItem(METHOD_KEY, m);
  } catch {
    /* storage blocked */
  }
}

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
  const [noPassword, setNoPassword] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "newPassword">("email");
  const [method, setMethod] = useState<Method>("code");
  const [purpose, setPurpose] = useState<Purpose>("signin");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);
  const tabRefs = useRef<Record<Method, HTMLButtonElement | null>>({ password: null, code: null });
  const dest = safeNext(next);

  useEffect(() => setMethod(readMethod()), []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const clearError = () => {
    setError(null);
    setNoPassword(false);
  };

  const pickMethod = (m: Method, focus = false) => {
    setMethod(m);
    saveMethod(m);
    clearError();
    if (focus) tabRefs.current[m]?.focus();
  };

  // A full navigation so the server renders with the new session cookie.
  const go = (to: string) => window.location.replace(safeNext(to));

  const signInWithGoogle = async () => {
    setBusy("google");
    clearError();
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
    });
    if (error) {
      setError("Couldn't start Google sign-in. Try again.");
      setBusy(null);
    }
  };

  const sendEmail = async (p: Purpose = purpose): Promise<boolean> => {
    setBusy("email");
    clearError();
    try {
      const res = await fetch(p === "reset" ? "/auth/recover" : "/auth/magic-link", {
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

  const startCode = async (p: Purpose) => {
    setPurpose(p);
    if (await sendEmail(p)) {
      setCode("");
      setResent(false);
      setStep("code");
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    await startCode("signin");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy("password");
    clearError();
    try {
      const res = await fetch("/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: dest }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; next?: string; error?: string; noPassword?: boolean; tooMany?: boolean };
      if (data.ok) {
        saveMethod("password");
        go(data.next ?? dest);
        return;
      }
      if (data.next === "/invite-only") {
        go("/invite-only");
        return;
      }
      setError(data.error ?? "Couldn't sign you in. Try again.");
      // No password yet, or too many tries: an email code still works.
      setNoPassword(!!data.noPassword || !!data.tooMany);
      setPassword("");
      setBusy(null);
    } catch {
      setError("Couldn't reach Tangent. Check your connection and try again.");
      setBusy(null);
    }
  };

  const verify = async (token: string) => {
    if (busy) return;
    setBusy("verify");
    clearError();
    try {
      const res = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, next: dest, purpose }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as {
        ok: boolean;
        next?: string;
        error?: string;
        passwordSet?: boolean;
        newAccount?: boolean;
      };
      if (data.ok) {
        // Forgot password, or a brand-new account: offer a password before going in.
        if (purpose === "reset" || (data.newAccount && !data.passwordSet)) {
          setNewPassword("");
          setConfirm("");
          setStep("newPassword");
          setBusy(null);
          return;
        }
        go(data.next ?? dest);
        return;
      }
      if (data.next === "/invite-only") {
        go("/invite-only");
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

  const saveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = newPasswordProblem(newPassword, confirm, email);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy("save");
    clearError();
    try {
      const res = await fetch("/auth/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string; next?: string };
      if (data.ok) {
        saveMethod("password");
        go(dest);
        return;
      }
      if (data.next === "/invite-only") {
        go("/invite-only");
        return;
      }
      setError(data.error ?? "Couldn't save your password. Try again.");
      setBusy(null);
    } catch {
      setError("Couldn't reach Tangent. Check your connection and try again.");
      setBusy(null);
    }
  };

  if (step === "newPassword") {
    const reset = purpose === "reset";
    return (
      <form className="auth-stack" onSubmit={saveNewPassword} noValidate>
        <div role="status">
          <p className="auth-check-title">{reset ? "Set a new password" : "Create a password"}</p>
          <p className="auth-note">
            {reset
              ? "You're signed in. Pick a new password for next time."
              : "Optional. Next time, sign in with your email and this password instead of waiting for a code."}
          </p>
        </div>
        {/* Lets password managers save the pair under the right account. */}
        <input type="email" name="email" autoComplete="email" value={email} readOnly hidden />
        <NewPasswordFields
          idPrefix="auth-pw"
          email={email}
          password={newPassword}
          confirm={confirm}
          onPassword={(v) => {
            setNewPassword(v);
            if (error) clearError();
          }}
          onConfirm={(v) => {
            setConfirm(v);
            if (error) clearError();
          }}
          autoFocus
          label={reset ? "New password" : "Password"}
          inputClassName="auth-input"
          labelClassName="auth-label"
        />
        <Button type="submit" variant="primary" disabled={busy !== null || !newPassword || !confirm}>
          {busy === "save" ? "Saving…" : reset ? "Save and continue" : "Save password"}
        </Button>
        {error && <p className="auth-note auth-note--error" role="alert">{error}</p>}
        <button type="button" className="auth-link auth-link--button" disabled={busy !== null} onClick={() => go(dest)}>
          {reset ? "Not now, keep using email codes" : "Skip, I'll use email codes"}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <div className="auth-stack">
        <div role="status">
          <p className="auth-check-title">Check your email</p>
          <p className="auth-note">
            We sent a 6-digit code to <strong>{email}</strong>. Can&apos;t find it? Check spam, or tap the link in the email.
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
            {busy === "verify" ? (purpose === "reset" ? "Checking…" : "Signing you in…") : purpose === "reset" ? "Continue" : "Sign in"}
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
              setPurpose("signin");
              clearError();
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

  const emailField = (
    <>
      <label className="auth-label" htmlFor="auth-email">School or personal email</label>
      <input
        id="auth-email"
        className="auth-input"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? "auth-email-error" : undefined}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) clearError();
        }}
      />
    </>
  );

  return (
    <div className="auth-stack">
      <Button variant="primary" onClick={signInWithGoogle} disabled={busy !== null}>
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <div className="auth-divider">or sign in with email</div>

      <div
        className="auth-tabs"
        role="tablist"
        aria-label="Sign-in method"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            e.preventDefault();
            pickMethod(method === "password" ? "code" : "password", true);
          }
        }}
      >
        {(["password", "code"] as Method[]).map((m) => (
          <button
            key={m}
            ref={(el) => {
              tabRefs.current[m] = el;
            }}
            type="button"
            role="tab"
            id={`auth-tab-${m}`}
            aria-selected={method === m}
            aria-controls={`auth-panel-${m}`}
            tabIndex={method === m ? 0 : -1}
            className="auth-tab"
            onClick={() => pickMethod(m)}
          >
            {m === "password" ? "Password" : "Email code"}
          </button>
        ))}
      </div>

      {method === "password" ? (
        <form id="auth-panel-password" role="tabpanel" aria-labelledby="auth-tab-password" className="auth-stack" onSubmit={submitPassword}>
          {emailField}
          <PasswordInput
            id="auth-password"
            label="Password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (error) clearError();
            }}
            autoComplete="current-password"
            invalid={!!error}
            inputClassName="auth-input"
            labelClassName="auth-label"
          />
          <Button type="submit" variant="secondary" disabled={busy !== null || !email.trim() || !password}>
            {busy === "password" ? "Signing you in…" : "Sign in"}
          </Button>
          <div className="auth-row">
            <button
              type="button"
              className="auth-link auth-link--button"
              disabled={busy !== null}
              onClick={() => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                  setError("Enter your email above, then tap Forgot password.");
                  return;
                }
                void startCode("reset");
              }}
            >
              {busy === "email" ? "Sending…" : "Forgot password?"}
            </button>
          </div>
        </form>
      ) : (
        <form id="auth-panel-code" role="tabpanel" aria-labelledby="auth-tab-code" className="auth-stack" onSubmit={submitEmail}>
          {emailField}
          <Button type="submit" disabled={busy !== null || !email.trim()}>
            {busy === "email" ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      )}

      {error && (
        <div className="auth-stack">
          <p id="auth-email-error" className="auth-note auth-note--error" role="alert">
            {error}
          </p>
          {noPassword && (
            <button type="button" className="auth-link auth-link--button" onClick={() => pickMethod("code")}>
              Use an email code instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
