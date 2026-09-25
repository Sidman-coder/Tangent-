"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import ChatThread from "@/components/console/ChatThread";
import Composer from "@/components/console/Composer";
import {
  actionLabel,
  cleanMessage,
  toolsForAction,
  turnsFromMessages,
  type Turn,
} from "@/components/console/turns";
import {
  VOICE_TRANSCRIPT_EVENT,
  type VoiceCaptureStatus,
  type VoiceTranscriptDetail,
} from "@/hooks/useVoiceCapture";
import type { ChatSession } from "@/lib/store";
import type { BriefConfig, BriefSource } from "@/lib/types";
import type { SuggestedBriefSource } from "@/lib/brief-sources";
import { X } from "lucide-react";
import "./console.css";

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

const SUGGESTIONS = [
  "Plan my week",
  "What's on today?",
  "What fits in 30 minutes?",
  "Move overdue tasks",
] as const;

/** Persists the active chat session id across navigation/refresh within the same
 *  browser (not the server — the in-memory store still resets on server restart,
 *  in which case the GET below 404s and we fall back to starting fresh). */
const SESSION_STORAGE_KEY = "tangent:ai:activeSessionId";

export default function AiPage() {
  const { refresh } = useAppState();

  const [mode, setMode] = useState<ConsoleMode>("chat");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

    const history = turns.flatMap((t) => [
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
          ...prev,
          {
            id: crypto.randomUUID(),
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
        ...prev,
        {
          id: crypto.randomUUID(),
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
    />
  );

  return (
    <div className="tg-console">
      <section className="tg-main" aria-label="Tangent assistant">
        <header className="tg-main-head">
          <h1 className="tg-main-title">Tangent AI</h1>
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
        </header>

        {mode === "brief" ? (
          <div className="tg-brief-scroll">
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
          </div>
        ) : turns.length === 0 && !busy ? (
          <div className="tg-hero">
            <h2 className="tg-hero-title">What would you like to get done?</h2>
            {err && <p className="tg-error" role="alert">{err}</p>}
            {composer}
            <div className="tg-suggestions">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="tg-suggestion"
                  onClick={() => {
                    setInput(text);
                    inputRef.current?.focus();
                  }}
                >
                  {text}
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
            />
            <div className="tg-dock">
              {err && <p className="tg-error" role="alert">{err}</p>}
              {composer}
              <p className="tg-dock-hint">Tangent can change your tasks. You’ll always see what changed.</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
