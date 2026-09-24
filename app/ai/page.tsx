"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import VoiceRecordButton from "@/components/VoiceRecordButton";
import ActionReceipt from "@/components/ActionReceipt";
import PageHeader from "@/components/ui/PageHeader";
import type { ChatSession } from "@/lib/store";
import type { BriefConfig, BriefSource } from "@/lib/types";
import type { SuggestedBriefSource } from "@/lib/brief-sources";
import { ArrowUp, Sparkles, CalendarDays, Clock3, Zap, X } from "lucide-react";

type ConsoleMode = "chat" | "brief";

const MODE_LABEL: Record<ConsoleMode, string> = { chat: "Chat", brief: "Brief" };
const CADENCE_LABEL: Record<BriefConfig["cadence"], string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
};
const SOURCE_TYPE_LABEL: Record<BriefSource["type"], string> = {
  rss: "RSS feed",
  manual_url: "Website URL",
  stale_check: "Notice stale tasks",
};

const SUGGESTION_CHIPS = [
  { icon: Sparkles, text: "Plan my week" },
  { icon: CalendarDays, text: "What's today?" },
  { icon: Clock3, text: "What fits in 30 minutes?" },
  { icon: Zap, text: "Move overdue tasks" },
] as const;

type Turn = {
  id: string;
  request: string;
  tools: string[];
  sourcesChecked: string[];
  response: string;
  actionId?: string;
  actionLabel?: string;
  pendingConfirm?: { id: string; message: string } | null;
};

const LIVE_STEPS = ["Reading your request", "Checking your tasks", "Composing a response"] as const;

/** Persists the active chat session id across navigation/refresh within the same
 *  browser (not the server — the in-memory store still resets on server restart,
 *  in which case the GET below 404s and we fall back to starting fresh). */
const SESSION_STORAGE_KEY = "tangent:ai:activeSessionId";

/** Reconstructs the turn list (newest-first, matching the `turns` state convention)
 *  from a session's chronological [user, assistant, user, assistant, …] messages. */
function turnsFromMessages(messages: { role: "user" | "assistant"; content: string }[]): Turn[] {
  const result: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    const next = messages[i + 1];
    const response = next && next.role === "assistant" ? next.content : "";
    result.push({
      id: crypto.randomUUID(),
      request: messages[i].content,
      tools: [],
      sourcesChecked: [],
      response,
    });
    if (next && next.role === "assistant") i++;
  }
  return result.reverse();
}

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

  const [mode, setMode] = useState<ConsoleMode>("chat");
  const [briefSources, setBriefSources] = useState<BriefSource[]>([]);
  const [briefCadence, setBriefCadence] = useState<BriefConfig["cadence"]>("daily");
  const [briefTime, setBriefTime] = useState("07:00");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newSourceType, setNewSourceType] = useState<BriefSource["type"]>("rss");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [savingBrief, setSavingBrief] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedBriefSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    const storedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedId) return;
    fetch(`/api/sessions?sessionId=${encodeURIComponent(storedId)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; session?: ChatSession }) => {
        if (cancelled) return;
        if (data.ok && data.session) {
          setActiveSessionId(data.session.id);
          setTurns(turnsFromMessages(data.session.messages));
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/brief-config")
      .then((res) => res.json())
      .then((data: { ok?: boolean; config?: BriefConfig | null }) => {
        if (data.ok && data.config) {
          setBriefSources(data.config.sources ?? []);
          setBriefCadence(data.config.cadence ?? "daily");
          setBriefTime(data.config.deliveryTime ?? "07:00");
        }
      })
      .catch(() => {});
  }, []);

  const addBriefSource = useCallback(() => {
    const label = newSourceLabel.trim();
    if (!label) return;
    const source: BriefSource = {
      id: crypto.randomUUID(),
      type: newSourceType,
      label,
      ...(newSourceType !== "stale_check" && newSourceUrl.trim() ? { url: newSourceUrl.trim() } : {}),
    };
    setBriefSources((prev) => [...prev, source]);
    setNewSourceLabel("");
    setNewSourceUrl("");
    setNewSourceType("rss");
    setShowAddSource(false);
    setBriefSaved(false);
  }, [newSourceLabel, newSourceType, newSourceUrl]);

  const removeBriefSource = useCallback((id: string) => {
    setBriefSources((prev) => prev.filter((s) => s.id !== id));
    setBriefSaved(false);
  }, []);

  const findSources = useCallback(async () => {
    const query = findQuery.trim();
    if (!query || findLoading) return;
    setFindLoading(true);
    setFindError(null);
    try {
      const res = await fetch("/api/brief-sources/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.suggestions ?? []);
        if (!data.suggestions?.length) setFindError("No sources found — try a different topic.");
      } else {
        setFindError(data.error ?? "Couldn't find sources.");
      }
    } catch {
      setFindError("Couldn't find sources.");
    } finally {
      setFindLoading(false);
    }
  }, [findQuery, findLoading]);

  const confirmSuggestion = useCallback((suggestion: SuggestedBriefSource) => {
    const source: BriefSource = {
      id: crypto.randomUUID(),
      type: suggestion.type,
      label: suggestion.label,
      url: suggestion.url,
    };
    setBriefSources((prev) => [...prev, source]);
    setSuggestions((prev) => prev.filter((s) => s.url !== suggestion.url));
    setBriefSaved(false);
  }, []);

  const dismissSuggestion = useCallback((suggestion: SuggestedBriefSource) => {
    setSuggestions((prev) => prev.filter((s) => s.url !== suggestion.url));
  }, []);

  const saveBriefSettings = useCallback(async () => {
    setSavingBrief(true);
    setBriefSaved(false);
    try {
      const res = await fetch("/api/brief-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: briefSources, cadence: briefCadence, deliveryTime: briefTime }),
      });
      const data = await res.json();
      if (data.ok) setBriefSaved(true);
    } catch {
      // best-effort — settings stay in local state, user can retry Save
    } finally {
      setSavingBrief(false);
    }
  }, [briefSources, briefCadence, briefTime]);

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
        sourcesChecked?: string[];
        pending?: { id: string; kind: string; message: string };
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");

      if (data.action === "confirm_required" && data.pending) {
        const pendingId = data.pending.id;
        const pendingMessage = data.pending.message;
        setTurns((prev) => [
          {
            id: crypto.randomUUID(),
            request: userText,
            tools: toolsForAction("confirm_required"),
            sourcesChecked: [],
            response: pendingMessage,
            pendingConfirm: { id: pendingId, message: pendingMessage },
          },
          ...prev,
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
        {
          id: crypto.randomUUID(),
          request: userText,
          tools: toolsForAction(action),
          sourcesChecked: data.sourcesChecked ?? [],
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
          sourcesChecked: [],
          response: "Something went wrong. Check that ANTHROPIC_API_KEY is set in .env.local.",
        },
        ...prev,
      ]);
    } finally {
      setBusy(false);
      setPendingRequest(null);
    }
  }, [input, busy, activeSessionId, turns, refresh]);

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

      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, response: message } : t)));
    }
  }, [activeSessionId, refresh]);

  return (
    <div className="console-page">
      <PageHeader
        eyebrow="Assistant"
        title="Tangent AI"
        description="Plan your day, reorganize work, or ask about your schedule."
      />

      <div className="console-mode-row-wrap">
        <div className="console-mode-row" role="tablist" aria-label="Tangent AI mode">
          {(["chat", "brief"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`console-mode-pill${mode === m ? " console-mode-pill--active" : ""}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <section className="console-workspace" aria-label="Tangent assistant">
        {mode === "brief" ? (
          <div className="console-brief-setup">
            <div className="console-brief-sources">
              {briefSources.length === 0 && (
                <p className="console-brief-empty">No sources yet. Add one below.</p>
              )}
              {briefSources.map((source) => (
                <div key={source.id} className="card-sm console-brief-source-row">
                  <div className="console-brief-source-info">
                    <span className="console-brief-source-label">{source.label}</span>
                    <span className="console-brief-source-type">{SOURCE_TYPE_LABEL[source.type]}</span>
                  </div>
                  <button
                    type="button"
                    className="console-brief-remove"
                    aria-label={`Remove ${source.label}`}
                    onClick={() => removeBriefSource(source.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="card-sm console-brief-find">
              <label className="console-brief-field">
                <span>Find sources</span>
                <div className="console-brief-find-row">
                  <input
                    className="console-brief-text-input"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void findSources();
                      }
                    }}
                    placeholder="e.g. AI news, F1, climate policy"
                  />
                  <button
                    type="button"
                    className="console-chip"
                    onClick={() => void findSources()}
                    disabled={findLoading || !findQuery.trim()}
                  >
                    {findLoading ? "Finding…" : "Find sources"}
                  </button>
                </div>
              </label>
              {findError && <p className="console-brief-empty">{findError}</p>}
              {suggestions.map((s) => (
                <div key={s.url} className="card-sm console-brief-suggestion-row">
                  <div className="console-brief-source-info">
                    <span className="console-brief-source-label">{s.label}</span>
                    <span className="console-brief-source-type">
                      {s.type === "rss" ? "RSS feed" : "Website URL"} · {s.reason}
                    </span>
                  </div>
                  <div className="console-brief-actions">
                    <button type="button" className="console-chip" onClick={() => dismissSuggestion(s)}>
                      Skip
                    </button>
                    <button type="button" className="console-chip" onClick={() => confirmSuggestion(s)}>
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showAddSource ? (
              <div className="card-sm console-brief-add-form">
                <label className="console-brief-field">
                  <span>Label</span>
                  <input
                    className="console-brief-text-input"
                    value={newSourceLabel}
                    onChange={(e) => setNewSourceLabel(e.target.value)}
                    placeholder="Morning news"
                  />
                </label>
                <label className="console-brief-field">
                  <span>Type</span>
                  <select
                    className="console-brief-text-input"
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value as BriefSource["type"])}
                  >
                    <option value="rss">RSS feed</option>
                    <option value="manual_url">Website URL</option>
                    <option value="stale_check">Notice stale tasks</option>
                  </select>
                </label>
                {newSourceType !== "stale_check" && (
                  <label className="console-brief-field">
                    <span>URL</span>
                    <input
                      className="console-brief-text-input"
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </label>
                )}
                <div className="console-brief-actions">
                  <button type="button" className="console-chip" onClick={() => setShowAddSource(false)}>
                    Cancel
                  </button>
                  <button type="button" className="console-chip" onClick={addBriefSource} disabled={!newSourceLabel.trim()}>
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="console-chip console-brief-add-toggle"
                onClick={() => setShowAddSource(true)}
              >
                + Add source
              </button>
            )}

            <div className="console-brief-config-row">
              <span className="console-brief-config-label">Cadence</span>
              <div className="console-mode-row">
                {(["daily", "weekdays", "weekly"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`console-mode-pill${briefCadence === c ? " console-mode-pill--active" : ""}`}
                    onClick={() => {
                      setBriefCadence(c);
                      setBriefSaved(false);
                    }}
                  >
                    {CADENCE_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="console-brief-config-row">
              <span className="console-brief-config-label">Delivery time</span>
              <input
                type="time"
                className="console-brief-time-input"
                value={briefTime}
                onChange={(e) => {
                  setBriefTime(e.target.value);
                  setBriefSaved(false);
                }}
              />
            </div>

            <button
              type="button"
              className="neu-btn-primary console-brief-save"
              onClick={() => void saveBriefSettings()}
              disabled={savingBrief}
            >
              {savingBrief ? "Saving…" : briefSaved ? "Saved ✓" : "Save brief settings"}
            </button>
          </div>
        ) : (
          <>
        <div className="console-thread" aria-live="polite">
          {!busy && turns.length === 0 && (
            <div className="console-empty">
              <span className="console-empty-icon" aria-hidden="true"><Sparkles size={22} /></span>
              <h2>What would you like to get done?</h2>
              <p>Ask a question or describe a change. Tangent uses your live tasks and calendar.</p>
              <div className="console-suggestions">
                {SUGGESTION_CHIPS.map(({ icon: Icon, text }) => (
                  <button key={text} type="button" className="console-suggestion-chip" onClick={() => setInput(text)}>
                    <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {[...turns].reverse().map((t) => (
            <article key={t.id} className="console-turn">
              <div className="console-user-message">{t.request}</div>
              <div className="console-assistant-message">
                <span className="console-response-mark" aria-hidden="true"><Sparkles size={15} /></span>
                <div className="console-response-body">
                  {t.tools.length > 0 && (
                    <div className="console-turn-tools">
                      {t.tools.map((tool) => <span key={tool} className="console-tool-chip">{tool}</span>)}
                    </div>
                  )}
                  {t.sourcesChecked.length > 0 && (
                    <div className="console-turn-sources">
                      {t.sourcesChecked.map((source) => (
                        <span key={source} className="console-source-chip">Checked {source}</span>
                      ))}
                    </div>
                  )}
                  <div className="console-turn-response">{t.response}</div>
                  {t.pendingConfirm && (
                    <div className="confirm-toast-btns confirm-toast-btns--inline">
                      <button
                        type="button"
                        className="surface-action-primary"
                        onClick={() => void resolveConfirm(t.id, t.pendingConfirm!.id, true)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="surface-action-secondary"
                        onClick={() => void resolveConfirm(t.id, t.pendingConfirm!.id, false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {t.actionId && t.actionLabel && (
                    <ActionReceipt actionId={t.actionId} label={t.actionLabel} onUndone={() => void refresh()} />
                  )}
                </div>
              </div>
            </article>
          ))}

          {busy && (
            <article className="console-turn console-turn-pending">
              <div className="console-user-message">{pendingRequest}</div>
              <div className="console-assistant-message">
                <span className="console-response-mark is-working" aria-hidden="true"><Sparkles size={15} /></span>
                <ul className="console-steps">
                  {LIVE_STEPS.map((step, i) => (
                    <li key={step} className="console-step" style={{ animationDelay: `${i * 0.25}s` }}>{step}</li>
                  ))}
                </ul>
              </div>
            </article>
          )}
        </div>

        <div className="console-composer-wrap">
          {err && <p className="console-error" role="alert">{err}</p>}
          <form className="console-input-row" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input
              className="console-pill-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your schedule or make a change…"
              aria-label="Command input"
              disabled={busy}
            />
            <VoiceRecordButton />
            <button type="submit" className="console-send-pill" aria-label="Send" disabled={busy || !input.trim()}>
              <ArrowUp size={17} strokeWidth={2} />
            </button>
          </form>
          <span className="console-composer-hint">Tangent can make changes to your tasks. You’ll always see what changed.</span>
        </div>
          </>
        )}
      </section>
    </div>
  );
}
