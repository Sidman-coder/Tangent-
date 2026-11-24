"use client";

// Adding anything to Tangent, in one place. Used as the hero on Today and
// inside the ⌘K sheet, so it works the same everywhere:
//
//   1. Type it or say it. The server decides what it is first
//      (lib/pipeline/talk-route.ts). Round 5A: talk first. A question or a
//      goal gets a real answer, streamed in as markdown; a goal's answer ends
//      with "Plan this into my calendar". A plan is built only when the
//      student asks in words or presses that button. A plain to-do goes on the
//      calendar straight away.
//   2. Planning shows its real steps as they start (ThinkingStages), may ask
//      one question (skippable), then opens the split: the brief on the left,
//      the calendar on the right (PlanBrief, PlanWorkspace).
//   3. It says where it landed - the day, or the project - with Undo.
//
// On Home the conversation takes over the page once a message is answered
// (Round 5A Q4); "Back to Today" ends it. Nothing is saved as chat history.
//
// Frontend only: it drives the same /api/chat, /api/confirm, /api/changesets
// and /api/questions routes the palette, mic and AI page already use.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ArrowLeft, ArrowRight, ArrowUp, AudioLines, Mic, Orbit } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { planSeriesColor } from "@/lib/task-colors";
import "@/components/console/clarify-card.css";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import SlotQuestionCard from "@/components/grill/SlotQuestionCard";
import { readChatReply } from "@/components/console/turns";
import TalkThread, { type TalkLine } from "@/components/talk/TalkThread";
import Markdown from "@/components/console/Markdown";
import ThinkingStages from "@/components/plan/ThinkingStages";
import PlanBrief from "@/components/plan/PlanBrief";
import BusyTimeOffer from "@/components/talk/BusyTimeOffer";
import type { BriefView, PlanStage } from "@/lib/voice-handler";

/** "Grill until enough" so far, sent back each turn (lib/context/grill.ts). */
type SlotTurn = { answers: { slot: string; answer: string }[]; skipped: string[]; inARow: number; stopped: boolean };
const NO_TURN: SlotTurn = { answers: [], skipped: [], inARow: 0, stopped: false };
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { routeAsk } from "@/lib/ask-route";
import { heardSomethingToAdd } from "@/lib/voice-intent";
import { ASK_EVENT, takeAsk } from "@/lib/ask-handoff";
import { projectFor } from "@/lib/pipeline/home-route";
import { putNewPathTitle } from "@/lib/path-handoff";
import { HOME_INTENT_EVENT, planRequestFor, takeHomeIntent, takeHomePlan, type HomeIntent } from "@/lib/home-intent";
import { generateQuestions } from "@/lib/questions-client";
import { takeTalkHandoff } from "@/lib/talk-handoff";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import HelpPlanBetter from "@/components/grill/HelpPlanBetter";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import { getUserToday } from "@/lib/time";
import DestPill, { type DestChoice } from "./DestPill";
import PlanWorkspace, { CalendarPlaceholder, type Pane } from "./PlanWorkspace";
import { findDraft } from "@/lib/drafts/draft-store";
import { friendlyError } from "@/lib/friendly-error";
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
  /** Round 5A talk first: an answer about something that could be scheduled. */
  schedulable?: boolean;
  /** The goal "Plan this" will plan (and the brief's question is about). */
  planGoal?: string;
  /** The plan brief's one question (lib/ai/plan-brief-call.ts). */
  planQuestion?: boolean;
  brief?: BriefView;
};

/** Planning asked for, in words or with "Plan this into my calendar". */
type PlanAsk = { planThis: true; planGoal: string; planAnswer?: { question: string; answer: string } };

type Phase =
  | { kind: "compose" }
  | { kind: "working"; text: string; thinking?: boolean; streaming?: boolean }
  | { kind: "asking"; text: string; questions: ClarifyQuestion[]; message: string; slot?: { slots: string[]; progress: number; at: number; turn: SlotTurn } }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload; said: string; asked: number; note?: string; brief: BriefView | null }
  | { kind: "done"; summary: string; actionId: string | null; where: { href: string; label: string } | null }
  | { kind: "error"; message: string }
  | { kind: "heard"; text: string };

/** The brief's question, skipped: Tangent picks its own defaults. */
const SKIP_ANSWER = "No preference, use your best guess";

function clean(text: string | undefined, fallback: string): string {
  const t = (text ?? "").replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  return !t || t.startsWith("{") ? fallback : t;
}

function dayName(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

let lineSeq = 0;
const lineId = () => `l${Date.now().toString(36)}${(lineSeq++).toString(36)}`;

/** After a few seconds of waiting, say plainly that it is still going and roughly how long it can take (overnight C09). */
function SlowNote() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(t);
  }, []);
  return slow ? <span className="add-slow">Still working. Longer plans can take up to 30 seconds.</span> : null;
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
  const hero = variant === "hero";

  // Round 5A 2.1: the talk on Home. Newest last; nothing is saved.
  const [talk, setTalk] = useState<TalkLine[]>([]);
  const talkRef = useRef(talk);
  talkRef.current = talk;
  // A follow-up question while the brief is open: the brief stays put.
  const [talkBusy, setTalkBusy] = useState(false);
  // The real planning step under way (lib/voice-handler.ts emits these).
  const [stage, setStage] = useState<PlanStage | null>(null);
  // The brief's one question, waiting for the student's typed answer.
  const pendingPlan = useRef<{ goal: string; question: string } | null>(null);

  // Round 5A 2.3: the split once round 1 is placed. The talk before it folds
  // into "Your conversation"; follow-ups carry on under the brief.
  const [planning, setPlanning] = useState(false);
  const planningRef = useRef(planning);
  planningRef.current = planning;
  const [history, setHistory] = useState<TalkLine[]>([]);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [pane, setPane] = useState<Pane>("brief");
  const [draftOps, setDraftOps] = useState<ChangeSet["ops"] | null>(null);
  // What the plan is for: the goal "Plan this" planned.
  const [topic, setTopic] = useState("");
  const topicRef = useRef(topic);
  topicRef.current = topic;

  const endTalk = useCallback(() => {
    setPlanning(false);
    setHistory([]);
    setTalk([]);
    setStage(null);
    setTalkBusy(false);
    setPane("brief");
    setDraftOps(null);
    setTopic("");
    pendingPlan.current = null;
  }, []);

  const projects = useMemo(
    () => (state?.plans ?? []).slice(-6).reverse().map((p) => ({ id: p.id, title: p.title, color: planSeriesColor(p) })),
    [state?.plans]
  );
  const route = routeAsk(text);
  // The student's pick wins; on Auto the words decide.
  const dest: Dest = choice?.dest ?? (route === "project" ? "project" : "calendar");
  // Only a long-range goal leaves Home (for Tangents), and never one about a
  // project they already have. Questions are answered right here.
  const allPlans = state?.plans;
  const handoff = !choice && route === "goal" && !projectFor(text, allPlans ?? []) ? "goal" : null;
  const targetProject = choice?.dest === "project" ? choice.projectId : "new";

  useEffect(() => {
    if (autoFocus) window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [autoFocus]);

  useEffect(() => {
    onTextChange?.(text);
  }, [onTextChange, text]);

  // Overnight 2 L11: what's typed in Home's box but not sent survives leaving
  // Home or a reload ("drafts never lost"). This device only; sending or
  // emptying the box clears it.
  const unsentKey = variant === "hero" ? "tangent:home-unsent" : null;
  const restored = useRef(false);
  useEffect(() => {
    if (!unsentKey || restored.current) return;
    restored.current = true;
    try {
      const kept = window.localStorage.getItem(unsentKey);
      if (kept && !initialText) setText((t) => t || kept);
    } catch {
      /* storage blocked: nothing to restore */
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!unsentKey || !restored.current) return;
    try {
      if (text.trim()) window.localStorage.setItem(unsentKey, text.slice(0, 2000));
      else window.localStorage.removeItem(unsentKey);
    } catch {
      /* storage blocked: the text just isn't kept */
    }
  }, [text, unsentKey]);

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
    async (said: string, followUp?: { answers?: ClarifyAnswer[] | null; slotTurn?: SlotTurn }, source: "voice" | "typed" = "typed", ask?: PlanAsk) => {
      const words = said.trim();
      if (!words) return;
      const inWorkspace = hero && planningRef.current;
      // Round 5A 2.2: a typed reply to the brief's one question plans with it.
      const pending = pendingPlan.current;
      if (hero && !followUp && !ask && pending) {
        ask = { planThis: true, planGoal: pending.goal, planAnswer: { question: pending.question, answer: words } };
      }
      pendingPlan.current = null;
      // In the split, anything that isn't a question changes the draft: plan
      // again with it, and let the old draft go.
      const before = phaseRef.current;
      if (inWorkspace && !followUp && !ask && !/\?\s*$/.test(words) && topicRef.current) {
        ask = { planThis: true, planGoal: topicRef.current, planAnswer: { question: "Change to the draft", answer: words } };
        if (before.kind === "preview") void fetch(`/api/changesets/${encodeURIComponent(before.changeSet.id)}/discard`, { method: "POST" }).catch(() => {});
        setDraftOps(null);
      }
      // A question beside the brief keeps the brief (and its edits) on screen.
      const keepBrief = inWorkspace && !ask && before.kind === "preview";
      if (keepBrief) setTalkBusy(true);
      else setPhase({ kind: "working", text: words, thinking: !!ask || (!followUp && (/\?\s*$/.test(words) || routeAsk(words) === "question")) });
      setHelp(null);
      setStage(null);
      // Overnight 2 L1/L6: on Auto, "how do I get better at…" went straight to
      // grill cards. Only a project the student picked skips the server's
      // talk-first router; on Auto the server decides (lib/pipeline/talk-route.ts).
      const toProject = dest === "project" && choice?.dest === "project";
      // The talk so far rides along as context.
      const earlier = hero
        ? [...historyRef.current, ...talkRef.current]
            .filter((l) => l.text && !l.streaming)
            .map((l) => ({ role: l.role, content: l.text }))
            .slice(-12)
        : [];

      // The student's words show in the talk once Tangent starts answering, or
      // straight away when the talk is already open. A quick to-do never
      // takes over Home.
      const userLine: TalkLine = { id: lineId(), role: "user", text: words };
      const replyId = lineId();
      let shown = false;
      const showUser = () => {
        if (shown || !hero) return;
        shown = true;
        setTalk((t) => [...t, userLine]);
      };
      if (hero && (talkRef.current.length > 0 || inWorkspace || ask)) showUser();
      const writeReply = (patch: Partial<TalkLine>) =>
        setTalk((t) => (t.some((l) => l.id === replyId) ? t.map((l) => (l.id === replyId ? { ...l, ...patch } : l)) : [...t, { id: replyId, role: "assistant", text: "", ...patch }]));
      const started = () => setPhase((p) => (p.kind === "working" ? { ...p, streaming: true } : p));
      let streamedBrief: BriefView | null = null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...earlier, { role: "user", content: words }],
            mode: "calendar",
            // Home streams its answers (Round 5A 2.1); the sheet doesn't need to.
            stream: hero,
            source,
            // Decided on the server before anything asks (lib/pipeline/talk-route.ts).
            home: true,
            // A plain to-do is saved instantly; anything bigger is considered for questions.
            capture: !ask && !toProject && !followUp && earlier.length === 0,
            clarify: !ask && (!followUp || !!followUp.slotTurn),
            answers: followUp?.answers ?? undefined,
            // A few questions until Tangent knows enough (lib/context/goal-slots.ts).
            slotFlow: true,
            slotTurn: followUp?.slotTurn,
            ...(ask ?? {}),
            ...(toProject && !ask ? (targetProject === "new" ? { newProject: true } : { projectId: targetProject }) : {}),
          }),
        });
        if (!res.ok && !(res.headers.get("content-type") ?? "").includes("json")) throw new Error("That didn't go through. Try again.");
        const data = (await readChatReply(res, (line) => {
          if (line.type === "reply_text" && typeof line.text === "string") {
            showUser();
            started();
            writeReply({ text: line.text, streaming: true });
          } else if (line.type === "stage" && typeof line.id === "string") {
            showUser();
            started();
            setStage(line.id as PlanStage);
          } else if (line.type === "plan_brief" && line.brief) {
            streamedBrief = line.brief as BriefView;
          }
        })) as Reply;
        setStage(null);
        if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through. Try again.");
        if (data.action === "error") throw new Error(clean(data.message, "Sorry, I couldn't do that. Try again."));

        const reply = (data.action === "plan_reply" || data.action === "chat_reply" || data.care === true) && !data.actionId;
        if (reply && hero) {
          // An answer, in the talk. Nothing was added.
          const message = (data.message ?? data.response ?? "").trim() || "I'm not sure. Can you say a bit more?";
          const goal = data.planGoal?.trim() || "";
          showUser();
          writeReply({
            text: message,
            streaming: false,
            ...(data.planQuestion && goal ? { planQuestion: true, planGoal: goal } : {}),
            ...(data.schedulable && goal && !data.planQuestion ? { offerPlan: true, planGoal: goal } : {}),
          });
          if (data.planQuestion && goal) pendingPlan.current = { goal, question: message };
          if (keepBrief) setTalkBusy(false);
          else setPhase(inWorkspace && before.kind === "preview" ? before : { kind: "compose" });
          reset();
          return;
        }
        if (reply) {
          setPhase({ kind: "done", summary: clean(data.message ?? data.response, "I'm not sure. Can you say a bit more?"), actionId: null, where: null });
          reset();
          return;
        }
        if (data.action === "clarify" && data.questions?.length) {
          const slot = data.slotFlow ? { slots: data.slotFlow.slots, progress: data.slotFlow.progress, at: 0, turn: followUp?.slotTurn ?? NO_TURN } : undefined;
          setPhase({ kind: "asking", text: words, questions: data.questions, message: data.message ?? "A few quick questions so this fits you.", slot });
          if (hero) setText("");
          return;
        }
        if (data.action === "confirm_required" && data.pending) {
          setPhase({ kind: "confirm", id: data.pending.id, message: data.pending.message });
          return;
        }
        if (data.action === "preview" && data.changeSet && data.preview) {
          const brief = data.brief ?? streamedBrief;
          setPhase({
            kind: "preview",
            changeSet: data.changeSet,
            preview: data.preview,
            said: words,
            asked: followUp?.answers?.length ?? followUp?.slotTurn?.answers.length ?? 0,
            note: data.grillNote,
            brief,
          });
          // Round 5A 2.3: on Home, a placed round opens the split: the brief
          // on the left, the calendar on the right.
          if (hero) {
            if (!inWorkspace) {
              setHistory((h) => [...h, ...talkRef.current.filter((l) => l.text)]);
              setTalk([]);
            }
            setTopic(ask?.planGoal || data.planGoal || topicRef.current || words);
            setPlanning(true);
            setPane("brief");
            setText("");
            setDraftOps(data.changeSet.ops);
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
        setStage(null);
        setTalk((t) => t.filter((l) => !(l.id === replyId && !l.text)).map((l) => (l.id === replyId ? { ...l, streaming: false } : l)));
        if (keepBrief) setTalkBusy(false);
        setPhase(keepBrief ? before : { kind: "error", message: friendlyError(e, "Something went wrong.") });
        if (keepBrief) setTalk((t) => [...t, { id: lineId(), role: "assistant", text: friendlyError(e, "Something went wrong.") }]);
      }
    },
    [dest, finish, hero, onClose, reset, router, targetProject]
  );

  const submit = useCallback(() => {
    const words = text.trim();
    if (!words) return;
    if (handoff === "goal" && !(hero && (planningRef.current || talkRef.current.length > 0))) {
      putNewPathTitle(words);
      reset();
      onClose?.();
      router.push("/tangents?new=1");
      return;
    }
    void send(words);
  }, [handoff, hero, onClose, reset, router, send, text]);

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
        setPhase({ kind: "error", message: friendlyError(e, "Something went wrong.") });
      }
    },
    [finish]
  );

  // "Plan this into my calendar" under a goal's answer.
  const planThis = useCallback(
    (line: TalkLine) => {
      if (!line.planGoal) return;
      setTalk((t) => t.map((l) => (l.id === line.id ? { ...l, offerPlan: false } : l)));
      void send("Plan this into my calendar", undefined, "typed", { planThis: true, planGoal: line.planGoal });
    },
    [send]
  );
  const notNow = useCallback((line: TalkLine) => setTalk((t) => t.map((l) => (l.id === line.id ? { ...l, offerPlan: false } : l))), []);
  const skipQuestion = useCallback(
    (line: TalkLine) => {
      if (!line.planGoal) return;
      pendingPlan.current = null;
      void send("Skip, use your best guess", undefined, "typed", { planThis: true, planGoal: line.planGoal, planAnswer: { question: line.text, answer: SKIP_ANSWER } });
    },
    [send]
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
      // here, in this composer. Asking for a plan is explicit, so it plans.
      const plan = takeHomePlan();
      if (plan) {
        void sendRef.current(planRequestFor(plan.goal), undefined, "typed", { planThis: true, planGoal: plan.goal });
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

  // A question asked somewhere else (⌘K, the calendar, a Grill offer) is
  // answered here, in the box, not in a side panel (lib/ask-handoff.ts).
  useEffect(() => {
    if (variant !== "hero") return;
    const take = () => {
      const asked = takeAsk("ai");
      if (asked) void sendRef.current(asked);
    };
    const params = new URLSearchParams(window.location.search);
    if (params.get("ask") === "1") {
      take();
      router.replace("/", { scroll: false });
    }
    // Round 5A 2.5: "Plan this" from /capture. The talk comes over, then it plans.
    if (params.get("plan") === "1") {
      const handoff = takeTalkHandoff();
      router.replace("/", { scroll: false });
      if (handoff) {
        const lines: TalkLine[] = handoff.lines.map((l) => ({ id: lineId(), role: l.role, text: l.text }));
        talkRef.current = lines;
        setTalk(lines);
        void sendRef.current("Plan this into my calendar", undefined, "typed", { planThis: true, planGoal: handoff.goal });
      }
    }
    // Round 5A 4.2: "Open full view" on a draft pill comes back here with
    // ?draft=<id>; the plan reopens in the split, the box text untouched.
    const draftId = params.get("draft");
    if (draftId) {
      router.replace("/", { scroll: false });
      const d = findDraft(draftId);
      if (d) {
        setPhase({ kind: "preview", changeSet: d.changeSet, preview: d.preview, said: d.changeSet.request_text, asked: 0, brief: null });
        setTopic(d.title);
        setPlanning(true);
        setPane("brief");
        setDraftOps(d.changeSet.ops);
      }
    }
    const onAsk = (event: Event) => {
      if (window.location.pathname !== "/") return;
      event.preventDefault();
      take();
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [router, variant]);

  const busy = phase.kind === "working" || transcribing || talkBusy;
  const workspace = planning && hero;
  const talking = hero && (talk.length > 0 || workspace);
  const hint = handoff === "goal" && !talking ? { icon: Orbit, text: "Sounds like a long-range goal. Enter starts a Tangent." } : null;

  const composer = (
    <>
      <label className="sr-only" htmlFor={inputId}>
        {talking ? "Reply to Tangent" : "What do you want to add?"}
      </label>
      <textarea
        id={inputId}
        name="capture"
        ref={inputRef}
        className={`add-input${listening ? " is-live" : ""}`}
        rows={1}
        value={text}
        disabled={busy}
        placeholder={
          listening
            ? "Listening…"
            : workspace
              ? "Ask about it, or tell me what to change…"
              : talking
                ? "Reply, or ask anything…"
                : placeholder ?? (narrow ? "Type or say anything…" : "Type or say anything: a task, a project, a question")
        }
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
        {!talking && <DestPill choice={choice} projects={projects} onChange={setChoice} disabled={busy} />}
        <button
          type="button"
          className={`add-mic${listening ? " is-on" : ""}`}
          onClick={() => (listening ? voice.stopRecording() : void voice.startRecording())}
          disabled={busy}
          aria-label={listening ? "Stop and send" : "Say it"}
          title={listening ? "Stop and send" : "Say it"}
        >
          {listening ? <AudioLines size={20} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button type="button" className="add-send" onClick={submit} disabled={busy || !text.trim()} aria-label={talking ? "Send" : "Add"}>
          {busy ? <span className="add-spinner" aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </div>

      {/* A long-range goal goes somewhere else; say so first. */}
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

  const phases = (
    <AnimatePresence mode="wait" initial={false}>
      {phase.kind === "working" && phase.text && !phase.streaming && (
        <m.p key="working" className="add-status" role="status" {...fade}>
          <span className="add-spinner" aria-hidden="true" /> {phase.thinking ? "Thinking…" : <>Placing “{phase.text}”…</>} <SlowNote />
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
              const advance = (t: SlotTurn) => {
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
                  onAnswer={(answer) => advance({ ...turn, answers: [...turn.answers, { slot: name, answer }], inARow: turn.inARow + 1 })}
                  onSkip={() => advance({ ...turn, skipped: [...turn.skipped, name], inARow: turn.inARow + 1 })}
                  onStop={() => void send(phase.text, { slotTurn: { ...turn, stopped: true } })}
                  onKeepGoing={() => undefined}
                />
              );
            })()
          ) : (
            <ClarifyCard questions={phase.questions} skipLabel="Skip for now" onSubmit={(answers) => void send(phase.text, { answers })} />
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
      {phase.kind === "preview" && !workspace && (
        <m.div key="preview" {...fade}>
          {phase.note && <p className="add-grill-note" role="status">{phase.note}</p>}
          <PreviewCard
            changeSet={phase.changeSet}
            preview={phase.preview}
            onChanged={() => void refresh()}
            grill={{ said: phase.said, asked: phase.asked }}
            onSettled={(settled) => { if (settled !== "confirmed") window.setTimeout(() => setPhase({ kind: "compose" }), 2500); }}
          />
        </m.div>
      )}
      {phase.kind === "done" && (
        <m.div key="done" className="add-done" role="status" {...fade}>
          {phase.actionId ? (
            <ActionReceipt actionId={phase.actionId} label={phase.summary} onUndone={() => void refresh()} />
          ) : phase.summary.includes("\n") ? (
            // Overnight 2 (R2-L6): a talk answer in the sheet showed raw "##" and
            // "- " in one run-on line. Multi-line answers render as Markdown.
            <Markdown text={phase.summary} />
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
  const stages = stage && phase.kind === "working" && <ThinkingStages current={stage} />;
  const thread = (lines: TalkLine[], compact = false) =>
    lines.length > 0 && <TalkThread lines={lines} busy={busy} onPlanThis={planThis} onNotNow={notNow} onSkipQuestion={skipQuestion} compact={compact} />;
  const backToToday = (
    <div className="talk-head">
      <button
        type="button"
        className="talk-back"
        onClick={() => {
          setPhase({ kind: "compose" });
          endTalk();
          reset();
        }}
        disabled={phase.kind === "working"}
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Today
      </button>
    </div>
  );

  if (!workspace) {
    if (talking) {
      // Round 5A Q4: the talk takes over Home, the box pinned under it.
      return (
        <m.section {...layoutMotion} className={`add-flow is-${variant} is-talk${listening ? " is-listening" : ""}`} aria-label="Talk with Tangent">
          {backToToday}
          <div aria-live="polite">{thread(talk)}</div>
          {stages}
          {phases}
          <div className="talk-composer">{composer}</div>
          {helpCard}
        </m.section>
      );
    }
    return (
      <m.section {...layoutMotion} className={`add-flow is-${variant}${listening ? " is-listening" : ""}`} aria-label="Add to Tangent">
        {composer}
        {phases}
        {helpCard}
      </m.section>
    );
  }

  // Round 5A 2.3: the split. The brief on the left, the calendar on the right.
  const today = getUserToday(timezone);
  const followUps = (
    <>
      {thread(talk, true)}
      {stages}
      {phases}
    </>
  );
  const historyFold = history.length > 0 && (
    <details className="plan-brief-history">
      <summary>Your conversation</summary>
      <TalkThread lines={history} compact />
    </details>
  );
  return (
    <m.section {...layoutMotion} className={`add-flow is-${variant} is-workspace is-talk${listening ? " is-listening" : ""}`} aria-label="Planning with Tangent">
      <PlanWorkspace
        pane={pane}
        onPane={setPane}
        head={backToToday}
        brief={
          phase.kind === "preview" ? (
            <>
              {historyFold}
              {phase.note && <p className="add-grill-note" role="status">{phase.note}</p>}
              <BusyTimeOffer text={history.filter((l) => l.role === "user").map((l) => l.text).join("\n") || topic} />
              <PlanBrief
                key={phase.changeSet.id}
                changeSet={phase.changeSet}
                preview={phase.preview}
                brief={phase.brief}
                goal={topic}
                onChanged={() => void refresh()}
                onOps={setDraftOps}
                onSettled={(settled) => {
                  // A confirmed plan stays on screen with its "Saved" line until the
                  // student leaves (overnight C05); a discarded or undone one closes.
                  if (settled === "confirmed") return;
                  window.setTimeout(() => {
                    if (phaseRef.current.kind === "preview" && phaseRef.current.changeSet.id === phase.changeSet.id) {
                      setPhase({ kind: "compose" });
                      endTalk();
                    }
                  }, 4000);
                }}
                composer={
                  <>
                    {followUps}
                    <div className="plan-ws-composer">{composer}</div>
                  </>
                }
              />
            </>
          ) : (
            <>
              {historyFold}
              {followUps}
              <div className="plan-ws-composer">{composer}</div>
              {helpCard}
            </>
          )
        }
        calendar={
          draftOps && draftOps.some((op) => op.op === "add_task") ? (
            <PlanCalendarPreview ops={draftOps} tasks={state?.tasks ?? []} plans={state?.plans ?? []} weekStart={state?.user.weekStart ?? 0} today={today} />
          ) : (
            <CalendarPlaceholder working={phase.kind === "working"} />
          )
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
