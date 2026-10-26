"use client";

// The first screen: what you still have to do, and a mic. Hold the island and
// say anything; the page floods lavender while you talk, and when you let go
// Tangent sorts it into your calendar or a project (useCapture: save first,
// ask after). Everything else is behind "Open app" (Today, at /today).
// Motion reference: .superpowers/brainstorm/…/capture-home-v3.html.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Check } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { openTask } from "@/components/TaskDetail";
import { OPEN_PALETTE_EVENT, useVoiceCapture } from "@/hooks/useVoiceCapture";
import { useQuestionSets } from "@/hooks/useQuestionSets";
import { buildCaptureList } from "@/lib/capture-list";
import { holdReducer, initialHold, listeningWithoutPress, type Hold, type HoldEvent } from "@/lib/hold-gesture";
import { heardSomethingToAdd } from "@/lib/voice-intent";
import { putAsk } from "@/lib/ask-handoff";
import { taskColor } from "@/lib/task-colors";
import { toYMD } from "@/lib/dates";
import { wallClockNow } from "@/lib/time";
import { outcomeFromError, type CaptureOutcome } from "@/lib/capture-outcome";
import type { Task } from "@/lib/types";
import { FOCUS_KEY, parseFocus, startFocus, type FocusSession } from "@/lib/focus-timer";
import CaptureIsland from "./CaptureIsland";
import FocusView, { saveFocus } from "./FocusView";
import SortedCard from "./SortedCard";
import { useCapture } from "./useCapture";
import "./capture.css";

const TICK_MS = 50;
/** If a send never produces a transcript (silence), stop waiting after this. */
const SEND_TIMEOUT_MS = 9000;

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN: [number, number, number, number] = [0.5, 0, 0.75, 0];

function isFormField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export default function CaptureHome() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { state, refresh } = useAppState();
  const tz = useUserTimezone();
  const today = toYMD(wallClockNow(tz));
  const { capture, confirm, freshSet, questionsPending, clearFreshSet } = useCapture();
  const { sets } = useQuestionSets();

  const [hold, setHold] = useState<Hold>(initialHold);
  const holdRef = useRef<Hold>(initialHold);
  const [tapToStop, setTapToStop] = useState(false);
  const [words, setWords] = useState("");
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const islandRef = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState({ x: "50%", y: "92%" });
  const sendTimer = useRef<number | null>(null);
  const [focus, setFocus] = useState<{ session: FocusSession; origin: { x: string; y: string } } | null>(null);

  const listening = hold.state === "listening";

  const finishSort = useCallback(() => {
    if (sendTimer.current !== null) window.clearTimeout(sendTimer.current);
    sendTimer.current = null;
    dispatchRef.current({ type: "sorted" });
  }, []);

  const runCapture = useCallback(
    async (said: string) => {
      setOutcome(null);
      clearFreshSet();
      const result = await capture(said);
      setOutcome(result);
      finishSort();
    },
    [capture, clearFreshSet, finishSort]
  );

  const voice = useVoiceCapture({
    live: true,
    onPartial: (t) => setWords(t),
    onTranscript: (t) => {
      setWords(t);
      // A stray sound ("um") becomes nothing, not a task.
      if (!t.trim() || !heardSomethingToAdd(t)) {
        finishSort();
        return;
      }
      void runCapture(t);
    },
    onError: () => {
      dispatchRef.current({ type: "cancel" });
      setOutcome(outcomeFromError(""));
      finishSort();
    },
  });

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const dispatch = useCallback((e: HoldEvent) => {
    const { next, effect } = holdReducer(holdRef.current, e);
    holdRef.current = next;
    setHold(next);
    const v = voiceRef.current;
    switch (effect) {
      case "start-listening": {
        const r = islandRef.current?.getBoundingClientRect();
        if (r) setOrigin({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` });
        setWords("");
        setOutcome(null);
        navigator.vibrate?.(8);
        void v.startRecording();
        break;
      }
      case "send":
        setTapToStop(false);
        v.stopRecording();
        sendTimer.current = window.setTimeout(() => dispatchRef.current({ type: "sorted" }), SEND_TIMEOUT_MS);
        break;
      case "abort":
        setTapToStop(false);
        setWords("");
        v.cancelRecording();
        break;
      case "open-typing":
        window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
        break;
    }
  }, []);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // While pressed, time decides tap vs hold.
  useEffect(() => {
    if (hold.state !== "pressed") return;
    const id = window.setInterval(() => dispatch({ type: "tick", t: performance.now() }), TICK_MS);
    return () => window.clearInterval(id);
  }, [hold.state, dispatch]);

  // Space works like the island on a keyboard; losing the window cancels.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isFormField(e.target) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      dispatch({ type: "down", t: performance.now(), y: 0 });
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isFormField(e.target)) return;
      if (holdRef.current.state === "idle" || holdRef.current.state === "sorting") return;
      e.preventDefault();
      dispatch({ type: "up", t: performance.now(), y: 0 });
    };
    const blur = () => dispatch({ type: "cancel" });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [dispatch]);

  // The home-screen shortcut (/?capture=1, app/manifest.ts) opens listening.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture") !== "1") return;
    window.history.replaceState(null, "", "/");
    holdRef.current = listeningWithoutPress;
    setHold(listeningWithoutPress);
    setTapToStop(true);
    void voiceRef.current.startRecording();
  }, []);

  useEffect(() => () => {
    if (sendTimer.current !== null) window.clearTimeout(sendTimer.current);
  }, []);

  const tasks = useMemo(
    () => (state?.tasks ?? []).map((t) => (t.id in done ? { ...t, completed: done[t.id] } : t)),
    [state?.tasks, done]
  );
  const rows = useMemo(() => buildCaptureList(tasks, state?.plans ?? [], today), [tasks, state?.plans, today]);

  const complete = useCallback(
    async (task: Task) => {
      setDone((d) => ({ ...d, [task.id]: true }));
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_task", id: task.id, completed: true }),
        });
        if (!res.ok) throw new Error();
        await refresh();
      } catch {
        // Put it back if the save didn't stick.
        setDone((d) => {
          const next = { ...d };
          delete next[task.id];
          return next;
        });
      }
    },
    [refresh]
  );

  // A focus session from before a reload picks back up, if its task is still open.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !state) return;
    resumed.current = true;
    let saved: FocusSession | null = null;
    try {
      saved = parseFocus(localStorage.getItem(FOCUS_KEY));
    } catch {
      saved = null;
    }
    const task = saved && state.tasks.find((t) => t.id === saved!.taskId && !t.completed);
    if (saved && task) setFocus({ session: saved, origin: { x: "50%", y: "50%" } });
    else if (saved) saveFocus(null);
  }, [state]);

  const startFocusOn = useCallback((task: Task, from: HTMLElement) => {
    const r = from.getBoundingClientRect();
    const session = startFocus(task.id, Date.now());
    saveFocus(session);
    setFocus({ session, origin: { x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` } });
  }, []);
  const endFocus = useCallback(() => {
    saveFocus(null);
    setFocus(null);
  }, []);
  const focusTask = focus ? state?.tasks.find((t) => t.id === focus.session.taskId) ?? null : null;

  const savedLine = useMemo(() => {
    if (outcome?.kind !== "saved") return null;
    const task = outcome.taskId ? state?.tasks.find((t) => t.id === outcome.taskId) : undefined;
    const plan = outcome.planId ? state?.plans.find((p) => p.id === outcome.planId) : undefined;
    if (task) return { title: task.title, color: taskColor(task) };
    if (plan) return { title: plan.title, color: "var(--cat-ec)" };
    return { title: words || outcome.summary, color: "var(--cat-other)" };
  }, [outcome, state?.tasks, state?.plans, words]);

  const parkedSet = useMemo(() => {
    const waiting = sets.filter((s) => s.id !== freshSet?.id && s.questions.length > 0);
    return waiting.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
  }, [sets, freshSet?.id]);

  const dismiss = useCallback(() => {
    setOutcome(null);
    clearFreshSet();
  }, [clearFreshSet]);

  const washOn = listening;
  const count = rows.length;

  return (
    <div className="capture-home">
      <m.div
        className="capture-page"
        animate={washOn && !reduced ? { scale: 0.93, y: -8, filter: "blur(7px) saturate(0.7)", opacity: 0.55 } : { scale: 1, y: 0, filter: "blur(0px) saturate(1)", opacity: 1 }}
        transition={{ duration: washOn ? 0.7 : 0.5, ease: EASE_OUT }}
        aria-hidden={washOn}
      >
        <header className="capture-top">
          <span className="capture-wordmark">tangent</span>
          <Link href="/today" className="capture-open-app">Open app →</Link>
        </header>

        <h1 className="capture-title">To do</h1>
        <p className="capture-count">{count === 1 ? "1 thing" : `${count} things`}</p>

        {state && count === 0 ? (
          <p className="capture-empty">Nothing to do. Hold to add something.</p>
        ) : (
          <ul className="capture-list">
            <AnimatePresence initial={false}>
              {rows.map(({ task, sub, overdue }, i) => (
                <m.li
                  key={task.id}
                  layout={!reduced}
                  className={`capture-row${overdue ? " is-overdue" : ""}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.9, boxShadow: "0 0 0 6px rgb(91 75 196 / 0.22)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, boxShadow: "0 0 0 0px rgb(91 75 196 / 0)" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.22 } }}
                  transition={{ type: "spring", visualDuration: 0.55, bounce: 0.35, boxShadow: { duration: 0.9 } }}
                >
                  <button type="button" className="capture-check" aria-label={`Complete ${task.title}`} onClick={() => void complete(task)}>
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </button>
                  <button type="button" className="capture-row-body" onClick={() => openTask(task.id)}>
                    <span className="capture-row-title">{task.title}</span>
                    {sub && <span className="capture-row-sub">{sub}</span>}
                  </button>
                  {i === 0 && (
                    <button type="button" className="capture-start" onClick={(e) => startFocusOn(task, e.currentTarget)}>
                      Start
                    </button>
                  )}
                  <i className="capture-dot" style={{ background: taskColor(task) }} aria-hidden="true" />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </m.div>

      {/* The lavender takeover, grown from the island's centre. */}
      <AnimatePresence>
        {washOn && (
          <m.div
            key="wash"
            className="capture-wash"
            style={{ ["--wx" as string]: origin.x, ["--wy" as string]: origin.y }}
            initial={reduced ? { opacity: 0 } : { clipPath: `circle(0px at ${origin.x} ${origin.y})` }}
            animate={reduced ? { opacity: 1 } : { clipPath: `circle(150vmax at ${origin.x} ${origin.y})`, transition: { duration: 0.75, ease: EASE_OUT } }}
            exit={reduced ? { opacity: 0 } : { clipPath: `circle(0px at ${origin.x} ${origin.y})`, transition: { duration: 0.55, ease: EASE_IN } }}
            aria-hidden="true"
          >
            {!reduced && (
              <>
                <span className="capture-blob is-one" />
                <span className="capture-blob is-two" />
              </>
            )}
            <div className="capture-live">
              <m.p className="capture-listening" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }}>
                Listening…
              </m.p>
              <p className="capture-words">
                {words.split(/\s+/).filter(Boolean).map((w, i) => (
                  <m.span
                    key={i}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(8px)", y: 10 }}
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                  >
                    {w}
                  </m.span>
                ))}
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outcome && (
          <SortedCard
            key="sorted"
            outcome={outcome}
            freshSet={freshSet}
            questionsPending={questionsPending}
            parkedSet={parkedSet}
            line={savedLine}
            onDismiss={dismiss}
            onRetry={(said) => {
              setOutcome(null);
              holdRef.current = { ...initialHold, state: "sorting" };
              setHold(holdRef.current);
              setWords(said);
              void runCapture(said);
            }}
            onConfirm={(id, yes) => {
              setOutcome(null);
              void confirm(id, yes).then((o) => o && setOutcome(o));
            }}
            onAsk={(said) => {
              putAsk("ai", said);
              router.push("/ai?ask=1");
            }}
            onChanged={() => void refresh()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {focus && focusTask && (
          <FocusView
            key="focus"
            task={focusTask}
            session={focus.session}
            origin={focus.origin}
            onSession={(session) => {
              saveFocus(session);
              setFocus((f) => (f ? { ...f, session } : f));
            }}
            onDone={() => {
              void complete(focusTask);
              endFocus();
            }}
            onStop={endFocus}
          />
        )}
      </AnimatePresence>

      <CaptureIsland
        ref={islandRef}
        state={hold.state}
        level={voice.getLevel}
        transcriptTail={words}
        tapToStop={tapToStop}
        onEvent={dispatch}
      />
    </div>
  );
}
