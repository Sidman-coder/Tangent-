"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGreeting } from "@/lib/greetings";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { localNow } from "@/lib/time";
import ChatThread from "@/components/console/ChatThread";
import { routeAsk } from "@/lib/ask-route";
import type { AskAbout } from "@/lib/ask-handoff";
import type { ChatScope } from "@/lib/chat/scope";
import { splitCourse } from "@/lib/course";
import { putNewPathTitle } from "@/lib/path-handoff";
import { PENDING_QUESTION_ID } from "@/lib/pending-question";
import type { ClarifyAnswer } from "@/components/console/ClarifyCard";
import { answerQuestions as answerLaterQuestions, generateQuestions } from "@/lib/questions-client";
import { seedGrill } from "@/lib/grill-client";
import Composer from "@/components/console/Composer";
import {
  actionLabel,
  applyPlanProgress,
  cleanMessage,
  readChatReply,
  redoable,
  toolsForAction,
  turnsFromMessages,
  withCard,
  type ChatMode,
  type PlanProgressView,
  type Turn,
} from "@/components/console/turns";
import { usePipelineV2 } from "@/components/PipelineFlag";
import { fallbackTitle, isNewTopic } from "@/lib/chat-title";
import { chatOnly, draftShownPlan, fetchOpenDrafts, withOpenDrafts } from "@/components/console/pipeline-intake";
import { isReadyReply, openPlanTurn, talkingRoute } from "@/components/console/talking";
import { isAddShownPlan } from "@/lib/pipeline/plan-text";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import {
  VOICE_TRANSCRIPT_EVENT,
  type VoiceCaptureStatus,
  type VoiceTranscriptDetail,
} from "@/hooks/useVoiceCapture";
import type { ChatMessageRefs, ChatSession } from "@/lib/types";
import { actionIdsOf, announceUndo, withUndoStatus, type UndoRecord } from "@/lib/undo-events";
import {
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Clock,
  Flag,
  Hammer,
  Library,
  ListChecks,
  Repeat,
  Sun,
  Timer,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PenMark from "@/components/console/PenMark";
import { formatTime12 } from "@/lib/dates";
import { tracksCompletion } from "@/lib/urgency";
import { aiFirstSuggestion, prefsOf, type AiSuggestionKey } from "@/lib/personalize";
import "./console.css";

// Linear-style starter cards: fill the composer, never send on their own.
const SUGGESTIONS = [
  { icon: CalendarRange, text: "Plan my week", detail: "Spread this week’s work across your free time" },
  { icon: Sun, text: "What's on today?", detail: "Today’s tasks and events, in order" },
  { icon: Timer, text: "What fits in 30 minutes?", detail: "Quick tasks for a short gap" },
  { icon: CalendarClock, text: "Move overdue tasks", detail: "Find new slots for anything that slipped" },
] as const;

const SUGGESTION_ICON: Partial<Record<AiSuggestionKey, LucideIcon>> = {
  study: BookOpen,
  project: Hammer,
  practice: Repeat,
  prepare: Flag,
  organize: ListChecks,
};

/** What the student said they're working toward leads the list; the rest stay
 *  as they were. Still four cards, and none of them sends on its own. */
function suggestionsFor(workingToward: unknown): { icon: LucideIcon; text: string; detail: string }[] {
  const first = aiFirstSuggestion(prefsOf({ workingToward }));
  const base = SUGGESTIONS.map((s) => ({ icon: s.icon as LucideIcon, text: s.text as string, detail: s.detail as string }));
  if (!first) return base;
  return [{ icon: SUGGESTION_ICON[first.key] ?? Sun, text: first.text, detail: first.detail }, ...base.slice(0, 3)];
}

function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Still up";
}

/** Turns a fetch/route failure into something true and actionable. */
function describeFailure(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("504") || lower.includes("aborted")) {
    return "That took too long and was cut off. Calendar mode does several rounds of research before it answers — try a narrower request, or ask again.";
  }
  if (lower.includes("set up on the server") || lower.includes("401") || lower.includes("503")) {
    return "Tangent's AI isn't available right now. Try again later.";
  }
  if (lower.includes("429") || lower.includes("rate")) {
    return "Claude is rate-limited right now. Wait a moment and try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Try again in a moment.";
}

const MODE_STORAGE_KEY = "tangent:ai:mode";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
}

/** Master fix Phase 4: chats renamed by hand keep their name; automatic
 *  titles skip them (remembered in this browser). */
const MANUAL_TITLES_KEY = "tangent:ai:manualTitles";

function manualTitles(): string[] {
  try {
    const list = JSON.parse(readStored(MANUAL_TITLES_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Master fix Phase 4: thumbs, Retry, Edit, Stop and new-topic choices,
 *  logged as events (app/api/events). Never blocks the chat. */
function logChatEvent(type: string, props: Record<string, string | number | boolean> = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, props }),
  }).catch(() => {});
}

const PROJECT_STARTERS = ["What should I do next?", "Break the next step down", "Add a review session before the deadline", "Am I on track?"];
const TASK_STARTERS = ["Break this down", "How long will this take?", "How should I start?"];

export type ChatPanelProps = {
  /** What this chat is about: one task, one project, or anything (Home). */
  scope: ChatScope;
  /** A chat to open (the library, or ?chat= on Home) instead of the scope's own. */
  openId?: string | null;
  /** A question handed over (Cmd-K, AddFlow, Grill me) to send on open. */
  askOnOpen?: string | null;
  /** Done / Esc: the host closes the panel. */
  onDone?: () => void;
};

/**
 * Round 2 Phase D: the one chat surface, scoped. Home, a task's chat sheet and
 * a project's chat panel all render this; each scope keeps one continuing
 * thread (lib/chat/scope.ts), and general chats continue within two hours.
 */
export default function ChatPanel({ scope, openId = null, askOnOpen = null, onDone }: ChatPanelProps) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const workingToward = state?.user?.workingToward;
  const suggestions = useMemo(() => suggestionsFor(workingToward), [workingToward]);
  const tz = useUserTimezone();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [chatMode, setChatMode] = useState<ChatMode>("calendar");
  const v2 = usePipelineV2();

  useEffect(() => {
    if (readStored(MODE_STORAGE_KEY) === "plan" && !v2) setChatMode("plan");
  }, [v2]);

  const changeMode = useCallback((next: ChatMode) => {
    setChatMode(next);
    writeStored(MODE_STORAGE_KEY, next);
  }, []);

  // What's next today, shown under the question so the assistant opens with
  // the student's actual day rather than a blank box. "Today" and "now" are the
  // student's own timezone, not the browser's or the server's.
  const today = useMemo(() => {
    if (!state) return null;
    const { date: ymd, time: now } = localNow(tz);
    // Counts what Today counts. This used to filter on `!completed` alone, so
    // it swept in School Blocks and commitments — scheduled things that never
    // get ticked off — and reported a bigger number than the dashboard for the
    // same day. Canvas assignments still count: they arrive with source
    // "canvas", which tracksCompletion lets through.
    const open = state.tasks
      .filter((t) => t.date === ymd && !t.completed && tracksCompletion(t))
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    const next = open.find((t) => t.time && t.time >= now) ?? null;
    return { left: open.length, next };
  }, [state, tz]);

  // The name comes from the student's profile (Supabase), not localStorage.
  const firstName = state?.user.displayName?.trim().split(/\s+/)[0] ?? "";
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    // The same greeting as Today (lib/greetings.ts), so the two never disagree.
    const hour = localNow(tz).hour;
    setGreeting(firstName ? getGreeting(firstName, hour) : `${partOfDay(hour)}.`);
  }, [firstName, tz]);

  /** "Ask about this": the project or task this chat is about. Only the id
   *  is kept; its title comes from the app state. */
  const scopeKey = scope.type === "task" ? `task:${scope.taskId}` : scope.type === "project" ? `project:${scope.projectId}` : "general";
  const attachment = useMemo<AskAbout | null>(
    () => (scope.type === "project" ? { kind: "project", id: scope.projectId } : scope.type === "task" ? { kind: "task", id: scope.taskId } : null),
    // scopeKey names the scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey]
  );
  const attachedPlan = attachment?.kind === "project" ? state?.plans.find((p) => p.id === attachment.id) : undefined;
  const attachedTask = attachment?.kind === "task" ? state?.tasks.find((t) => t.id === attachment.id) : undefined;
  const attachedTitle = attachedPlan?.title ?? (attachedTask ? splitCourse(attachedTask).title : undefined);

  const [turns, setTurns] = useState<Turn[]>([]);
  /** A4: the finished schedule the "Add plan to calendar" chip adds. */
  const plannable = useMemo(() => openPlanTurn(turns), [turns]);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [planProgress, setPlanProgress] = useState<PlanProgressView | null>(null);
  /** Master fix Phase 4: the reply so far, while it streams in. */
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  /** The last turn's id while its message is being edited in the composer. */
  const [editing, setEditing] = useState<string | null>(null);
  /** "Keep here" answered the new-topic chips at this many turns. */
  const [topicSettledAt, setTopicSettledAt] = useState(-1);
  /** The topic title in flight, so a project name lands after it. */
  const titling = useRef<Promise<void> | null>(null);
  /** The draft reads as a different subject: offer a new chat, once. */
  const newTopic = useMemo(
    () =>
      scope.type === "general" && !busy && !editing && topicSettledAt !== turns.length && isNewTopic(turns.map((t) => t.request), input),
    [scope.type, busy, editing, topicSettledAt, turns, input]
  );
  const [err, setErr] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceCaptureStatus>("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Pipeline V2: the composer holds dictated words (sent as source "voice"),
  // and the next send is a tapped answer to a pending question.
  const dictated = useRef(false);
  const tappedPick = useRef(false);

  /** Drops a voice transcript into the composer — visible, editable, cursor at
   *  the end — and stops there. The student presses Enter/Send to submit. */
  const acceptTranscript = useCallback((text: string) => {
    dictated.current = true;
    setErr(null);
    setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));
    window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  }, []);

  // Claim transcripts from the global mic / hold-Space so they land here
  // instead of in the command palette while the console is on screen.
  useEffect(() => {
    const onTranscript = (e: Event) => {
      e.preventDefault();
      acceptTranscript((e as CustomEvent<VoiceTranscriptDetail>).detail.text);
    };
    window.addEventListener(VOICE_TRANSCRIPT_EVENT, onTranscript);
    return () => window.removeEventListener(VOICE_TRANSCRIPT_EVENT, onTranscript);
  }, [acceptTranscript]);


  /** The chat list lives in the library (/ai), which loads its own; nothing
   *  here to refresh. Kept so the save paths below read the same. */
  const loadSessions = useCallback(async () => {}, []);

  /** Master fix Phase 4: names a chat after its project, else a short topic
   *  (app/api/sessions "autotitle"). A name the student chose is kept. */
  const autoTitle = useCallback(
    (sessionId: string, from: { text?: string; projectTitle?: string }) => {
      if (manualTitles().includes(sessionId)) return;
      const run = async () => {
        if (from.projectTitle) await titling.current;
        if (manualTitles().includes(sessionId)) return;
        try {
          await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "autotitle", sessionId, ...from }),
          });
        } catch {}
        void loadSessions();
      };
      const pending = run();
      if (!from.projectTitle) titling.current = pending;
    },
    [loadSessions]
  );

  /** Pipeline V2: open drafts from the last 24 hours come back as cards. */
  const restoreDrafts = useCallback(async () => {
    if (!v2) return;
    const drafts = await fetchOpenDrafts();
    if (drafts.length) setTurns((prev) => withOpenDrafts(prev, drafts));
  }, [v2]);

  /** A reopened chat: is each saved change still undoable? (Safety hotfix.) */
  const recheckUndo = useCallback(async (restored: Turn[]) => {
    const ids = actionIdsOf(restored);
    if (!ids.length) return;
    try {
      const res = await fetch(`/api/actions?ids=${ids.join(",")}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: UndoRecord[] };
      if (res.ok && data.ok) setTurns((prev) => withUndoStatus(prev, data.actions ?? []));
    } catch {}
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    try {
      const [res, confirms] = await Promise.all([
        fetch(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`),
        fetch("/api/confirm")
          .then((r) => r.json() as Promise<{ ok?: boolean; pending?: { id: string; message: string }[] }>)
          .then((d) => (d.ok ? d.pending ?? [] : []))
          .catch(() => []),
      ]);
      const data = (await res.json()) as { ok?: boolean; session?: ChatSession };
      if (data.ok && data.session) {
        setActiveSessionId(data.session.id);
        const restored = turnsFromMessages(data.session.messages, confirms);
        setTurns(restored);
        setEditing(null);
        void recheckUndo(restored);
        void restoreDrafts();
        setErr(null);
      }
    } catch {}
  }, [restoreDrafts, recheckUndo]);

  const newChat = useCallback(() => {
    if (busy) return;
    setActiveSessionId(null);
    setSaveWarning(null);
    setTurns([]);
    setInput("");
    setEditing(null);
    setErr(null);
    void restoreDrafts();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [busy, restoreDrafts]);

  // A question handed over (Cmd-K, AddFlow, Grill me): sent once the chat
  // has opened, into the scope's thread.
  const [handedAsk, setHandedAsk] = useState<string | null>(null);
  const askIntoOngoing = useRef(false);

  // On open: the chat asked for, else the scope's continuing thread (a task's
  // or project's one chat, or a general chat used in the last two hours).
  // A handed-over general question starts a fresh chat, as before.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let id = openId;
      if (!id && !(scope.type === "general" && askOnOpen)) {
        const q =
          scope.type === "task"
            ? `scope=task&taskId=${encodeURIComponent(scope.taskId)}`
            : scope.type === "project"
              ? `scope=project&projectId=${encodeURIComponent(scope.projectId)}`
              : "scope=general";
        try {
          const res = await fetch(`/api/sessions?${q}`, { cache: "no-store" });
          const data = (await res.json()) as { ok?: boolean; session?: ChatSession | null };
          id = data.ok ? data.session?.id ?? null : null;
        } catch {}
      }
      if (cancelled) return;
      if (id) await openSession(id);
      else void restoreDrafts();
      if (cancelled) return;
      setRestoring(false);
      if (askOnOpen) {
        askIntoOngoing.current = true;
        setHandedAsk(askOnOpen);
      }
    };
    setRestoring(true);
    void load();
    return () => {
      cancelled = true;
    };
    // Once per scope / chat opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, openId]);

  // The composer only renders once the chat has loaded; focus it then.
  useEffect(() => {
    if (!restoring) inputRef.current?.focus();
  }, [restoring]);

  /** Appends a message to the saved chat. Awaited so messages land in order;
   *  a failure is shown instead of silently leaving the chat unsaved. */
  const saveMessage = useCallback(async (sessionId: string | null, role: "user" | "assistant", content: string, refs: ChatMessageRefs = {}) => {
    if (!sessionId) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", sessionId, role, content, ...refs }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setSaveWarning("This chat couldn't be saved. Your calendar changes still went through.");
    }
  }, []);

  /** Tags the chat with the tasks/plan an action touched (its task color). */
  const linkAction = useCallback(
    async (sessionId: string | null, actionId: string | undefined) => {
      if (!sessionId || !actionId) return;
      try {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "link", sessionId, actionId }),
        });
      } catch {}
      void loadSessions();
    },
    [loadSessions]
  );

  const send = useCallback(async (
    text?: string,
    modeOverride?: ChatMode,
    // Follow-up to Tangent's questions: `request` is the original ask the
    // pipeline runs; `text` is what the thread shows for this turn.
    followUp?: { request: string; answers?: ClarifyAnswer[]; skipClarify?: boolean },
    // Master fix Phase 4 (Retry / Edit): the last turn this message replaces.
    opts?: { replace?: string }
  ) => {
    const userText = (text ?? input).trim();
    if (!userText || busy) return;
    const replace = opts?.replace ?? (editing && text === undefined && turns[turns.length - 1]?.id === editing ? editing : undefined);
    const replaced = replace ? turns.find((t) => t.id === replace) : undefined;
    // The chat without the replaced turn: what the model sees.
    const prior = replaced ? turns.filter((t) => t.id !== replace) : turns;
    // A question Tangent is waiting on (last turn only, until it expires):
    // this message answers it, typed or tapped, unless the server decides
    // it's a new request (app/api/chat).
    const lastTurn = prior[prior.length - 1];
    const waiting =
      lastTurn?.pendingQuestion && Date.parse(lastTurn.pendingQuestion.expiresAt) > Date.now() ? lastTurn.pendingQuestion : null;
    // One input, routed (lib/ask-route.ts): no Plan/Calendar switch to set.
    // A question is talked through; everything else acts. A long-range goal
    // goes to Tangents, a multi-week effort becomes a project.
    // Pipeline V2 (A4): after "Just talking" the plan is talked through until
    // the student asks to act (components/console/talking.ts).
    // A chat about one project or task stays on it: no Tangents, no new project.
    const talk = v2 && !followUp && !waiting && !attachment ? talkingRoute(prior, userText) : undefined;
    const route = followUp || waiting || talk ? "do" : routeAsk(userText);
    if (route === "goal" && !modeOverride && !attachment) {
      putNewPathTitle(userText);
      setInput("");
      router.push("/tangents?new=1");
      return;
    }
    const sendMode: ChatMode = modeOverride ?? (route === "question" ? "plan" : "calendar");
    setChatMode(sendMode);
    setErr(null);
    setBusy(true);
    setPendingRequest(userText);
    setInput("");
    setEditing(null);
    if (replace) setTurns((prev) => prev.filter((t) => t.id !== replace));

    let sessionId = activeSessionId;
    let isNewSession = false;
    if (!sessionId) {
      try {
        // A task or project has one thread: "open" finds it or starts it
        // (app/api/sessions). A general chat is new each time it's started.
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            scope.type === "general"
              ? { action: "create", title: fallbackTitle(userText) }
              : { action: "open", scope, title: fallbackTitle(userText) }
          ),
        });
        const data = (await res.json()) as { ok: boolean; session: ChatSession };
        if (data.ok) {
          sessionId = data.session.id;
          setActiveSessionId(sessionId);
          isNewSession = data.session.messages.length === 0;
          if (scope.type === "general") autoTitle(data.session.id, { text: userText });
        } else {
          throw new Error("create failed");
        }
      } catch {
        setSaveWarning("This chat couldn't be saved. Your calendar changes still went through.");
      }
    }

    // Retry / Edit: the saved chat drops the old exchange too (the server
    // keeps it when it changed the calendar).
    if (replaced && sessionId && !isNewSession) {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "drop_last", sessionId, content: replaced.request }),
      }).catch(() => {});
    }
    await saveMessage(sessionId, "user", userText);

    const history = prior.flatMap((t) => [
      { role: "user", content: t.request },
      { role: "assistant", content: t.response },
    ]);
    history.push({ role: "user", content: waiting ? userText : followUp?.request ?? userText });
    const source = dictated.current ? "voice" : "typed";
    dictated.current = false;
    const tapped = tappedPick.current && !!waiting;
    tappedPick.current = false;
    // Answered or dropped either way: only the newest reply can carry one.
    if (waiting) setTurns((prev) => prev.map((t) => (t.pendingQuestion ? { ...t, pendingQuestion: null } : t)));

    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = "";
    try {
      const res = await fetch("/api/chat", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          mode: sendMode,
          stream: true,
          // Big or vague asks get questions first; never on a follow-up.
          clarify: !followUp,
          answers: followUp?.answers ?? (tapped ? [{ id: PENDING_QUESTION_ID, question: "", answer: userText }] : undefined),
          pendingQuestion: waiting ?? undefined,
          source,
          route: talk,
          // Flag on, a big ask is drafted by the intake (preview first) instead.
          newProject: route === "project" && !v2 && !attachment ? true : undefined,
          projectId: attachment?.kind === "project" ? attachment.id : undefined,
          taskId: attachment?.kind === "task" ? attachment.id : undefined,
          // The thread's running summary rides along (app/api/chat).
          sessionId: sessionId ?? undefined,
        }),
      });
      // Calendar mode streams NDJSON: plan progress lines, then {type:"result"}.
      const data = (await readChatReply(res, (line) => {
        // Master fix Phase 4: a talking reply streams in as it is written.
        if (line.type === "reply_text" && typeof line.text === "string") {
          streamed = line.text;
          setStreamText(line.text);
          return;
        }
        setPlanProgress((v) => applyPlanProgress(v, line));
      })) as {
        ok?: boolean;
        message?: string;
        reply?: string;
        response?: string;
        text?: string;
        error?: string;
        action?: string | null;
        voiceAction?: string | null;
        actionId?: string;
        plan?: { id: string; title: string; taskCount: number; color: string } | null;
        recurringCount?: number;
        sourcesChecked?: string[];
        pending?: { id: string; kind: string; message: string };
        changeSet?: ChangeSet;
        preview?: PreviewPayload;
        questions?: Turn["questions"];
        pendingQuestion?: Turn["pendingQuestion"];
        suggestion?: Turn["suggestion"];
        taskId?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

      if (data.action === "clarify" && data.questions?.length) {
        const ask = data.message ?? "A few quick questions so this fits you.";
        setTurns((prev) => [
          ...prev.map((t) => (t.fresh ? { ...t, fresh: false } : t)),
          {
            id: crypto.randomUUID(),
            fresh: true,
            request: userText,
            tools: [],
            sourcesChecked: [],
            response: ask,
            questions: data.questions,
            pendingQuestion: data.pendingQuestion ?? null,
          },
        ]);
        // Master fix B3: saved as the card itself, so a reopened chat shows it again.
        await saveMessage(sessionId, "assistant", withCard(ask, { questions: data.questions, pendingQuestion: data.pendingQuestion ?? null }));
        return;
      }

      // Pipeline V2: the router heard a long-range goal; it opens in Tangents
      // like routeAsk's "goal" above.
      if (data.action === "route_tangent") {
        putNewPathTitle(userText);
        router.push("/tangents?new=1");
        return;
      }

      if (data.action === "confirm_required" && data.pending) {
        const pendingId = data.pending.id;
        const pendingMessage = data.pending.message;
        setTurns((prev) => [
          ...prev.map((t) => (t.fresh ? { ...t, fresh: false } : t)),
          {
            id: crypto.randomUUID(),
            fresh: true,
            request: userText,
            tools: toolsForAction("confirm_required"),
            sourcesChecked: [],
            response: pendingMessage,
            pendingConfirm: { id: pendingId, message: pendingMessage },
          },
        ]);
        await saveMessage(sessionId, "assistant", pendingMessage);
        return;
      }

      const rawReply = data.message ?? data.reply ?? data.response ?? data.text ?? "";
      const reply = cleanMessage(typeof rawReply === "string" ? rawReply : "");
      const action = data.action ?? data.voiceAction;
      const notif = actionLabel(
        action,
        data.plan
          ? { taskCount: data.plan.taskCount, planTitle: data.plan.title }
          : data.recurringCount !== undefined
            ? { taskCount: data.recurringCount }
            : undefined
      );

      // "Add this plan" drafted the shown schedule: its chip is done.
      const addedShown = action === "preview" && isAddShownPlan(userText);
      setTurns((prev) => [
        ...prev.map((t) => {
          const seen = t.fresh ? { ...t, fresh: false } : t;
          return addedShown && seen.planReady ? { ...seen, planClosed: true, planDraft: false } : seen;
        }),
        {
          id: crypto.randomUUID(),
          fresh: true,
          // A reply that only asks a question isn't a plan to add yet.
          planDraft: isReadyReply(action, reply),
          // Pipeline V2: still talking it through; a finished schedule keeps
          // the "Add plan to calendar" chip until it is added or dismissed.
          talking: talk === "chat",
          planReady: v2 && isReadyReply(action, reply),
          request: userText,
          tools: toolsForAction(action),
          sourcesChecked: data.sourcesChecked ?? [],
          response: reply,
          actionId: data.actionId,
          actionLabel: notif ?? undefined,
          // Pipeline V2 (flag on only): nothing is saved until the card's Confirm.
          draft: action === "preview" && data.changeSet && data.preview ? { changeSet: data.changeSet, preview: data.preview } : undefined,
          suggestion: data.suggestion ?? null,
          projectId: data.plan?.id ?? null,
          // Streamed in already: no word-by-word reveal on top.
          streamed: streamed.length > 0,
          // "Which tasks should I remove?" with no buttons: typed answers only.
          pendingQuestion: data.pendingQuestion ?? null,
        },
      ]);

      await saveMessage(sessionId, "assistant", reply, { actionId: data.actionId, changeSetId: data.changeSet?.id });
      if (data.actionId) announceUndo({ actionId: data.actionId, label: notif ?? "Change applied", from: "/ai" });
      // Master fix Phase 4: a new project names the chat.
      if (sessionId && data.plan?.title) autoTitle(sessionId, { projectTitle: data.plan.title });
      // No preview card with Pipeline V2 off: its questions wait on Today.
      if (data.plan?.id) void seedGrill(data.plan.id, followUp?.request ?? userText, followUp?.answers?.length ?? 0);

      await linkAction(sessionId, data.actionId);
      await refresh();

      // Acted first; now Tangent's questions about what it saved. A follow-up
      // to questions was already grilled, so it isn't asked again.
      if (data.taskId && !followUp) {
        const savedTaskId = data.taskId;
        void generateQuestions(savedTaskId, userText).then((set) => {
          if (!set) return;
          setTurns((prev) =>
            prev.map((t) => (t.actionId === data.actionId ? { ...t, later: { id: set.id, questions: set.questions } } : t))
          );
        });
      }
    } catch (e) {
      // Stop: keep what had arrived and say it was stopped.
      if (controller.signal.aborted) {
        const partial = cleanMessage(streamed);
        const response = partial || "Stopped.";
        setTurns((prev) => [
          ...prev.map((t) => (t.fresh ? { ...t, fresh: false } : t)),
          { id: crypto.randomUUID(), request: userText, tools: [], sourcesChecked: [], response, streamed: true, stopped: true },
        ]);
        logChatEvent("chat_stopped", { partial: partial.length > 0 });
        await saveMessage(sessionId, "assistant", response);
        // The server may have finished a change before the stop reached it.
        void refresh();
        return;
      }
      const message = e instanceof Error ? e.message : "Error";
      setErr(message);
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          request: userText,
          tools: [],
          sourcesChecked: [],
          // Say what actually failed. This used to blame a missing API key for
          // every error, including the timeout that is the usual cause.
          response: describeFailure(message),
        },
      ]);
    } finally {
      setBusy(false);
      setPendingRequest(null);
      setPlanProgress(null);
      setStreamText("");
      abortRef.current = null;
      void loadSessions();
    }
  }, [input, busy, chatMode, activeSessionId, turns, refresh, linkAction, loadSessions, saveMessage, v2, editing, autoTitle, attachment, scope]);

  /** Esc closes the panel (Done) when nothing is in flight. */
  useEffect(() => {
    if (!onDone || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, busy]);

  /** Master fix Phase 4: Stop (the button, or Esc) ends the reply where it is. */
  const stop = useCallback(() => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stop]);

  /** Adds an action / change set id to an already-saved assistant message:
   *  matched by change set id, or by its text (`from`). Best effort. */
  const attachRefs = useCallback(
    (body: { actionId?: string; changeSetId?: string; from?: string }) => {
      if (!activeSessionId) return;
      void fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", sessionId: activeSessionId, ...body }),
      }).catch(() => {});
    },
    [activeSessionId]
  );

  /** Pipeline V2: a preview card was confirmed; keep its Undo after a reload
   *  and offer it app-wide (the card shows its own Undo here). */
  const cardConfirmed = useCallback(
    (turnId: string, changeSetId: string, actionId: string) => {
      attachRefs({ changeSetId, actionId });
      announceUndo({ actionId, label: "Change applied", from: "/ai" });
      // Master fix Phase 4: applied, so no Retry / Edit; a new project names the chat.
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, applied: true } : t)));
      const turn = turns.find((t) => t.id === turnId);
      const project = turn?.draft?.changeSet.ops.flatMap((op) => (op.op === "create_plan" ? [op.title] : []))[0];
      if (project && activeSessionId) autoTitle(activeSessionId, { projectTitle: project });
    },
    [attachRefs, turns, activeSessionId, autoTitle]
  );

  /** Turns whose "Add to calendar" draft is in flight (one request each). */
  const draftingPlans = useRef(new Set<string>());

  useEffect(() => {
    if (!handedAsk || busy) return;
    const into = askIntoOngoing.current;
    if (!into && (activeSessionId || turns.length > 0)) return;
    const text = handedAsk;
    askIntoOngoing.current = false;
    setHandedAsk(null);
    void send(text, into ? "calendar" : undefined);
  }, [handedAsk, activeSessionId, turns.length, busy, send]);

  /** Answers to a turn's questions (or "Just do it") run the original ask. */
  const answerQuestions = useCallback(
    (turnId: string, answers: ClarifyAnswer[] | null) => {
      const turn = turns.find((t) => t.id === turnId);
      if (!turn) return;
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, questions: null } : t)));
      // "Which one?" buttons: the tapped choice (or Cancel) is the next
      // message, and send() attaches the pending question.
      if (turn.pendingQuestion) {
        const picked = answers?.[0]?.answer ?? "Cancel";
        tappedPick.current = true;
        void send(picked, "calendar");
        return;
      }
      const shown = answers && answers.length > 0 ? answers.map((a) => a.answer).join(" · ") : "Just do it";
      void send(shown, "calendar", { request: turn.request, answers: answers ?? undefined, skipClarify: true });
    },
    [turns, send]
  );

  /** Plan-mode draft → Calendar: flip the mode and ask for it to be added. */
  const addPlanToCalendar = useCallback(
    (turnId: string) => {
      // Pipeline V2: draft the plan exactly as shown; saved only on Confirm.
      // The button stays until the draft exists, so a failure can be retried.
      const shown = turns.find((t) => t.id === turnId);
      if (v2 && shown) {
        if (draftingPlans.current.has(turnId)) return;
        draftingPlans.current.add(turnId);
        setErr(null);
        void draftShownPlan(shown.response, shown.request)
          .then((r) =>
            "error" in r
              ? setErr(r.error)
              : (setTurns((prev) =>
                  prev.map((t) => (t.id === turnId ? { ...t, planDraft: false, planClosed: true, draft: r } : t))
                ),
                attachRefs({ changeSetId: r.changeSet.id, from: shown.response }))
          )
          .finally(() => draftingPlans.current.delete(turnId));
        return;
      }
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, planDraft: false } : t)));
      changeMode("calendar");
      void send("Add this plan to my calendar", "calendar");
    },
    [changeMode, send, turns, v2, attachRefs]
  );

  /** Pipeline V2 "Just talking, don't add": answer the turn conversationally.
   *  The saved preview summary is replaced by the reply (not followed by a
   *  second assistant message), and sending waits until it is done, so a
   *  reload pairs every request with its own reply. */
  const justChatting = useCallback(
    async (turnId: string) => {
      if (busy) return;
      const at = turns.findIndex((t) => t.id === turnId);
      if (at < 0) return;
      setBusy(true);
      try {
        const history = turns.slice(0, at).flatMap((t) => [
          { role: "user", content: t.request },
          { role: "assistant", content: t.response },
        ]);
        const reply = cleanMessage(await chatOnly([...history, { role: "user", content: turns[at].request }]));
        const saved = turns[at].response;
        // A4: the conversation stays in talking until the student asks to act.
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, response: reply, draft: undefined, talking: true } : t)));
        if (!activeSessionId || !saved.trim()) return;
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "replace_last_assistant", sessionId: activeSessionId, from: saved, content: reply }),
        }).catch(() => null);
        const data = res?.ok ? ((await res.json().catch(() => ({}))) as { replaced?: boolean }) : {};
        if (!data.replaced) setSaveWarning("This reply couldn't be saved to the chat.");
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, activeSessionId]
  );

  /** Master fix Phase 4: hover actions on a reply. Retry and Edit are on the
   *  last turn only, and never on one that changed the calendar. */
  const retry = useCallback(
    (turnId: string) => {
      const turn = turns[turns.length - 1];
      if (busy || !turn || turn.id !== turnId || !redoable(turn)) return;
      logChatEvent("chat_retried");
      void send(turn.request, undefined, undefined, { replace: turnId });
    },
    [busy, turns, send]
  );

  const editLast = useCallback(
    (turnId: string) => {
      const turn = turns[turns.length - 1];
      if (busy || !turn || turn.id !== turnId || !redoable(turn)) return;
      logChatEvent("chat_edited");
      setEditing(turnId);
      setInput(turn.request);
      window.setTimeout(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 0);
    },
    [busy, turns]
  );

  const giveFeedback = useCallback(
    (turnId: string, value: "up" | "down") => {
      const turn = turns.find((t) => t.id === turnId);
      if (!turn) return;
      const next = turn.feedback === value ? undefined : value;
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, feedback: next } : t)));
      logChatEvent("chat_feedback", { value: next ?? "cleared", acted: !redoable(turn) });
    },
    [turns]
  );

  const resolveConfirm = useCallback(async (turnId: string, pendingId: string, confirm: boolean) => {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, pendingConfirm: null } : t)));
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingId, confirm }),
      });
      const data = (await res.json()) as { ok?: boolean; response?: string; error?: string; actionId?: string };
      const reply = !res.ok || !data.ok
        ? (data.error || "Something went wrong.")
        : (data.response || (confirm ? "Done." : "Cancelled."));

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                response: reply,
                actionId: confirm && data.ok ? data.actionId : undefined,
                actionLabel: confirm && data.ok && data.actionId ? "Change applied" : undefined,
              }
            : t
        )
      );

      const applied = confirm && data.ok ? data.actionId : undefined;
      await saveMessage(activeSessionId, "assistant", reply, { actionId: applied });
      if (applied) announceUndo({ actionId: applied, label: "Change applied", from: "/ai" });

      if (confirm && data.ok) await linkAction(activeSessionId, data.actionId);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, response: message } : t)));
    }
  }, [activeSessionId, refresh, linkAction, saveMessage]);

  const attachedChip = attachment && attachedTitle ? (
    <div className="tg-attached">
      <span className="tg-attached-label">About</span>
      <span className="tg-attached-title">{attachedTitle}</span>
    </div>
  ) : null;
  const starters = attachment ? (attachment.kind === "project" ? PROJECT_STARTERS : TASK_STARTERS) : null;

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={() => void send()}
      busy={busy}
      inputRef={inputRef}
      voiceStatus={voiceStatus}
      onVoiceStatus={setVoiceStatus}
      onTranscript={acceptTranscript}
      onVoiceError={setErr}
      mode={chatMode}
      placeholder={v2 ? "Ask, plan, or add something…" : undefined}
      onStop={stop}
    />
  );

  return (
    <div className={`tg-console is-${chatMode} chats-hidden`}>
      <section className="tg-main" aria-label={attachedTitle ? `Chat about ${attachedTitle}` : "Ask Tangent"}>
        <header className="tg-main-head">
          <div className="tg-head-title">
            <h1 className="tg-main-title">
              {scope.type === "general" ? "Ask Tangent" : attachedTitle ?? (scope.type === "task" ? "Task chat" : "Project chat")}
            </h1>
          </div>
          <div className="tg-head-actions">
            {v2 && (
              <Link href="/settings/activity" className="tg-icon-btn" aria-label="AI activity" title="AI activity">
                <Clock size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            )}
            <Link href="/ai" className="tg-icon-btn" aria-label="All chats" title="All chats">
              <Library size={17} strokeWidth={1.8} aria-hidden="true" />
            </Link>
            {onDone && (
              <button type="button" className="tg-btn tg-done" onClick={onDone}>
                Done
              </button>
            )}
          </div>
        </header>

        {restoring && turns.length === 0 ? (
          <div className="tg-hero">
            <p className="tg-hero-today" role="status">Loading your chat…</p>
          </div>
        ) : turns.length === 0 && !busy ? (
          <div className="tg-hero">
            <div className="tg-orb" aria-hidden="true">
              <PenMark size={26} />
            </div>
            {greeting && scope.type === "general" && <p className="tg-hero-greeting">{greeting}</p>}
            <h2 className="tg-hero-title">
              <span className="tg-hero-ask">{v2 ? "What do you need?" : "What can Tangent help with?"}</span>
            </h2>
            <p className="tg-hero-sub">Ask, add, or plan anything. You’ll always see what changes.</p>
            {scope.type === "general" && today?.next && (
              <Link href={`/calendar?date=${today.next.date}`} className="tg-next">
                <span className="tg-next-dot" aria-hidden="true" />
                <span className="tg-next-label">Next up</span>
                <span className="tg-next-title">{today.next.title}</span>
                <span className="tg-next-time">{formatTime12(today.next.time)}</span>
                {today.left > 1 && <span className="tg-next-more">+{today.left - 1} today</span>}
                <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" className="tg-next-go" />
              </Link>
            )}
            {err && <p className="tg-error" role="alert">{err}</p>}
            {attachedChip}
            {composer}
            <p className="ui-composer-hint">
              <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
            </p>
            <div className="tg-examples" aria-label="Try asking">
              {starters?.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="tg-example"
                  onClick={() => {
                    setInput(text);
                    inputRef.current?.focus();
                  }}
                >
                  <span className="tg-example-title">{text}</span>
                </button>
              ))}
              {!starters && suggestions.map(({ icon: Icon, text, detail }) => (
                <button
                  key={text}
                  type="button"
                  className="tg-example"
                  title={detail}
                  onClick={() => {
                    setInput(text);
                    inputRef.current?.focus();
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span className="tg-example-title">{text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ChatThread
              turns={turns}
              busy={busy}
              pendingRequest={pendingRequest}
              planProgress={planProgress}
              streamText={streamText}
              onRetry={retry}
              onEdit={editLast}
              onFeedback={giveFeedback}
              onConfirm={(turnId, pendingId, confirm) => void resolveConfirm(turnId, pendingId, confirm)}
              onUndone={() => void refresh()}
              mode={chatMode}
              onAddPlan={addPlanToCalendar}
              onJustChatting={v2 ? (id) => void justChatting(id) : undefined}
              onCardConfirmed={v2 ? cardConfirmed : undefined}
              onKeepTalking={(id) => {
                setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, planDraft: false } : t)));
                inputRef.current?.focus();
              }}
              onAnswer={answerQuestions}
              onScheduleChanged={() => void refresh()}
              onAnswerLater={(turnId, setId, answers) => {
                setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, later: null } : t)));
                if (!answers) return; // Later: it waits on Today.
                void answerLaterQuestions(setId, answers).then((r) => {
                  setTurns((prev) =>
                    prev.map((t) => (t.id === turnId ? { ...t, laterSummary: r.error ?? r.summary ?? "Saved." } : t))
                  );
                  void refresh();
                });
              }}
            />
            <div className="tg-dock">
              {v2 && plannable && !busy && (
                <div className="tg-plan-chip">
                  <button type="button" className="tg-btn tg-btn-accent" onClick={() => addPlanToCalendar(plannable.id)}>
                    <CalendarPlus size={14} strokeWidth={2} aria-hidden="true" />
                    Add plan to calendar
                  </button>
                  <button
                    type="button"
                    className="tg-btn"
                    aria-label="Dismiss the plan"
                    onClick={() => setTurns((prev) => prev.map((t) => (t.id === plannable.id ? { ...t, planDraft: false, planClosed: true } : t)))}
                  >
                    Not now
                  </button>
                </div>
              )}
              {newTopic && (
                <div className="tg-topic-chips" role="group" aria-label="This looks like a new topic">
                  <span>New topic?</span>
                  <button
                    type="button"
                    className="tg-btn tg-btn-accent"
                    onClick={() => {
                      const draft = input;
                      logChatEvent("chat_new_topic", { choice: "new" });
                      newChat();
                      setInput(draft);
                    }}
                  >
                    Start new chat
                  </button>
                  <button
                    type="button"
                    className="tg-btn"
                    onClick={() => {
                      setTopicSettledAt(turns.length);
                      logChatEvent("chat_new_topic", { choice: "keep" });
                    }}
                  >
                    Keep here
                  </button>
                </div>
              )}
              {editing && (
                <p className="tg-editing">
                  Editing your last message. Sending replaces it.
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setInput("");
                    }}
                  >
                    Cancel
                  </button>
                </p>
              )}
              {err && <p className="tg-error" role="alert">{err}</p>}
              {saveWarning && <p className="tg-error" role="alert">{saveWarning}</p>}
              {attachedChip}
              {composer}
              <p className="tg-dock-hint">
                {v2
                  ? "Ask a question, add something, or start a project. You’ll see a preview before anything is added."
                  : <>Think things through with Tangent here. Whatever you decide, it can add for you, and you&apos;ll always see what changed.</>}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
