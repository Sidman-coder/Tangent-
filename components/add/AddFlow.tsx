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

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, ArrowUp, AudioLines, Mic, Orbit, MessageSquareText } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { planSeriesColor } from "@/lib/task-colors";
import "@/components/console/clarify-card.css";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import SlotQuestionCard from "@/components/grill/SlotQuestionCard";

/** "Grill until enough" so far, sent back each turn (lib/context/grill.ts). */
type SlotTurn = { answers: { slot: string; answer: string }[]; skipped: string[]; inARow: number; stopped: boolean };
const NO_TURN: SlotTurn = { answers: [], skipped: [], inARow: 0, stopped: false };
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { routeAsk } from "@/lib/ask-route";
import { heardSomethingToAdd } from "@/lib/voice-intent";
import { askOnHome } from "@/lib/ask-handoff";
import { putNewPathTitle } from "@/lib/path-handoff";
import { HOME_INTENT_EVENT, planRequestFor, takeHomeIntent, takeHomePlan, type HomeIntent } from "@/lib/home-intent";
import { generateQuestions } from "@/lib/questions-client";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import HelpPlanBetter from "@/components/grill/HelpPlanBetter";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import { seedProjectThread, type ThreadLine } from "@/lib/chat/seed-thread";
import { getUserToday } from "@/lib/time";
import DestPill, { type DestChoice } from "./DestPill";
import PlanWorkspace, { CalendarPlaceholder, HowThisPlanWorks, ModeToggle, type Pane, type TalkMode } from "./PlanWorkspace";
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
  slotFlow?: { slots: string[]; progress: number };
  grillNote?: string;
  /** A kind reply to real distress (lib/student/sensitive.ts): never a task. */
  care?: boolean;
};

type Phase =
  | { kind: "compose" }
  | { kind: "working"; text: string }
  | { kind: "asking"; text: string; questions: ClarifyQuestion[]; message: string; slot?: { slots: string[]; progress: number; at: number; turn: SlotTurn } }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload; said: string; asked: number; note?: string }
  | { kind: "done"; summary: string; actionId: string | null; where: { href: string; label: string } | null }
  | { kind: "error"; message: string }
  | { kind: "heard"; text: string };

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
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // With Pipeline V2 off there's no preview card to carry these.
  const [help, setHelp] = useState<{ planId: string; said: string; asked: number } | null>(null);
  // The pill's choice, for the next send only. Projects starts on New project.
  const startChoice: DestChoice | null = defaultDest === "project" ? { dest: "project", projectId: "new" } : defaultDest === "calendar" ? { dest: "calendar" } : null;
  const [choice, setChoice] = useState<DestChoice | null>(startChoice);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = `add-input${useId().replace(/:/g, "")}`;
  // A phone gets the short prompt, so it fits on one line.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow(window.innerWidth < 520), []);
  const doneTimer = useRef<number | null>(null);
  const timezone = useUserTimezone();
  const reduce = useReducedMotion();

  // Round 4 §3.3: planning opens the workspace in place. The talk so far (for
  // the left pane, and the project's thread once confirmed), what the student
  // told it in "Tell me anything", and Plan it / Just talk.
  const [planning, setPlanning] = useState(false);
  const [log, setLog] = useState<ThreadLine[]>([]);
  const [brief, setBrief] = useState("");
  const [talkMode, setTalkMode] = useState<TalkMode>("plan");
  const [pane, setPane] = useState<Pane>("chat");
  const [draftOps, setDraftOps] = useState<ChangeSet["ops"] | null>(null);
  const logRef = useRef(log);
  logRef.current = log;
  const briefRef = useRef(brief);
  briefRef.current = brief;
  const planningRef = useRef(planning);
  planningRef.current = planning;
  const talkModeRef = useRef(talkMode);
  talkModeRef.current = talkMode;
  const say = useCallback((line: ThreadLine) => setLog((l) => [...l, line]), []);
  const endPlanning = useCallback(() => {
    setPlanning(false);
    setLog([]);
    setBrief("");
    setTalkMode("plan");
    setPane("chat");
    setDraftOps(null);
  }, []);

  const projects = useMemo(
    () => (state?.plans ?? []).slice(-6).reverse().map((p) => ({ id: p.id, title: p.title, color: planSeriesColor(p) })),
    [state?.plans]
  );
  const route = routeAsk(text);
  // The student's pick wins; on Auto the words decide.
  const dest: Dest = choice?.dest ?? (route === "project" ? "project" : "calendar");
  const handoff = !choice && (route === "question" || route === "goal") ? route : null;
  const targetProject = choice?.dest === "project" ? choice.projectId : "new";

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
    setChoice(startChoice);
    // startChoice only depends on defaultDest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDest]);

  const finish = useCallback(
    (data: Reply, said: string, deferQuestions: boolean, asked = 0) => {
      const where = data.taskDate
        ? { href: `/calendar?date=${data.taskDate}`, label: `On your calendar · ${dayName(data.taskDate)}` }
        : data.projectId || data.plan?.id
          ? { href: `/projects/${data.projectId ?? data.plan!.id}`, label: data.plan?.title ? `Project · ${data.plan.title}` : "In your project" }
          : null;
      setPhase({ kind: "done", summary: clean(data.message ?? data.response, "Added."), actionId: data.actionId ?? null, where });
      const planId = data.projectId ?? data.plan?.id;
      if (planId) setHelp({ planId, said, asked });
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
    async (said: string, followUp?: { answers?: ClarifyAnswer[] | null; slotTurn?: SlotTurn }, source: "voice" | "typed" = "typed") => {
      const words = said.trim();
      if (!words) return;
      // A draft or a question on screen stays there through a "Just talk" reply.
      const before = phaseRef.current;
      setPhase({ kind: "working", text: words });
      setHelp(null);
      const toProject = dest === "project";
      // In the workspace: the talk so far rides along as context, and what the
      // student wrote in "Tell me anything" joins this request.
      const inWorkspace = planningRef.current;
      if (!followUp && !inWorkspace) setLog([{ role: "user", text: words }]);
      else if (!followUp) say({ role: "user", text: words });
      const told = briefRef.current.trim();
      const content = told ? `${words}\n\nMore about this: ${told}` : words;
      const earlier = inWorkspace ? logRef.current.filter((l) => l.text !== words).map((l) => ({ role: l.role, content: l.text })).slice(-12) : [];
      // "Just talk": a reply only. Nothing is added without the student asking.
      const talk = inWorkspace && !followUp && talkModeRef.current === "talk";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...earlier, { role: "user", content }],
            mode: "calendar",
            stream: false,
            source,
            ...(talk ? { talk: true } : {}),
            // A plain to-do is saved instantly; anything bigger is considered for questions.
            capture: !talk && !toProject && !followUp,
            clarify: !talk && (!followUp || !!followUp.slotTurn),
            answers: followUp?.answers ?? undefined,
            // A few questions until Tangent knows enough (lib/context/goal-slots.ts).
            slotFlow: true,
            slotTurn: followUp?.slotTurn,
            ...(toProject ? (targetProject === "new" ? { newProject: true } : { projectId: targetProject }) : {}),
          }),
        });
        const data = (await res.json()) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through. Try again.");
        if (data.action === "plan_reply" || (inWorkspace && data.care)) {
          say({ role: "assistant", text: clean(data.message, "I'm here. Tell me more.") });
          setPhase(before.kind === "preview" || before.kind === "asking" ? before : { kind: "compose" });
          reset();
          return;
        }
        if (data.action === "clarify" && data.questions?.length) {
          const slot = data.slotFlow ? { slots: data.slotFlow.slots, progress: data.slotFlow.progress, at: 0, turn: followUp?.slotTurn ?? NO_TURN } : undefined;
          setPhase({ kind: "asking", text: words, questions: data.questions, message: data.message ?? "A few quick questions so this fits you.", slot });
          // Questions mean planning: open the workspace (Home's composer only).
          if (variant === "hero") {
            setPlanning(true);
            setText("");
          }
          return;
        }
        if (data.action === "confirm_required" && data.pending) {
          setPhase({ kind: "confirm", id: data.pending.id, message: data.pending.message });
          return;
        }
        if (data.action === "preview" && data.changeSet && data.preview) {
          setPhase({ kind: "preview", changeSet: data.changeSet, preview: data.preview, said: words, asked: followUp?.answers?.length ?? followUp?.slotTurn?.answers.length ?? 0, note: data.grillNote });
          // A plan (a new project, or several steps) is planning too.
          const steps = data.changeSet.ops.filter((op) => op.op === "add_task").length;
          const isPlan = data.changeSet.ops.some((op) => op.op === "create_plan") || steps > 1;
          if (variant === "hero" && (inWorkspace || isPlan)) {
            setPlanning(true);
            setText("");
            setDraftOps(data.changeSet.ops);
            say({ role: "assistant", text: clean(data.changeSet.summary, "Here's a plan to look over.") });
          }
          return;
        }
        // Pipeline V2's intent router can decide mid-flight that this is
        // really a long-range goal; hand it to Tangents the same way a typed
        // goal does.
        if (data.action === "route_tangent") {
          putNewPathTitle(words);
          reset();
          onClose?.();
          router.push("/tangents?new=1");
          return;
        }
        // Answered questions already sharpened it; otherwise ask later.
        const asked = followUp?.answers?.length ?? followUp?.slotTurn?.answers.length ?? 0;
        finish(data, words, asked === 0, asked);
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      }
    },
    [dest, finish, onClose, reset, router, say, targetProject, variant]
  );

  const submit = useCallback(() => {
    const words = text.trim();
    if (!words) return;
    if (handoff === "question") {
      reset();
      onClose?.();
      askOnHome(words, router.push);
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
      if (!t.trim()) return;
      // A stray sound ("wow", "um") waits in the box instead of becoming a task.
      if (!heardSomethingToAdd(t)) {
        setPhase({ kind: "heard", text: t.trim() });
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      window.setTimeout(() => void send(t, undefined, "voice"), 0);
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

  // The shell's "New" button and phone mic land here: focus the box or start listening.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    // Only Home's box answers; Projects has a hero box of its own.
    if (variant !== "hero") return;
    const act = () => {
      if (window.location.pathname !== "/") return;
      // A goal handed over (onboarding, the starting-point card): plan it
      // here, in this composer, with questions that can be skipped or stopped.
      const plan = takeHomePlan();
      if (plan) {
        void sendRef.current(planRequestFor(plan.goal));
        if (plan.fromOnboarding) {
          void fetch("/api/onboarding", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startingIntent: null }),
          }).catch(() => null);
        }
        return;
      }
      const intent: HomeIntent | null = takeHomeIntent();
      if (intent === "listen") void voiceRef.current.startRecording();
      else if (intent === "focus") {
        const el = inputRef.current;
        el?.scrollIntoView({ block: "center" });
        el?.focus({ preventScroll: true });
      }
    };
    act();
    window.addEventListener(HOME_INTENT_EVENT, act);
    return () => window.removeEventListener(HOME_INTENT_EVENT, act);
  }, [variant]);

  const busy = phase.kind === "working" || transcribing;
  const hint = handoff === "question"
    ? { icon: MessageSquareText, text: "Sounds like a question. Enter asks Tangent." }
    : handoff === "goal"
      ? { icon: Orbit, text: "Sounds like a long-range goal. Enter starts a Tangent." }
      : null;

  const workspace = planning && variant === "hero";
  const composer = (
    <>
      <label className="sr-only" htmlFor={inputId}>
        What do you want to add?
      </label>
      <textarea
        id={inputId}
        name="capture"
        ref={inputRef}
        className={`add-input${listening ? " is-live" : ""}`}
        rows={1}
        value={text}
        disabled={busy}
        placeholder={listening ? "Listening…" : workspace ? (talkMode === "talk" ? "Say anything about it…" : "Reply, or ask for a change…") : placeholder ?? (narrow ? "Type or say anything…" : "Type or say anything: a task, a project, a question")}
        onChange={(e) => {
          setText(e.target.value);
          if (phase.kind === "done" || phase.kind === "error" || phase.kind === "heard") setPhase({ kind: "compose" });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape" && listening) voice.cancelRecording();
        }}
      />
      <div className="add-row">
        <DestPill choice={choice} projects={projects} onChange={setChoice} disabled={busy} />
        <button
          type="button"
          className={`add-mic${listening ? " is-on" : ""}`}
          onClick={() => (listening ? voice.stopRecording() : void voice.startRecording())}
          disabled={busy}
          aria-label={listening ? "Stop and add" : "Say it"}
          title={listening ? "Stop and add" : "Say it"}
        >
          {listening ? <AudioLines size={20} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" className="add-send" onClick={submit} disabled={busy || !text.trim()} aria-label="Add">
          {busy ? <span className="add-spinner" aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={2.25} aria-hidden="true" />}
        </button>
      </div>

      {/* A question or a long-range goal goes somewhere else; say so first. */}
      <AnimatePresence initial={false}>
        {text.trim() && phase.kind !== "asking" && hint && (
          <m.p
            key="hint"
            className="add-hint"
            // Opacity only: animating height to "auto" stalled half-open when
            // the tab was in the background, clipping the row.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <hint.icon size={14} strokeWidth={1.75} aria-hidden="true" /> {hint.text}
            <button type="button" className="add-hint-alt" onClick={() => setChoice({ dest: "calendar" })}>
              Add it as a task instead
            </button>
          </m.p>
        )}
      </AnimatePresence>
    </>
  );

  const steps = phase.kind === "preview" ? (draftOps ?? phase.changeSet.ops).filter((op) => op.op === "add_task").length : null;
  const phases = (
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
            {phase.slot ? (
              (() => {
                // 1–3 questions a turn, one card at a time; the turn goes back
                // after the last one. Stop sends what Tangent has right away.
                const { slots, at, turn, progress } = phase.slot;
                const name = slots[at];
                const card = phase.questions[at];
                const advance = (t: SlotTurn, answer?: string) => {
                  say({ role: "assistant", text: card.question });
                  if (answer) say({ role: "user", text: answer });
                  if (at + 1 < slots.length) setPhase({ ...phase, slot: { ...phase.slot!, at: at + 1, turn: t } });
                  else void send(phase.text, { slotTurn: t });
                };
                // The bar fills as the batch is answered; 0.7 reads as 100%.
                const score = 0.7 * Math.min(1, progress + ((1 - progress) * at) / slots.length);
                if (!name || !card) return null;
                return (
                  <SlotQuestionCard
                    key={`${name}-${turn.answers.length + turn.skipped.length}`}
                    card={card}
                    score={score}
                    checkIn={false}
                    onAnswer={(answer) => advance({ ...turn, answers: [...turn.answers, { slot: name, answer }], inARow: turn.inARow + 1 }, answer)}
                    onSkip={() => advance({ ...turn, skipped: [...turn.skipped, name], inARow: turn.inARow + 1 })}
                    onStop={() => void send(phase.text, { slotTurn: { ...turn, stopped: true } })}
                    onKeepGoing={() => undefined}
                  />
                );
              })()
            ) : (
              <ClarifyCard
                questions={phase.questions}
                skipLabel="Skip for now"
                onSubmit={(answers) => {
                  for (const a of answers ?? []) {
                    const q = phase.questions.find((x) => x.id === a.id);
                    if (q) say({ role: "assistant", text: q.question });
                    if (a.answer) say({ role: "user", text: a.answer });
                  }
                  void send(phase.text, { answers });
                }}
              />
            )}
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
            {phase.note && <p className="add-grill-note" role="status">{phase.note}</p>}
            <PreviewCard
              changeSet={phase.changeSet}
              preview={phase.preview}
              onChanged={() => void refresh()}
              grill={{ said: phase.said, asked: phase.asked }}
              hideCalendar={workspace}
              onOps={workspace ? setDraftOps : undefined}
              onConfirmed={(_actionId, info) => {
                // Round 4 §3.2: the talk that made this plan opens its project's chat.
                if (!workspace || !info?.planId) return;
                const told = briefRef.current.trim();
                const lines: ThreadLine[] = [
                  ...logRef.current,
                  ...(told ? [{ role: "user" as const, text: `More about this: ${told}` }] : []),
                  { role: "assistant", text: `Planned round 1: ${steps ?? "a few"} step${steps === 1 ? "" : "s"} for about a week. When you finish them, tell me how they went and I'll plan the next round.` },
                ];
                void seedProjectThread(info.planId, lines, logRef.current[0]?.text.slice(0, 80));
              }}
              onSettled={() =>
                window.setTimeout(() => {
                  setPhase({ kind: "compose" });
                  endPlanning();
                }, 2500)
              }
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
        {phase.kind === "heard" && (
          <m.p key="heard" className="add-status" role="status" {...fade}>
            Only heard “{phase.text.replace(/[.!?]+$/, "")}”. Say a bit more, or press Enter to add it anyway.
          </m.p>
        )}
        {phase.kind === "error" && (
          <m.p key="error" className="add-status is-error" role="alert" {...fade}>
            {phase.message}
          </m.p>
        )}
      </AnimatePresence>
  );
  const helpCard = help && <HelpPlanBetter key={help.planId} planId={help.planId} said={help.said} asked={help.asked} onDone={() => setHelp(null)} />;
  const layoutMotion = reduce ? { layout: false as const } : { layout: true as const, transition: { layout: { type: "spring" as const, visualDuration: 0.3, bounce: 0 } } };

  if (!workspace) {
    return (
      <m.section {...layoutMotion} className={`add-flow is-${variant}${listening ? " is-listening" : ""}`} aria-label="Add to Tangent">
        {composer}
        {phases}
        {helpCard}
      </m.section>
    );
  }

  // Round 4 §3.3: the planning workspace. Talk on the left, the plan on the right.
  const title = log[0]?.text ?? (phase.kind === "asking" ? phase.text : "your plan");
  const basedOn = phase.kind === "preview" ? [...(phase.preview.factsUsed ?? []), ...(phase.changeSet.assumptions ?? []).map((a) => `Assumed: ${a}`)] : [];
  const today = getUserToday(timezone);
  const close = () => {
    setPhase({ kind: "compose" });
    endPlanning();
    reset();
  };
  return (
    <m.section {...layoutMotion} className={`add-flow is-${variant} is-workspace${listening ? " is-listening" : ""}`} aria-label="Planning with Tangent">
      <PlanWorkspace
        title={title}
        pane={pane}
        onPane={setPane}
        head={
          <div className="plan-ws-actions">
            <ModeToggle mode={talkMode} onChange={setTalkMode} disabled={busy} />
            <button type="button" className="tg-clarify-quiet" onClick={close}>
              Close
            </button>
          </div>
        }
        chat={
          <>
            <ol className="plan-ws-log" aria-label="So far">
              {log.map((l, i) => (
                <li key={i} className={`plan-ws-line is-${l.role}`}>
                  {l.text}
                </li>
              ))}
            </ol>
            {phases}
            <label className="plan-ws-brief">
              <span>Tell me anything about this: your schedule, what you&apos;ve already done, what&apos;s hard</span>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={1500} placeholder="Optional. It shapes the next draft." />
            </label>
            <div className="plan-ws-composer">{composer}</div>
            {helpCard}
          </>
        }
        plan={
          <>
            {draftOps && draftOps.some((op) => op.op === "add_task") ? (
              <PlanCalendarPreview ops={draftOps} tasks={state?.tasks ?? []} plans={state?.plans ?? []} weekStart={state?.user.weekStart ?? 0} today={today} />
            ) : (
              <CalendarPlaceholder working={phase.kind === "working"} />
            )}
            <HowThisPlanWorks steps={steps} basedOn={basedOn} />
          </>
        }
      />
    </m.section>
  );
}

const fade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.25, bounce: 0 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
} as const;
