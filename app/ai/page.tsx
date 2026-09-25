"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import ChatSidebar from "@/components/console/ChatSidebar";
import ChatThread from "@/components/console/ChatThread";
import Composer from "@/components/console/Composer";
import {
  actionLabel,
  cleanMessage,
  toolsForAction,
  turnsFromMessages,
  type ChatMode,
  type Turn,
} from "@/components/console/turns";
import ModeSwitch from "@/components/console/ModeSwitch";
import {
  VOICE_TRANSCRIPT_EVENT,
  type VoiceCaptureStatus,
  type VoiceTranscriptDetail,
} from "@/hooks/useVoiceCapture";
import type { ChatSession } from "@/lib/store";
import { ArrowLeft, CalendarClock, CalendarRange, MessageSquare, Newspaper, PanelRightOpen, Sun, Timer } from "lucide-react";
import PenMark from "@/components/console/PenMark";
import BriefPanel, { CADENCE_LABEL, type BriefSummary } from "@/components/console/BriefPanel";
import { formatTime12, toYMD } from "@/lib/dates";
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

function greetingFor(hour: number, name: string): string {
  const part = hour >= 5 && hour < 12 ? "Morning" : hour >= 12 && hour < 17 ? "Afternoon" : "Evening";
  return name ? `${part}, ${name}.` : `Good ${part.toLowerCase()}.`;
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

  const [mode, setMode] = useState<ConsoleMode>("chat");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [brief, setBrief] = useState<BriefSummary | null>(null);
  const [greeting, setGreeting] = useState("");
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

  // "3 tasks left today · next: Chem review at 3:00 PM" under the greeting.
  const todayLine = useMemo(() => {
    if (!state) return "";
    const today = toYMD(new Date());
    const now = new Date().toTimeString().slice(0, 5);
    const open = state.tasks
      .filter((t) => t.date === today && !t.completed)
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    if (open.length === 0) return "Your calendar is clear today.";
    const next = open.find((t) => t.time && t.time >= now);
    const count = `${open.length} task${open.length === 1 ? "" : "s"} left today`;
    return next ? `${count} · next: ${next.title} at ${formatTime12(next.time)}` : count;
  }, [state]);

  useEffect(() => {
    const name = window.localStorage.getItem("tangent-user-name")?.trim().split(/\s+/)[0] ?? "";
    setGreeting(greetingFor(new Date().getHours(), name));
  }, []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
    } catch {}
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`);
      const data = (await res.json()) as { ok?: boolean; session?: ChatSession };
      if (data.ok && data.session) {
        setActiveSessionId(data.session.id);
        setTurns(turnsFromMessages(data.session.messages));
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
    setTurns([]);
    setInput("");
    setErr(null);
    setMode("chat");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [busy]);

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
    if (storedId) void openSession(storedId);
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
        }
      } catch {}
    }

    if (sessionId) {
      void fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", sessionId, role: "user", content: userText }),
      });
    }

    const history = turns.flatMap((t) => [
      { role: "user", content: t.request },
      { role: "assistant", content: t.response },
    ]);
    history.push({ role: "user", content: userText });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, mode: sendMode }),
      });
      const data = (await res.json()) as {
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
        if (sessionId) {
          void fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add_message", sessionId, role: "assistant", content: pendingMessage }),
          });
        }
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

      if (sessionId) {
        void fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_message", sessionId, role: "assistant", content: reply }),
        });
        if (isNewSession) {
          void fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename", sessionId, title: userText.slice(0, 45) }),
          });
        }
      }

      await linkAction(sessionId, data.actionId);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          request: userText,
          tools: [],
          sourcesChecked: [],
          response: "Something went wrong. Check that ANTHROPIC_API_KEY is set in .env.local.",
        },
      ]);
    } finally {
      setBusy(false);
      setPendingRequest(null);
      void loadSessions();
    }
  }, [input, busy, chatMode, activeSessionId, turns, refresh, linkAction, loadSessions]);

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

      if (activeSessionId) {
        void fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_message", sessionId: activeSessionId, role: "assistant", content: reply }),
        });
      }

      if (confirm && data.ok) await linkAction(activeSessionId, data.actionId);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, response: message } : t)));
    }
  }, [activeSessionId, refresh, linkAction]);

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
    <div className={`tg-console is-${chatMode}${chatsHidden ? " chats-hidden" : ""}`}>
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
              <span key={chatMode} className={`tg-mode-badge is-${chatMode}`}>
                {chatMode === "calendar" ? "Calendar mode" : "Plan mode"}
              </span>
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
            {chatsHidden && (
              <button
                type="button"
                className="tg-icon-btn tg-chats-show"
                aria-label="Show chats"
                title="Show chats"
                onClick={() => setHidden(false)}
              >
                <PanelRightOpen size={17} strokeWidth={1.8} />
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
        ) : turns.length === 0 && !busy ? (
          <div className="tg-hero">
            <PenMark className="tg-hero-mark" size={26} />
            <h2 className="tg-hero-title">
              <span className="tg-hero-hello">{greeting || " "}</span>
              <span key={chatMode} className="tg-hero-ask">
                {chatMode === "calendar" ? "What should go on your calendar?" : "What would you like to plan?"}
              </span>
            </h2>
            {todayLine && <p className="tg-hero-today">{todayLine}</p>}
            {err && <p className="tg-error" role="alert">{err}</p>}
            {composer}
            <p className="tg-examples-label">Try asking</p>
            <div className="tg-examples">
              {SUGGESTIONS.map(({ icon: Icon, text, detail }) => (
                <button
                  key={text}
                  type="button"
                  className="tg-example"
                  onClick={() => {
                    setInput(text);
                    inputRef.current?.focus();
                  }}
                >
                  <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                  <span className="tg-example-title">{text}</span>
                  <span className="tg-example-detail">{detail}</span>
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
              onConfirm={(turnId, pendingId, confirm) => void resolveConfirm(turnId, pendingId, confirm)}
              onUndone={() => void refresh()}
              mode={chatMode}
              onAddPlan={addPlanToCalendar}
            />
            <div className="tg-dock">
              {err && <p className="tg-error" role="alert">{err}</p>}
              {composer}
              <p className="tg-dock-hint">
                {chatMode === "calendar"
                  ? "Calendar mode adds and changes tasks. You’ll always see what changed."
                  : "Plan mode only drafts — switch to Calendar to add it."}
              </p>
            </div>
          </>
        )}
      </section>
      {(!chatsHidden || chatsOpen) && (
        <ChatSidebar
          sessions={sessions}
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
