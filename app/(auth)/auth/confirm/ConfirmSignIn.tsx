"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";

const TIMEOUT_MS = 10_000;

type State = { kind: "working" } | { kind: "slow" } | { kind: "failed"; message: string };

export default function ConfirmSignIn({ tokenHash, type, next }: { tokenHash: string; type: string; next: string }) {
  const dest = safeNext(next);
  const [state, setState] = useState<State>(tokenHash ? { kind: "working" } : { kind: "failed", message: "This sign-in link is incomplete." });
  const started = useRef(false);

  const codeHref = `/signin?next=${encodeURIComponent(dest)}`;

  const run = useCallback(async () => {
    setState({ kind: "working" });
    // A retry after a slow first try may find the session already set.
    const { data } = await createClient().auth.getSession();
    if (data.session) {
      window.location.replace(dest);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type, next: dest }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; next?: string; error?: string };
      if (body.ok) {
        window.location.replace(safeNext(body.next ?? dest));
        return;
      }
      setState({ kind: "failed", message: "That sign-in link didn't work or has expired." });
    } catch {
      setState(controller.signal.aborted ? { kind: "slow" } : { kind: "failed", message: "Couldn't reach Tangent. Check your connection." });
    } finally {
      clearTimeout(timer);
    }
  }, [tokenHash, type, dest]);

  useEffect(() => {
    // Once only: the link's token can be used a single time (StrictMode runs effects twice in dev).
    if (started.current || !tokenHash) return;
    started.current = true;
    void run();
  }, [run, tokenHash]);

  if (state.kind === "working") {
    return (
      <>
        <h1>Signing you in…</h1>
        <div className="auth-signing" role="status" aria-live="polite">
          <span className="auth-spinner" aria-hidden="true" />
          This usually takes a second.
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{state.kind === "slow" ? "This is taking longer than usual" : "Couldn't sign you in"}</h1>
      <p className="auth-lede" role="alert">
        {state.kind === "slow"
          ? "Tangent didn't hear back in time. Try again, or sign in with an email code instead."
          : `${state.message} Sign in with an email code instead.`}
      </p>
      <div className="auth-stack">
        {state.kind === "slow" && (
          <Button variant="primary" onClick={() => void run()}>
            Try again
          </Button>
        )}
        <a className="ui-button ui-button--secondary ui-button--md" href={codeHref}>
          Use a code instead
        </a>
      </div>
    </>
  );
}
