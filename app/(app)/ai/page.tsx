"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { localNow } from "@/lib/time";
import ChatSidebar from "@/components/console/ChatSidebar";
import ChatThread from "@/components/console/ChatThread";
import Composer from "@/components/console/Composer";
import {
  actionLabel,
  applyPlanProgress,
  cleanMessage,
  readChatReply,
  toolsForAction,
  turnsFromMessages,
  type ChatMode,
  type PlanProgressView,
  type Turn,
} from "@/components/console/turns";
import ModeSwitch from "@/components/console/ModeSwitch";
import {
  VOICE_TRANSCRIPT_EVENT,
  type VoiceCaptureStatus,
  type VoiceTranscriptDetail,
} from "@/hooks/useVoiceCapture";
import type { ChatSession } from "@/lib/types";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  CalendarRange,
  Flag,
  Hammer,
  History,
  ListChecks,
  MessageSquare,
  Newspaper,
  Repeat,
  Sun,
  Timer,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import PenMark from "@/components/console/PenMark";
import BriefPanel, { CADENCE_LABEL, type BriefSummary } from "@/components/console/BriefPanel";
import { formatTime12 } from "@/lib/dates";
import { tracksCompletion } from "@/lib/urgency";
import { aiFirstSuggestion, prefsOf, type AiSuggestionKey } from "@/lib/personalize";
import "./console.css";

type ConsoleMode = "chat" | "brief";

function briefWhen(b: BriefSummary): string {
  return `${CADENCE_LABEL[b.cadence]} · ${formatTime12(b.deliveryTime)}`;
}

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
  return "Still going";
}

/** Turns a fetch/route failure into something true and actionable. */
function describeFailure(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("504") || lower.includes("aborted")) {
    return "That took too long and was cut off. Calendar mode does several rounds of research before it answers — try a narrower request, or ask again.";
  }
  if (lower.includes("anthropic_api_key") || lower.includes("401")) {
    return "The server has no Anthropic API key configured, so it can't reach Claude.";
  }
  if (lower.includes("429") || lower.includes("rate")) {
    return "Claude is rate-limited right now. Wait a moment and try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return `Something went wrong: ${message}`;
}

/** Persists the active chat session id across navigation/refresh within the same
 *  browser (not the server — the in-memory store still resets on server restart,
 *  in which case the GET below 404s and we fall back to starting fresh). */
const SESSION_STORAGE_KEY = "tangent:ai:activeSessionId";
const MODE_STORAGE_KEY = "tangent:ai:mode";
const CHATS_HIDDEN_KEY = "tangent:ai:chatsHidden";

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

export default function AiPage() {
  const { state, refresh } = useAppState();
  const workingToward = state?.user?.workingToward;
  const suggestions = useMemo(() => suggestionsFor(workingToward), [workingToward]);
  const tz = useUserTimezone();

  const [mode, setMode] = useState<ConsoleMode>("chat");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [brief, setBrief] = useState<BriefSummary | null>(null);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [chatsHidden, setChatsHidden] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("calendar");

  useEffect(() => {
    if (readStored(MODE_STORAGE_KEY) === "plan") setChatMode("plan");
    if (readStored(CHATS_HIDDEN_KEY) === "1") setChatsHidden(true);
  }, []);

  const changeMode = useCallback((next: ChatMode) => {
    setChatMode(next);
    writeStored(MODE_STORAGE_KEY, next);
  }, []);

  const setHidden = useCallback((hidden: boolean) => {
    setChatsHidden(hidden);
    writeStored(CHATS_HIDDEN_KEY, hidden ? "1" : null);
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
    setGreeting(`${partOfDay(localNow(tz).hour)}${firstName ? `, ${firstName}` : ""}`);
  }, [firstName, tz]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [planProgress, setPlanProgress] = useState<PlanProgressView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceCaptureStatus>("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Drops a voice transcript into the composer — visible, editable, cursor at
   *  the end — and stops there. The student presses Enter/Send to submit. */
  const acceptTranscript = useCallback((text: string) => {
    setMode("chat");
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


  useEffect(() => {
    fetch("/api/brief-config")
      .then((res) => res.json())
      .then((data: { ok?: boolean; config?: BriefSummary | null }) => {
        if (data.ok && data.config) {
          setBrief({ cadence: data.config.cadence ?? "daily", deliveryTime: data.config.deliveryTime ?? "07:00" });
        }
      })
      .catch(() => {});
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = (await res.json()) as { ok?: boolean; sessions?: ChatSession[] };
      if (data.ok) setSessions(data.sessions ?? []);
    } catch {
    } finally {
      setSessionsLoaded(true);
    }
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
        setTurns(turnsFromMessages(data.session.messages, confirms));
        setMode("chat");
        setErr(null);
        window.localStorage.setItem(SESSION_STORAGE_KEY, data.session.id);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const newChat = useCallback(() => {
    if (busy) return;
    setActiveSessionId(null);
    setSaveWarning(null);
    setTurns([]);
    setInput("");
    setErr(null);
    setMode("chat");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [busy]);

  /** Appends a message to the saved chat. Awaited so messages land in order;
   *  a failure is shown instead of silently leaving the chat unsaved. */
  const saveMessage = useCallback(async (sessionId: string | null, role: "user" | "assistant", content: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", sessionId, role, content }),
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

  useEffect(() => {
    void loadSessions();
    const storedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedId) {
      setRestoring(true);
      void openSession(storedId).finally(() => setRestoring(false));
    }
  }, [loadSessions, openSession]);


  const send = useCallback(async (text?: string, modeOverride?: ChatMode) => {
    const sendMode = modeOverride ?? chatMode;
    const userText = (text ?? input).trim();
    if (!userText || busy) return;
    setErr(null);
    setBusy(true);
    setPendingRequest(userText);
    setInput("");

    let sessionId = activeSessionId;
    let isNewSession = false;
    if (!sessionId) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", title: userText.slice(0, 40) }),
        });
        const data = (await res.json()) as { ok: boolean; session: ChatSession };
        if (data.ok) {
          sessionId = data.session.id;
          setActiveSessionId(sessionId);
          window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
          isNewSession = true;
          void loadSessions();
        } else {
          throw new Error("create failed");
        }
      } catch {
        setSaveWarning("This chat couldn't be saved. Your calendar changes still went through.");
      }
    }

    await saveMessage(sessionId, "user", userText);

    const history = turns.flatMap((t) => [
      { role: "user", content: t.request },
      { role: "assistant", content: t.response },
    ]);
    history.push({ role: "user", content: userText });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, mode: sendMode, stream: true }),
      });
      // Calendar mode streams NDJSON: plan progress lines, then {type:"result"}.
      const data = (await readChatReply(res, (line) => setPlanProgress((v) => applyPlanProgress(v, line)))) as {
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
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

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

      setTurns((prev) => [
        ...prev.map((t) => (t.fresh ? { ...t, fresh: false } : t)),
        {
          id: crypto.randomUUID(),
          fresh: true,
          planDraft: action === "plan_reply",
          request: userText,
          tools: toolsForAction(action),
          sourcesChecked: data.sourcesChecked ?? [],
          response: reply,
          actionId: data.actionId,
          actionLabel: notif ?? undefined,
        },
      ]);

      await saveMessage(sessionId, "assistant", reply);
      if (sessionId && isNewSession) {
        void fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", sessionId, title: userText.slice(0, 45) }),
        });
      }

      await linkAction(sessionId, data.actionId);
      await refresh();
    } catch (e) {
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
      void loadSessions();
    }
  }, [input, busy, chatMode, activeSessionId, turns, refresh, linkAction, loadSessions, saveMessage]);

  /** Plan-mode draft → Calendar: flip the mode and ask for it to be added. */
  const addPlanToCalendar = useCallback(
    (turnId: string) => {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, planDraft: false } : t)));
      changeMode("calendar");
      void send("Add this plan to my calendar", "calendar");
    },
    [changeMode, send]
  );

  const postSession = useCallback(async (body: Record<string, unknown>) => {
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {}
  }, []);

  const renameChat = useCallback(
    async (id: string, title: string) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
      await postSession({ action: "rename", sessionId: id, title });
      void loadSessions();
    },
    [postSession, loadSessions]
  );

  const styleChat = useCallback(
    async (id: string, style: { color?: string | null; pinned?: boolean }) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...style } : s)));
      await postSession({ action: "style", sessionId: id, ...style });
      void loadSessions();
    },
    [postSession, loadSessions]
  );

  const deleteChat = useCallback(
    async (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === activeSessionId) newChat();
      await postSession({ action: "delete", sessionId: id });
      void loadSessions();
    },
    [activeSessionId, newChat, postSession, loadSessions]
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

      await saveMessage(activeSessionId, "assistant", reply);

      if (confirm && data.ok) await linkAction(activeSessionId, data.actionId);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, response: message } : t)));
    }
  }, [activeSessionId, refresh, linkAction, saveMessage]);

  // An empty history panel is a quarter of the screen saying "nothing here",
  // so it only appears once there is a chat to go back to.
  const sidebarHidden = chatsHidden || sessions.length === 0;

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
      toolbar={<ModeSwitch mode={chatMode} onChange={changeMode} disabled={busy} />}
    />
  );

  return (
    <div className={`tg-console is-${chatMode}${sidebarHidden ? " chats-hidden" : ""}`}>
      <section className="tg-main" aria-label="Tangent assistant">
        <header className="tg-main-head">
          {mode === "brief" ? (
            <div className="tg-head-title">
              <button type="button" className="tg-back" onClick={() => setMode("chat")}>
                <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
                Chat
              </button>
              <h1 className="tg-main-title">Your Brief</h1>
            </div>
          ) : (
            <div className="tg-head-title">
              <h1 className="tg-main-title">Tangent AI</h1>
            </div>
          )}
          <div className="tg-head-actions">
            {mode === "chat" && (
              <button
                type="button"
                className="tg-brief-pill"
                onClick={() => setMode("brief")}
                aria-label={brief ? `Your Brief, ${briefWhen(brief)}. Open brief settings` : "Set up your brief"}
              >
                <Newspaper size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>Your Brief</span>
                <span className="tg-brief-pill-when">{brief ? briefWhen(brief) : "Set up"}</span>
              </button>
            )}
            {sidebarHidden && sessions.length > 0 && (
              <button
                type="button"
                className="tg-icon-btn tg-chats-show"
                aria-label="Show chats"
                title="Show chats"
                onClick={() => setHidden(false)}
              >
                <History size={17} strokeWidth={1.8} />
              </button>
            )}
            <button
              type="button"
              className="tg-icon-btn tg-chats-toggle"
              aria-label="Show chats"
              aria-expanded={chatsOpen}
              onClick={() => setChatsOpen(true)}
            >
              <MessageSquare size={17} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        {mode === "brief" ? (
          <div className="tg-brief-scroll">
            <BriefPanel onSaved={setBrief} />
          </div>
        ) : restoring && turns.length === 0 ? (
          <div className="tg-hero">
            <p className="tg-hero-today" role="status">Loading your chat…</p>
          </div>
        ) : turns.length === 0 && !busy ? (
          <div className="tg-hero">
            <div className="tg-orb" aria-hidden="true">
              <PenMark size={26} />
            </div>
            {greeting && <p className="tg-hero-greeting">{greeting}</p>}
            <h2 className="tg-hero-title">
              <span key={chatMode} className="tg-hero-ask">
                {chatMode === "calendar" ? "What should go on your calendar?" : "What would you like to plan?"}
              </span>
            </h2>
            {today && (
              today.next ? (
                <Link href={`/calendar?date=${today.next.date}`} className="tg-next">
                  <span className="tg-next-dot" aria-hidden="true" />
                  <span className="tg-next-label">Next up</span>
                  <span className="tg-next-title">{today.next.title}</span>
                  <span className="tg-next-time">{formatTime12(today.next.time)}</span>
                  {today.left > 1 && <span className="tg-next-more">+{today.left - 1} today</span>}
                  <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" className="tg-next-go" />
                </Link>
              ) : (
                <p className="tg-next is-clear">
                  <span className="tg-next-dot" aria-hidden="true" />
                  {today.left > 0
                    ? `${today.left} task${today.left === 1 ? "" : "s"} left today, nothing else timed`
                    : "Your calendar is clear today"}
                </p>
              )
            )}
            {err && <p className="tg-error" role="alert">{err}</p>}
            <div className="tg-composer-glow">{composer}</div>
            <p className="tg-composer-hint">
              <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
            </p>
            <div className="tg-examples" aria-label="Try asking">
              {suggestions.map(({ icon: Icon, text, detail }) => (
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
              onConfirm={(turnId, pendingId, confirm) => void resolveConfirm(turnId, pendingId, confirm)}
              onUndone={() => void refresh()}
              mode={chatMode}
              onAddPlan={addPlanToCalendar}
            />
            <div className="tg-dock">
              {err && <p className="tg-error" role="alert">{err}</p>}
              {saveWarning && <p className="tg-error" role="alert">{saveWarning}</p>}
              <div className="tg-composer-glow">{composer}</div>
              <p className="tg-dock-hint">
                {chatMode === "calendar"
                  ? "Calendar mode adds and changes tasks. You’ll always see what changed."
                  : "Plan mode only drafts — switch to Calendar to add it."}
              </p>
            </div>
          </>
        )}
      </section>
      {(!sidebarHidden || chatsOpen) && (
        <ChatSidebar
          sessions={sessions}
          loading={!sessionsLoaded}
          activeId={activeSessionId}
          state={state}
          open={chatsOpen}
          onClose={() => setChatsOpen(false)}
          onSelect={(id) => {
            setChatsOpen(false);
            void openSession(id);
          }}
          onNew={() => {
            setChatsOpen(false);
            newChat();
          }}
          onRename={(id, title) => void renameChat(id, title)}
          onDelete={(id) => void deleteChat(id)}
          onStyle={(id, style) => void styleChat(id, style)}
          onCollapse={() => setHidden(true)}
        />
      )}
    </div>
  );
}
