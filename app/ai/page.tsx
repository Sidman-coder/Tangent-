"use client";

import { useCallback, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import VoiceRecordButton from "@/components/VoiceRecordButton";
import ActionReceipt from "@/components/ActionReceipt";
import type { ChatSession } from "@/lib/store";
import { ArrowUp, Sparkles, CalendarDays, Mail, Zap } from "lucide-react";

const SUGGESTION_CHIPS = [
  { icon: Sparkles, text: "Plan my week" },
  { icon: CalendarDays, text: "What's today?" },
  { icon: Mail, text: "Summarize my email" },
  { icon: Zap, text: "Move overdue tasks" },
] as const;

type Turn = {
  id: string;
  request: string;
  tools: string[];
  response: string;
  actionId?: string;
  actionLabel?: string;
};

const LIVE_STEPS = ["Reading your request", "Checking your tasks", "Composing a response"] as const;

function cleanMessage(text: string): string {
  if (!text) return "Done! Your request has been processed.";
  let cleaned = text.replace(/```json[\s\S]*?```/gi, "").trim();
  cleaned = cleaned.replace(/```[\s\S]*?```/gi, "").trim();
  if (cleaned.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      if (typeof parsed.response === "string") return parsed.response;
      if (typeof parsed.reply === "string") return parsed.reply;
      if (typeof parsed.message === "string") return parsed.message;
      if (typeof parsed.planTitle === "string") return `Your ${parsed.planTitle} has been created!`;
    } catch {}
    return "Done! Your request has been processed.";
  }
  if (cleaned.includes('"action"') || cleaned.includes('"tasks"')) {
    return "Done! Your request has been processed.";
  }
  return cleaned || "Done! Your request has been processed.";
}

function actionLabel(action: string | null | undefined, extra?: Record<string, unknown>): string | null {
  if (!action) return null;
  if (action === "add_task") return "Task added to calendar";
  if (action === "complete_task") return "Task marked as complete";
  if (action === "delete_task") return "Task deleted";
  if (action === "add_recurring_task") {
    const count = typeof extra?.taskCount === "number" ? extra.taskCount : 0;
    return `Recurring task — ${count} instance${count !== 1 ? "s" : ""} added`;
  }
  if (action === "plan" || action === "create_plan") {
    const count = typeof extra?.taskCount === "number" ? extra.taskCount : 0;
    const title = typeof extra?.planTitle === "string" ? extra.planTitle : "Plan";
    return `${title} — ${count} task${count !== 1 ? "s" : ""} created`;
  }
  return null;
}

function toolsForAction(action: string | null | undefined): string[] {
  switch (action) {
    case "add_task":
      return ["Tasks"];
    case "complete_task":
      return ["Tasks"];
    case "delete_task":
      return ["Tasks"];
    case "add_recurring_task":
      return ["Tasks", "Recurring"];
    case "plan":
    case "create_plan":
      return ["Planner", "Tasks"];
    case "confirm_required":
      return ["Confirmation"];
    default:
      return ["Assistant"];
  }
}

export default function AiPage() {
  const { refresh } = useAppState();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"ask" | "do">("ask");

  const send = useCallback(async (text?: string) => {
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

    const history = turns
      .slice()
      .reverse()
      .flatMap((t) => [
        { role: "user", content: t.request },
        { role: "assistant", content: t.response },
      ]);
    history.push({ role: "user", content: userText });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
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
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

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
        {
          id: crypto.randomUUID(),
          request: userText,
          tools: toolsForAction(action),
          response: reply,
          actionId: data.actionId,
          actionLabel: notif ?? undefined,
        },
        ...prev,
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

      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setTurns((prev) => [
        {
          id: crypto.randomUUID(),
          request: userText,
          tools: [],
          response: "Something went wrong. Check that ANTHROPIC_API_KEY is set in .env.local.",
        },
        ...prev,
      ]);
    } finally {
      setBusy(false);
      setPendingRequest(null);
    }
  }, [input, busy, activeSessionId, turns, refresh]);

  return (
    <div className="console-page">
      <div className="console-hero">
        <h1 className="console-hero-heading font-display">What can I help with?</h1>

        <div className="console-header">
          <div className="console-input-group">
            <form
              className="console-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                className="console-pill-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === "ask" ? "What's on today?" : "Add a task, move something…"}
                aria-label="Command input"
                disabled={busy}
              />
              <button type="submit" className="console-send-pill neu-btn-primary" aria-label="Send" disabled={busy || !input.trim()}>
                <ArrowUp size={18} strokeWidth={1.75} />
              </button>
            </form>
            <div className="console-mode-row">
              <button
                type="button"
                className={`console-mode-pill${mode === "ask" ? " console-mode-pill--active" : ""}`}
                onClick={() => setMode("ask")}
              >
                Ask
              </button>
              <button
                type="button"
                className={`console-mode-pill${mode === "do" ? " console-mode-pill--active" : ""}`}
                onClick={() => setMode("do")}
              >
                Do
              </button>
            </div>
          </div>
          <VoiceRecordButton />
        </div>

        <div className="console-suggestions">
          {SUGGESTION_CHIPS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              type="button"
              className="console-suggestion-chip"
              onClick={() => setInput(text)}
            >
              <Icon size={16} strokeWidth={1.75} color="var(--accent)" />
              <span>{text}</span>
            </button>
          ))}
        </div>
      </div>

      {err && <p className="error-text">{err}</p>}

      <div className="console-feed">
        {busy && (
          <div className="card console-turn console-turn-pending">
            <div className="t-sm console-turn-request">{pendingRequest}</div>
            <ul className="console-steps" aria-live="polite">
              {LIVE_STEPS.map((step, i) => (
                <li key={step} className="console-step" style={{ animationDelay: `${i * 0.25}s` }}>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="card console-turn">
            <div className="t-sm console-turn-request">{t.request}</div>
            {t.tools.length > 0 && (
              <div className="console-turn-tools">
                {t.tools.map((tool) => (
                  <span key={tool} className="console-tool-chip">{tool}</span>
                ))}
              </div>
            )}
            <div className="t-body console-turn-response">{t.response}</div>
            {t.actionId && t.actionLabel && (
              <ActionReceipt actionId={t.actionId} label={t.actionLabel} onUndone={() => void refresh()} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
