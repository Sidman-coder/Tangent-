"use client";

// Settings › Security: set or change the optional password, and sign out of
// every device. Changing needs the current password; setting one for the
// first time (or after forgetting it) needs a fresh 6-digit email code.

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import NewPasswordFields, { PasswordInput, newPasswordProblem } from "@/components/auth/PasswordFields";
import { createClient } from "@/lib/supabase/client";
import { hasPasswordFlag } from "@/lib/auth/password";
import { clearLocalAppData } from "@/lib/auth/clear-local";
import "./security.css";

type Proof = "current" | "code";

export default function SecuritySettings({ email }: { email: string }) {
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<Proof>("current");
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"send" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => setPasswordSet(hasPasswordFlag(data.user?.app_metadata)))
      .catch(() => setPasswordSet(false));
  }, []);

  const reset = () => {
    setCurrent("");
    setCode("");
    setCodeSent(false);
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const start = () => {
    reset();
    setMsg(null);
    setProof(passwordSet ? "current" : "code");
    setOpen(true);
  };

  const sendCode = async () => {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: "/settings#security" }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!data.ok) setError(data.error ?? "Couldn't send the email. Try again.");
      else setCodeSent(true);
    } catch {
      setError("Couldn't send the email. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem =
      (proof === "current" && !current ? "Enter your current password." : null) ??
      (proof === "code" && code.replace(/\D/g, "").length !== 6 ? "Enter the 6-digit code from the email." : null) ??
      newPasswordProblem(password, confirm, email);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/auth/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof === "current" ? { password, currentPassword: current } : { password, code }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Couldn't save your password. Try again.");
        return;
      }
      setMsg(passwordSet ? "Password changed." : "Password set. You can now sign in with it.");
      setPasswordSet(true);
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't reach Tangent. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="security" className="settings-panel">
      <div className="settings-panel-head">
        <div><h2>Security</h2><p>How you sign in. Email codes and Google always work.</p></div>
      </div>
      <div className="settings-option-row">
        <div>
          <strong>Password</strong>
          <span>
            {passwordSet === null
              ? "Checking…"
              : passwordSet
                ? "Set. Sign in with your email and password, or an email code."
                : "Not set. Add one to sign in without waiting for a code."}
          </span>
        </div>
        {!open && (
          <Button variant="secondary" onClick={start} disabled={passwordSet === null || !email}>
            {passwordSet ? "Change password" : "Set a password"}
          </Button>
        )}
      </div>

      {open && (
        <form className="security-form" onSubmit={save} noValidate>
          {/* Lets password managers save the pair under the right account. */}
          <input type="email" name="email" autoComplete="email" value={email} readOnly hidden />
          {proof === "current" ? (
            <>
              <PasswordInput
                id="sec-current"
                label="Current password"
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
                autoFocus
              />
              <button type="button" className="security-link" onClick={() => { setProof("code"); setError(null); }}>
                Forgot it? Use an email code instead
              </button>
            </>
          ) : codeSent ? (
            <div className="pw-field">
              <label className="pw-label" htmlFor="sec-code">6-digit code sent to {email}</label>
              <input
                id="sec-code"
                className="pw-input security-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          ) : (
            <div className="security-send">
              <span>First, confirm it&apos;s you. We&apos;ll email a 6-digit code to {email}.</span>
              <Button type="button" variant="secondary" loading={busy === "send"} loadingLabel="Sending…" onClick={() => void sendCode()}>
                Email me a code
              </Button>
            </div>
          )}

          {(proof === "current" || codeSent) && (
            <NewPasswordFields
              idPrefix="sec-pw"
              email={email}
              password={password}
              confirm={confirm}
              onPassword={setPassword}
              onConfirm={setConfirm}
            />
          )}

          {error && <p className="security-error" role="alert">{error}</p>}
          <div className="settings-panel-actions">
            {(proof === "current" || codeSent) && (
              <Button type="submit" variant="primary" loading={busy === "save"} loadingLabel="Saving…">
                {passwordSet ? "Change password" : "Save password"}
              </Button>
            )}
            <Button type="button" variant="quiet" onClick={() => { setOpen(false); reset(); }} disabled={busy !== null}>Cancel</Button>
          </div>
        </form>
      )}
      {msg && <p className="settings-status" role="status">{msg}</p>}

      <div className="settings-option-row">
        <div><strong>Sign out of all devices</strong><span>Ends every Tangent session for your account, including this one.</span></div>
        <form
          action="/auth/signout"
          method="post"
          onSubmit={(e) => {
            if (!window.confirm("Sign out of Tangent on every device, including this one?")) {
              e.preventDefault();
              return;
            }
            clearLocalAppData();
          }}
        >
          <input type="hidden" name="scope" value="global" />
          <Button type="submit" variant="secondary">Sign out everywhere</Button>
        </form>
      </div>
    </section>
  );
}
