"use client";

// Settings › Security: set or change the optional password, and sign out of
// every device. Changing needs the current password; setting one for the
// first time (or after forgetting it) needs a fresh email code. The
// link in that email lands back here with ?reset=1, and counts as the proof.

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { CODE_INCOMPLETE, CODE_MAX_LENGTH, codeDigits, isCodeLength } from "@/lib/auth/messages";
import NewPasswordFields, { PasswordInput, newPasswordProblem } from "@/components/auth/PasswordFields";
import { createClient } from "@/lib/supabase/client";
import { amrFromAccessToken, hasPasswordFlag, signedInByEmailCodeRecently } from "@/lib/auth/password";
import { clearLocalAppData } from "@/lib/auth/clear-local";
import "./security.css";

const RESEND_SECONDS = 60;

type Proof = "current" | "code" | "link";

export default function SecuritySettings({ email }: { email: string }) {
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<Proof>("current");
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"send" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOutForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth
      .getUser()
      .then(({ data }) => setPasswordSet(hasPasswordFlag(data.user?.app_metadata)))
      .catch(() => setPasswordSet(false));
    if (new URLSearchParams(window.location.search).get("reset") !== "1") return;
    void supabase.auth.getSession().then(({ data }) => {
      if (!signedInByEmailCodeRecently(amrFromAccessToken(data.session?.access_token))) return;
      setProof("link");
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
      const res = await fetch("/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: "/settings/security?reset=1" }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!data.ok) setError(data.error ?? "Couldn't send the email. Try again.");
      else {
        setCode("");
        setCodeSent(true);
        setResendIn(RESEND_SECONDS);
      }
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
      (proof === "code" && !isCodeLength(code) ? CODE_INCOMPLETE : null) ??
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
        body: JSON.stringify(
          proof === "current" ? { password, currentPassword: current } : proof === "code" ? { password, code } : { password }
        ),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string; flagSaved?: boolean };
      if (!data.ok) {
        setError(data.error ?? "Couldn't save your password. Try again.");
        return;
      }
      if (data.flagSaved === false) setMsg("Password saved. This page may still say it isn't set, but it works for signing in.");
      else setMsg(passwordSet ? "Password changed." : "Password set. You can now sign in with it.");
      setPasswordSet(data.flagSaved !== false);
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't reach Tangent. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const canSave = proof !== "code" || codeSent;

  return (
    <section id="security" className="settings-group" aria-labelledby="security-title">
      <h2 id="security-title" className="settings-group-title">Password</h2>
      <p className="settings-group-note">How you sign in. Email codes and Google always work.</p>
      <div className="settings-card">
        <div className={`settings-row${open ? " is-stacked" : ""}`}>
          <div className="settings-row-copy">
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
            <Button size="sm" onClick={start} disabled={passwordSet === null || !email}>
              {passwordSet ? "Change password" : "Set a password"}
            </Button>
          )}

          {open && (
            <form className="security-form" onSubmit={save} noValidate>
              {/* Lets password managers save the pair under the right account. */}
              <input type="email" name="email" autoComplete="email" value={email} readOnly hidden />
              {proof === "link" ? (
                <p className="security-note">You&apos;re confirmed by the email link. Pick a new password.</p>
              ) : proof === "current" ? (
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
                  <label className="pw-label" htmlFor="sec-code">Code from the email</label>
                  <p className="security-note">
                    We sent a sign-in code to {email}. Can&apos;t find it? Check spam, or tap the link in the email.
                  </p>
                  <input
                    id="sec-code"
                    className="pw-input security-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_MAX_LENGTH}
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(codeDigits(e.target.value))}
                  />
                  <button type="button" className="security-link" disabled={resendIn > 0 || busy !== null} onClick={() => void sendCode()}>
                    {busy === "send" ? "Sending…" : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              ) : (
                <div className="security-send">
                  <span>First, confirm it&apos;s you. We&apos;ll email a code to {email}.</span>
                  <Button type="button" size="sm" loading={busy === "send"} loadingLabel="Sending…" onClick={() => void sendCode()}>
                    Email me a code
                  </Button>
                </div>
              )}

              {canSave && (
                <NewPasswordFields
                  idPrefix="sec-pw"
                  email={email}
                  password={password}
                  confirm={confirm}
                  onPassword={setPassword}
                  onConfirm={setConfirm}
                  submitted={!!error}
                />
              )}

              {error && <p className="security-error" role="alert">{error}</p>}
              <div className="security-actions">
                {canSave && (
                  <Button type="submit" size="sm" variant="primary" loading={busy === "save"} loadingLabel="Saving…">
                    {passwordSet ? "Change password" : "Save password"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="quiet" onClick={() => { setOpen(false); reset(); }} disabled={busy !== null}>Cancel</Button>
              </div>
            </form>
          )}
        </div>

        <div className={`settings-row${confirmingSignOut ? " is-stacked" : ""}`}>
          <div className="settings-row-copy">
            <strong>Sign out of all devices</strong>
            <span>Ends every Tangent session for your account, including this one.</span>
          </div>
          <form ref={signOutForm} action="/auth/signout" method="post" hidden>
            <input type="hidden" name="scope" value="global" />
          </form>
          {confirmingSignOut ? (
            <ConfirmPanel
              title="Sign out everywhere?"
              actionLabel="Sign out everywhere"
              busyLabel="Signing out…"
              busy={signingOut}
              onCancel={() => setConfirmingSignOut(false)}
              onConfirm={() => {
                setSigningOut(true);
                clearLocalAppData();
                signOutForm.current?.submit();
              }}
            >
              <p>Every phone, laptop and pen signed in to Tangent will need to sign in again, including this one. Nothing is deleted.</p>
            </ConfirmPanel>
          ) : (
            <Button size="sm" onClick={() => setConfirmingSignOut(true)}>Sign out everywhere</Button>
          )}
        </div>
      </div>
      {msg && <p className="settings-status" role="status">{msg}</p>}
    </section>
  );
}
