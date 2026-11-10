"use client";

// The post-onboarding chat bubble (Round 4 Phase 6). Tangent asks one deeper
// follow-up at a time, picked from what it knows least well
// (lib/student/follow-ups.ts). The student types or says the answer, with no
// quick replies, and it's saved as a fact they said. At most one a day: it
// shows on Home, stays until it's answered or dismissed, then waits for
// tomorrow. Opens straight away on GET_TO_KNOW_EVENT (after first-run setup
// or from Settings); { mode: "grill" } keeps asking for as long as the
// student wants (Settings › Grill me).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUp, Mic, Square, X } from "lucide-react";
import PenMark from "@/components/console/PenMark";
import { useAppState } from "@/components/AppStateProvider";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { IN_A_ROW, SESSION_BUDGET } from "@/lib/grill-queue";
import {
  closeFollowUp,
  followUpStorageKey,
  followUpToday,
  parseFollowUpState,
  withQuestion,
  type FollowUp,
  type FollowUpState,
} from "@/lib/student/follow-ups";
import "./get-to-know-you.css";

export const GET_TO_KNOW_EVENT = "tangent:get-to-know";
/** Detail for GET_TO_KNOW_EVENT: "grill" keeps asking Tangent's own questions
 *  for as long as the student wants; otherwise it's today's one follow-up. */
export type GetToKnowDetail = { mode?: "setup" | "grill" } | undefined;
/** Fired when the bubble closes, so the feature tour can follow it. */
export const GET_TO_KNOW_DONE_EVENT = "tangent:get-to-know-done";

type Category = "goal" | "commitment" | "work" | "habit" | "preference" | "general";
type GrillStep = { id: string; ask: string; why: string; category: Category };
type Turn = { ask: string; answer: string | null; reply?: string };

/** Today in the student's own time zone, as YYYY-MM-DD. */
function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readState(key: string): FollowUpState {
  try {
    return parseFollowUpState(window.localStorage.getItem(key));
  } catch {
    return parseFollowUpState(null);
  }
}

function writeState(key: string, s: FollowUpState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* blocked storage: it may ask again tomorrow, which is fine */
  }
}

async function fetchFollowUp(asked: string[]): Promise<FollowUp | null | undefined> {
  try {
    const res = await fetch(`/api/follow-up?asked=${encodeURIComponent(asked.join(","))}`);
    const data = (await res.json()) as { ok?: boolean; followUp?: FollowUp | null };
    return data.ok ? (data.followUp ?? null) : undefined;
  } catch {
    return undefined; // offline or signed out: try again another time
  }
}

export default function GetToKnowYou() {
  const { state, refresh } = useAppState();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const storageKey = followUpStorageKey(state?.user.email || "anonymous");
  const onboarded = Boolean(state?.user.onboardedAt);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"followup" | "grill">("followup");
  // Follow-up mode: the one question, then Tangent's short reply.
  const [question, setQuestion] = useState<FollowUp | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  // Grill mode: a thread of Tangent's own questions.
  const [grill, setGrill] = useState<GrillStep | null>(null);
  const [log, setLog] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const checkedToday = useRef<string | null>(null);

  const showQuestion = useCallback((q: FollowUp | null) => {
    setMode("followup");
    setQuestion(q);
    setReply(q ? null : "Nothing to ask right now. Tangent will ask when there's something worth knowing.");
    setAnswered(null);
    setText("");
    setOpen(true);
  }, []);

  // Today's follow-up, on Home only: the open one, or a new one once a day.
  useEffect(() => {
    if (!onboarded || pathname !== "/" || open) return;
    const today = localDay();
    if (checkedToday.current === `${storageKey}:${today}`) return;
    checkedToday.current = `${storageKey}:${today}`;
    const saved = readState(storageKey);
    const decision = followUpToday(saved, today);
    if (decision === "show" && saved.current) {
      showQuestion(saved.current);
      return;
    }
    if (decision !== "fetch") return;
    void fetchFollowUp(saved.asked).then((q) => {
      if (q === undefined) return;
      writeState(storageKey, withQuestion(saved, today, q));
      if (q) showQuestion(q);
    });
  }, [onboarded, pathname, open, storageKey, showQuestion]);

  // One more grill question from Tangent, aimed at what it knows least.
  const askMore = useCallback(async (asked: string[]) => {
    setThinking(true);
    try {
      const res = await fetch("/api/grill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asked }),
      });
      const data = (await res.json()) as { ok?: boolean; question?: { question: string; why: string; category: Category } };
      setGrill(data.ok && data.question ? { id: `ai-${asked.length}`, ask: data.question.question, why: data.question.why, category: data.question.category } : null);
    } catch {
      setGrill(null);
    } finally {
      setThinking(false);
    }
  }, []);

  // Opened on purpose: after first-run setup, or from Settings.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const wanted = (e as CustomEvent<GetToKnowDetail>).detail?.mode;
      setText("");
      setReply(null);
      if (wanted === "grill") {
        setMode("grill");
        setLog([]);
        setGrill(null);
        setOpen(true);
        void askMore([]);
        return;
      }
      const today = localDay();
      checkedToday.current = `${storageKey}:${today}`;
      const saved = readState(storageKey);
      if (saved.current) {
        showQuestion(saved.current);
        return;
      }
      setMode("followup");
      setQuestion(null);
      setThinking(true);
      setOpen(true);
      void fetchFollowUp(saved.asked).then((q) => {
        setThinking(false);
        if (q !== undefined) writeState(storageKey, withQuestion(saved, today, q));
        showQuestion(q ?? null);
      });
    };
    window.addEventListener(GET_TO_KNOW_EVENT, onOpen);
    return () => window.removeEventListener(GET_TO_KNOW_EVENT, onOpen);
  }, [storageKey, askMore, showQuestion]);

  /** Answered or dismissed: it won't come back, and nothing more today. */
  const settle = useCallback(() => {
    const saved = readState(storageKey);
    if (saved.current) writeState(storageKey, closeFollowUp(saved, localDay()));
  }, [storageKey]);

  const close = useCallback(() => {
    // Closing without answering dismisses it; an answer has already settled it.
    if (mode === "followup" && !reply) settle();
    setOpen(false);
    setThinking(false);
    void refresh();
    window.dispatchEvent(new Event(GET_TO_KNOW_DONE_EVENT));
    // First time through: the tour follows, so they see where it all lives.
    let toured = true;
    try {
      toured = window.localStorage.getItem("tangent-tour-done") === "1";
    } catch {}
    if (!toured) window.setTimeout(() => window.dispatchEvent(new Event("tangent:tour")), 400);
  }, [mode, reply, settle, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const answerFollowUp = useCallback(
    async (answer: string) => {
      if (!question || sending) return;
      setSending(true);
      setAnswered(answer);
      let said = "Got it. Tangent will plan with that.";
      try {
        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: question.id, answer }),
        });
        const data = (await res.json()) as { ok?: boolean; saved?: boolean; distress?: string };
        if (data.distress) said = data.distress;
        else if (!data.ok) said = "That didn't save. Tangent will ask again another day.";
        else if (!data.saved) said = "No problem. Tangent will leave that one.";
        // A failed save stays open for another day; anything else is settled.
        if (data.ok) settle();
      } catch {
        said = "That didn't save. Tangent will ask again another day.";
      } finally {
        setSending(false);
      }
      setReply(said);
      setText("");
      void refresh();
    },
    [question, sending, settle, refresh]
  );

  const answerGrill = useCallback(
    (answer: string | null) => {
      if (!grill) return;
      const nextLog = [...log, { ask: grill.ask, answer }];
      setLog(nextLog);
      setGrill(null);
      setText("");
      if (answer) {
        void fetch("/api/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "remember", fact: `${grill.ask.replace(/\?\s*$/, "")}: ${answer}`, category: grill.category }),
        }).catch(() => {});
      }
      // Keeps going until IN_A_ROW asks the student to choose to go on, and SESSION_BUDGET ends it.
      const run = nextLog.length;
      if (run % IN_A_ROW !== 0 && run < SESSION_BUDGET) void askMore(nextLog.map((l) => l.ask));
      window.setTimeout(() => inputRef.current?.focus(), 50);
    },
    [grill, log, askMore]
  );

  const submit = useCallback(
    (raw: string) => {
      const answer = raw.trim();
      if (mode === "grill") answerGrill(answer || null);
      else if (answer) void answerFollowUp(answer);
    },
    [mode, answerGrill, answerFollowUp]
  );

  // Answer out loud: words fill the field as they're spoken, and the answer
  // goes when the student stops.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const voice = useVoiceCapture({ live: true, onPartial: setText, onTranscript: (t) => submitRef.current(t) });

  if (!open || typeof document === "undefined") return null;

  const current: { id: string; ask: string; why: string; placeholder: string } | null =
    mode === "grill"
      ? grill && { id: grill.id, ask: grill.ask, why: grill.why, placeholder: "Type or tap the mic and say it" }
      : !reply && question
        ? { id: question.id, ask: question.ask, why: question.why, placeholder: question.placeholder || "Type your answer" }
        : null;
  const grillDone = mode === "grill" && !grill && !thinking;
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6 };

  return createPortal(
    <div className="gtk-scrim" role="dialog" aria-modal="true" aria-labelledby="gtk-title">
      <m.div
        className="gtk-sheet"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0.01 } : { type: "spring", visualDuration: 0.35, bounce: 0 }}
      >
        <header className="gtk-head">
          <h2 id="gtk-title">{mode === "grill" ? "Grill me" : "One question"}</h2>
          {mode === "grill" && <span className="gtk-progress">{log.length} answered</span>}
          <button type="button" className="gtk-close" onClick={close} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="gtk-thread">
          {mode === "grill" &&
            log.map((l, i) => (
              <div key={i} className="gtk-turn">
                <p className="gtk-ask">{l.ask}</p>
                <p className={`gtk-answer${l.answer ? "" : " is-skipped"}`}>{l.answer ?? "Skipped"}</p>
              </div>
            ))}
          {mode === "followup" && reply && question && answered && (
            <div className="gtk-turn">
              <p className="gtk-ask">{question.ask}</p>
              <p className="gtk-answer">{answered}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {current ? (
              <m.div
                key={current.id}
                className="gtk-turn is-current"
                initial={enter}
                animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0.01 : 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <div>
                    <p className="gtk-ask">{current.ask}</p>
                    <p className="gtk-why">{current.why}</p>
                  </div>
                </div>
              </m.div>
            ) : thinking ? (
              <m.div key="thinking" className="gtk-turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <p className="gtk-why">Thinking of a good question…</p>
                </div>
              </m.div>
            ) : (
              <m.div key="reply" className="gtk-turn" initial={enter} animate={{ opacity: 1, y: 0 }}>
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <p className="gtk-ask" role="status">
                    {mode === "grill"
                      ? "Thanks. That's saved, and you can change any of it in Settings › What Tangent knows."
                      : reply}
                  </p>
                </div>
                {grillDone && log.length < SESSION_BUDGET && (
                  <div className="gtk-chips">
                    <button type="button" className="tg-chip" onClick={() => void askMore(log.map((l) => l.ask))}>
                      Keep going
                    </button>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="gtk-foot">
          {!current ? (
            <button type="button" className="gtk-primary" onClick={close} disabled={thinking}>
              Done
            </button>
          ) : (
            <>
              <form
                className="gtk-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(text);
                }}
              >
                <input
                  name="gtk-answer"
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={voice.status === "recording" ? "Listening…" : current.placeholder}
                  aria-label={current.ask}
                  maxLength={300}
                  disabled={sending}
                  autoFocus
                />
                <button
                  type="button"
                  className={`gtk-mic${voice.status === "recording" ? " is-on" : ""}`}
                  aria-label={voice.status === "recording" ? "Stop and answer" : "Answer out loud"}
                  disabled={voice.status === "transcribing" || sending}
                  onClick={() => (voice.status === "recording" ? voice.stopRecording() : void voice.startRecording())}
                >
                  {voice.status === "recording" ? <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                </button>
                <button type="submit" className="gtk-send" aria-label="Answer" disabled={!text.trim() || sending}>
                  <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </form>
              {mode === "grill" ? (
                <>
                  <button type="button" className="gtk-skip" onClick={() => answerGrill(null)}>
                    Skip
                  </button>
                  <button type="button" className="gtk-skip" onClick={close}>
                    Done
                  </button>
                </>
              ) : (
                <button type="button" className="gtk-skip" onClick={close}>
                  Not now
                </button>
              )}
            </>
          )}
        </footer>
      </m.div>
    </div>,
    document.body
  );
}
