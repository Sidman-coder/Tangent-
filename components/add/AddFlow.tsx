"use client";

// Adding anything to Tangent, in one place. Used as the hero on Today and
// inside the ⌘K sheet, so it works the same everywhere:
//
//   1. Type it or say it. The words are routed as you go (lib/ask-route.ts):
//      to the calendar, into a project (new or existing), and - when it's
//      really a question or a long-range goal - to Tangent AI or Tangents.
//   2. Big or vague asks get a few questions first (/api/chat clarify). The
//      student can answer, or skip: it's saved now and the questions wait on
//      Today instead (lib/questions-client.ts), so grilling is never a wall.
//   3. It says where it landed - the day, or the project - with Undo.
//
// Frontend only: it drives the same /api/chat, /api/confirm and
// /api/questions routes the palette, mic and AI page already use.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, ArrowUp, CalendarDays, FolderKanban, Mic, Orbit, MessageSquareText, Square } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { useAppState } from "@/components/AppStateProvider";
import "@/components/console/clarify-card.css";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { routeAsk } from "@/lib/ask-route";
import { putAsk } from "@/lib/ask-handoff";
import { putNewPathTitle } from "@/lib/path-handoff";
import { generateQuestions } from "@/lib/questions-client";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import "./add.css";

type Dest = "calendar" | "project";

type Reply = {
  ok?: boolean;
  error?: string;
  action?: string | null;
  message?: string;
  response?: string;
  actionId?: string;
  taskId?: string;
  taskDate?: string;
  projectId?: string;
  quick?: boolean;
  plan?: { id: string; title: string } | null;
  questions?: ClarifyQuestion[];
  pending?: { id: string; message: string };
  changeSet?: ChangeSet;
  preview?: PreviewPayload;
};

type Phase =
  | { kind: "compose" }
  | { kind: "working"; text: string }
  | { kind: "asking"; text: string; questions: ClarifyQuestion[]; message: string }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload }
  | { kind: "done"; summary: string; actionId: string | null; where: { href: string; label: string } | null }
  | { kind: "error"; message: string };

function clean(text: string | undefined, fallback: string): string {
  const t = (text ?? "").replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  return !t || t.startsWith("{") ? fallback : t;
}

function dayName(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function AddFlow({
  variant = "hero",
  autoFocus = false,
  listenOnOpen = false,
  initialText = "",
  onClose,
  onTextChange,
  defaultDest,
  placeholder,
}: {
  variant?: "hero" | "sheet";
  autoFocus?: boolean;
  /** Start listening as soon as it mounts (the topbar mic). */
  listenOnOpen?: boolean;
  initialText?: string;
  /** The sheet closes itself when a question or goal is handed off. */
  onClose?: () => void;
  /** Lets the sheet show its suggestions only while the box is empty. */
  onTextChange?: (text: string) => void;
  /** Where it goes until the student picks (Projects starts on Project). */
  defaultDest?: Dest;
  placeholder?: string;
}) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [text, setText] = useState(initialText);
  const [phase, setPhase] = useState<Phase>({ kind: "compose" });
  const [destChoice, setDestChoice] = useState<Dest | null>(null);
  const [projectId, setProjectId] = useState<string | "new">("new");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // A phone gets the short prompt, so it fits on one line.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(window.innerWidth < 520), []);
  const doneTimer = useRef<number | null>(null);

  const projects = useMemo(() => (state?.plans ?? []).slice(-6).reverse(), [state?.plans]);
  const route = routeAsk(text);
  // The student's tap wins; otherwise the words decide.
  const dest: Dest = destChoice ?? defaultDest ?? (route === "project" ? "project" : "calendar");
  const handoff = !destChoice && !defaultDest && (route === "question" || route === "goal") ? route : null;

  useEffect(() => {
    if (autoFocus) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [autoFocus]);

  useEffect(() => {
    onTextChange?.(text);
  }, [onTextChange, text]);

  // Grow with what's typed, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Empty: one line, whatever the placeholder would wrap to.
    if (!text) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text, narrow]);

  useEffect(() => () => {
    if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
  }, []);

  const reset = useCallback(() => {
    setText("");
    setDestChoice(null);
    setProjectId("new");
  }, []);

  const finish = useCallback(
    (data: Reply, said: string, deferQuestions: boolean) => {
      const where = data.taskDate
        ? { href: `/calendar?date=${data.taskDate}`, label: `On your calendar · ${dayName(data.taskDate)}` }
        : data.projectId || data.plan?.id
          ? { href: `/projects/${data.projectId ?? data.plan!.id}`, label: data.plan?.title ? `Project · ${data.plan.title}` : "In your project" }
          : null;
      setPhase({ kind: "done", summary: clean(data.message ?? data.response, "Added."), actionId: data.actionId ?? null, where });
      reset();
      void refresh();
      // Skipped questions, or a quick capture: Tangent asks later, on Today.
      if (deferQuestions && data.taskId) void generateQuestions(data.taskId, said, data.quick === true).then(() => refresh());
      if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => setPhase((p) => (p.kind === "done" ? { kind: "compose" } : p)), 9000);
    },
    [refresh, reset]
  );

  const send = useCallback(
    async (said: string, followUp?: { answers: ClarifyAnswer[] | null }) => {
      const words = said.trim();
      if (!words) return;
      setPhase({ kind: "working", text: words });
      const toProject = dest === "project";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: words }],
            mode: "calendar",
            stream: false,
            // A plain to-do is saved instantly; anything bigger is considered for questions.
            capture: !toProject && !followUp,
            clarify: !followUp,
            answers: followUp?.answers ?? undefined,
            ...(toProject ? (projectId === "new" ? { newProject: true } : { projectId }) : {}),
          }),
        });
        const data = (await res.json()) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through. Try again.");
        if (data.action === "clarify" && data.questions?.length) {
          setPhase({ kind: "asking", text: words, questions: data.questions, message: data.message ?? "A few quick questions so this fits you." });
          return;
        }
        if (data.action === "confirm_required" && data.pending) {
          setPhase({ kind: "confirm", id: data.pending.id, message: data.pending.message });
          return;
        }
        if (data.action === "preview" && data.changeSet && data.preview) {
          setPhase({ kind: "preview", changeSet: data.changeSet, preview: data.preview });
          return;
        }
        // Answered questions already sharpened it; otherwise ask later.
        const answered = Boolean(followUp?.answers && followUp.answers.length > 0);
        finish(data, words, !answered);
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      }
    },
    [dest, finish, projectId]
  );

  const submit = useCallback(() => {
    const words = text.trim();
    if (!words) return;
    if (handoff === "question") {
      putAsk("ai", words);
      reset();
      onClose?.();
      router.push("/ai?ask=1");
      return;
    }
    if (handoff === "goal") {
      putNewPathTitle(words);
      reset();
      onClose?.();
      router.push("/tangents?new=1");
      return;
    }
    void send(words);
  }, [handoff, onClose, reset, router, send, text]);

  const resolveConfirm = useCallback(
    async (id: string, confirm: boolean) => {
      setPhase({ kind: "working", text: "" });
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confirm }),
        });
        const data = (await res.json()) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through.");
        if (!confirm) {
          setPhase({ kind: "compose" });
          return;
        }
        finish(data, "", false);
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      }
    },
    [finish]
  );

  // Say it: words fill the box live; stopping sends it straight away.
  const voice = useVoiceCapture({
    live: true,
    onPartial: (t) => setText(t),
    onTranscript: (t) => {
      setText(t);
      if (t.trim()) window.setTimeout(() => void send(t), 0);
    },
    onError: (msg) => setPhase({ kind: "error", message: msg }),
  });
  const listening = voice.status === "recording";
  const transcribing = voice.status === "transcribing";

  const startedListening = useRef(false);
  useEffect(() => {
    if (!listenOnOpen || startedListening.current) return;
    startedListening.current = true;
    void voice.startRecording();
  }, [listenOnOpen, voice]);

  const busy = phase.kind === "working" || transcribing;
  const hint = handoff === "question"
    ? { icon: MessageSquareText, text: "Sounds like a question. Enter asks Tangent AI." }
    : handoff === "goal"
      ? { icon: Orbit, text: "Sounds like a long-range goal. Enter starts a Tangent." }
      : null;

  return (
    <section className={`add-flow is-${variant}${listening ? " is-listening" : ""}`} aria-label="Add to Tangent">
      <div className="add-row">
        <button
          type="button"
          className={`add-mic${listening ? " is-on" : ""}`}
          onClick={() => (listening ? voice.stopRecording() : void voice.startRecording())}
          disabled={busy}
          aria-label={listening ? "Stop and add" : "Say it"}
          title={listening ? "Stop and add" : "Say it"}
        >
          {listening ? <Square size={14} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Mic size={variant === "hero" ? 22 : 18} aria-hidden="true" />}
        </button>
        <textarea
          ref={inputRef}
          className="add-input"
          rows={1}
          value={text}
          disabled={busy}
          placeholder={listening ? "Listening…" : placeholder ?? (narrow ? "Add anything, or ask" : "Add a task, a project, or ask anything")}
          aria-label="What do you want to add?"
          onChange={(e) => {
            setText(e.target.value);
            if (phase.kind === "done" || phase.kind === "error") setPhase({ kind: "compose" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape" && listening) voice.cancelRecording();
          }}
        />
        <button type="button" className="add-send" onClick={submit} disabled={busy || !text.trim()} aria-label="Add">
          {busy ? <span className="add-spinner" aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />}
        </button>
      </div>

      {/* Where it goes. Hidden until there's something to place. */}
      <AnimatePresence initial={false}>
        {text.trim() && phase.kind !== "asking" && (
          <m.div
            key="dest"
            className="add-dest"
            // Opacity only: animating height to "auto" stalled half-open when
            // the tab was in the background, clipping the row.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {hint ? (
              <p className="add-hint">
                <hint.icon size={14} aria-hidden="true" /> {hint.text}
                <button type="button" className="add-hint-alt" onClick={() => setDestChoice("calendar")}>
                  Add it as a task instead
                </button>
              </p>
            ) : (
              <>
                <span className="add-dest-label">Goes to</span>
                <div className="add-seg" role="radiogroup" aria-label="Where it goes">
                  <button type="button" role="radio" aria-checked={dest === "calendar"} className={dest === "calendar" ? "is-on" : ""} onClick={() => setDestChoice("calendar")}>
                    <CalendarDays size={14} aria-hidden="true" /> Calendar
                  </button>
                  <button type="button" role="radio" aria-checked={dest === "project"} className={dest === "project" ? "is-on" : ""} onClick={() => setDestChoice("project")}>
                    <FolderKanban size={14} aria-hidden="true" /> Project
                  </button>
                </div>
                {dest === "project" && (
                  <div className="add-projects" role="radiogroup" aria-label="Which project">
                    <button type="button" role="radio" aria-checked={projectId === "new"} className={projectId === "new" ? "is-on" : ""} onClick={() => setProjectId("new")}>
                      New project
                    </button>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={projectId === p.id}
                        className={projectId === p.id ? "is-on" : ""}
                        onClick={() => setProjectId(p.id)}
                      >
                        <span className="add-project-dot" style={{ background: p.color }} aria-hidden="true" />
                        {p.title}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "working" && phase.text && (
          <m.p key="working" className="add-status" role="status" {...fade}>
            <span className="add-spinner" aria-hidden="true" /> Placing “{phase.text}”…
          </m.p>
        )}
        {phase.kind === "asking" && (
          <m.div key="asking" className="add-asking" {...fade}>
            <p className="add-asking-lead">
              <span>{phase.message}</span>
              <span className="add-asking-said">“{phase.text}”</span>
            </p>
            <ClarifyCard
              questions={phase.questions}
              skipLabel="Skip for now"
              onSubmit={(answers) => void send(phase.text, { answers })}
            />
          </m.div>
        )}
        {phase.kind === "confirm" && (
          <m.div key="confirm" className="add-confirm" role="alertdialog" aria-label="Confirm" {...fade}>
            <p>{phase.message}</p>
            <div>
              <button type="button" className="tg-clarify-btn is-primary" onClick={() => void resolveConfirm(phase.id, true)}>Confirm</button>
              <button type="button" className="tg-clarify-btn" onClick={() => void resolveConfirm(phase.id, false)}>Cancel</button>
            </div>
          </m.div>
        )}
        {phase.kind === "preview" && (
          <m.div key="preview" {...fade}>
            <PreviewCard
              changeSet={phase.changeSet}
              preview={phase.preview}
              onChanged={() => void refresh()}
              onSettled={() => window.setTimeout(() => setPhase({ kind: "compose" }), 2500)}
            />
          </m.div>
        )}
        {phase.kind === "done" && (
          <m.div key="done" className="add-done" role="status" {...fade}>
            {phase.actionId ? (
              <ActionReceipt actionId={phase.actionId} label={phase.summary} onUndone={() => void refresh()} />
            ) : (
              <span>{phase.summary}</span>
            )}
            {phase.where && (
              <Link href={phase.where.href} className="add-where" onClick={onClose}>
                {phase.where.label} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}
          </m.div>
        )}
        {phase.kind === "error" && (
          <m.p key="error" className="add-status is-error" role="alert" {...fade}>
            {phase.message}
          </m.p>
        )}
      </AnimatePresence>
    </section>
  );
}

const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.25, bounce: 0 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
} as const;
