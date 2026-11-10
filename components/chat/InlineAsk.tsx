"use client";

// Round 4 Phase 4: asking about a project or a step, in place. There's no
// side panel and no saved chat: the answer opens under the box, on the page
// you're looking at, and pushes the page down. Ask for more steps and the
// preview shows here too, with Add and Undo. Leaving the page ends the talk.
//
// Same /api/chat as Home's box (home: true), scoped to the project or step,
// so the server answers from what that project already knows
// (lib/pipeline/home-route.ts) and never asks what it can see.

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUp, X } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { useAppState } from "@/components/AppStateProvider";
import { putNewPathTitle } from "@/lib/path-handoff";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import "@/components/console/clarify-card.css";
import "./inline-ask.css";

type Line = { role: "user" | "assistant"; text: string };

type Reply = {
  ok?: boolean;
  error?: string;
  action?: string | null;
  message?: string;
  response?: string;
  actionId?: string;
  pending?: { id: string; message: string };
  changeSet?: ChangeSet;
  preview?: PreviewPayload;
};

type Extra =
  | { kind: "none" }
  | { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "done"; actionId: string; summary: string };

export type InlineAskHandle = {
  /** Scroll to the box and focus it, with optional words already in it. */
  focus: (prefill?: string) => void;
  /** Ask straight away (a question handed over from somewhere else). */
  ask: (text: string) => void;
};

function clean(text: string | undefined, fallback: string): string {
  const t = (text ?? "").replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  return !t || t.startsWith("{") ? fallback : t;
}

const InlineAsk = forwardRef<InlineAskHandle, {
  scope: { projectId?: string; taskId?: string };
  /** For screen readers: "Ask about Instagram Growth to 10K". */
  label: string;
  placeholder?: string;
  className?: string;
}>(function InlineAsk({ scope, label, placeholder = "Ask anything, or ask for more steps…", className }, ref) {
  const router = useRouter();
  const { refresh } = useAppState();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [extra, setExtra] = useState<Extra>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const send = useCallback(
    async (said: string) => {
      const words = said.trim();
      if (!words || busy) return;
      setBusy(true);
      setError(null);
      setExtra({ kind: "none" });
      setText("");
      const earlier = linesRef.current.slice(-12).map((l) => ({ role: l.role, content: l.text }));
      setLines((l) => [...l, { role: "user", text: words }]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...earlier, { role: "user", content: words }],
            mode: "calendar",
            stream: false,
            home: true,
            capture: false,
            clarify: false,
            ...(scope.taskId ? { taskId: scope.taskId } : {}),
            ...(scope.projectId ? { projectId: scope.projectId } : {}),
          }),
        });
        const data = (await res.json()) as Reply;
        if (!res.ok || !data.ok || data.action === "error") throw new Error(data.message || data.error || "That didn't go through. Try again.");
        if (data.action === "preview" && data.changeSet && data.preview) {
          setLines((l) => [...l, { role: "assistant", text: clean(data.changeSet!.summary, "Here's what I'd add. Look it over first.") }]);
          setExtra({ kind: "preview", changeSet: data.changeSet, preview: data.preview });
        } else if (data.action === "confirm_required" && data.pending) {
          setExtra({ kind: "confirm", id: data.pending.id, message: data.pending.message });
        } else if (data.action === "route_tangent") {
          putNewPathTitle(words);
          router.push("/tangents?new=1");
        } else if (data.actionId) {
          setExtra({ kind: "done", actionId: data.actionId, summary: clean(data.message ?? data.response, "Done.") });
          void refresh();
        } else {
          setLines((l) => [...l, { role: "assistant", text: clean(data.message ?? data.response, "I'm not sure. Can you say a bit more?") }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh, router, scope.projectId, scope.taskId]
  );

  const resolveConfirm = useCallback(
    async (id: string, confirm: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confirm }),
        });
        const data = (await res.json()) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through.");
        setExtra(confirm && data.actionId ? { kind: "done", actionId: data.actionId, summary: clean(data.message, "Done.") } : { kind: "none" });
        void refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: (prefill) => {
        if (prefill !== undefined) setText(prefill);
        boxRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
      },
      ask: (asked) => {
        boxRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        void send(asked);
      },
    }),
    [reduce, send]
  );

  const fade = reduce
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0, transition: { type: "spring" as const, visualDuration: 0.25, bounce: 0 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      };

  const clear = () => {
    setLines([]);
    setExtra({ kind: "none" });
    setError(null);
  };

  return (
    <section ref={boxRef} className={`inline-ask${className ? ` ${className}` : ""}`} aria-label={label}>
      <div className="inline-ask-box">
        <textarea
          ref={inputRef}
          className="inline-ask-input"
          rows={1}
          value={text}
          disabled={busy}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
        />
        <button type="button" className="inline-ask-send" onClick={() => void send(text)} disabled={busy || !text.trim()} aria-label="Ask">
          {busy ? <span className="inline-ask-spinner" aria-hidden="true" /> : <ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {(lines.length > 0 || busy || error || extra.kind !== "none") && (
          <m.div key="talk" className="inline-ask-talk" aria-live="polite" {...fade}>
            {lines.length > 0 && (
              <ol className="inline-ask-log">
                {lines.map((l, i) => (
                  <li key={i} className={`inline-ask-line is-${l.role}`}>
                    {l.role === "assistant" ? l.text.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>) : l.text}
                  </li>
                ))}
              </ol>
            )}
            {busy && (
              <p className="inline-ask-status" role="status">
                <span className="inline-ask-spinner" aria-hidden="true" /> Thinking…
              </p>
            )}
            {error && (
              <p className="inline-ask-status is-error" role="alert">
                {error}
              </p>
            )}
            {extra.kind === "preview" && (
              <PreviewCard
                changeSet={extra.changeSet}
                preview={extra.preview}
                onChanged={() => void refresh()}
                onSettled={() => window.setTimeout(() => setExtra({ kind: "none" }), 2500)}
              />
            )}
            {extra.kind === "confirm" && (
              <div className="add-confirm" role="alertdialog" aria-label="Confirm">
                <p>{extra.message}</p>
                <div>
                  <button type="button" className="tg-clarify-btn is-primary" disabled={busy} onClick={() => void resolveConfirm(extra.id, true)}>Confirm</button>
                  <button type="button" className="tg-clarify-btn" disabled={busy} onClick={() => void resolveConfirm(extra.id, false)}>Cancel</button>
                </div>
              </div>
            )}
            {extra.kind === "done" && <ActionReceipt actionId={extra.actionId} label={extra.summary} onUndone={() => void refresh()} />}
            {lines.length > 0 && !busy && (
              <button type="button" className="tg-clarify-quiet inline-ask-clear" onClick={clear}>
                <X size={13} strokeWidth={2} aria-hidden="true" /> Clear
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
});

export default InlineAsk;
