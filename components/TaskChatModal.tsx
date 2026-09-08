"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { X } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string; timestamp: string };

export default function TaskChatModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load history on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/task-chat?taskId=${encodeURIComponent(task.id)}`);
        const data = (await res.json()) as { ok?: boolean; history?: ChatMsg[] };
        if (data.ok && Array.isArray(data.history)) {
          setMessages(data.history);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    })();
  }, [task.id]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text, timestamp: new Date().toISOString() }]);

    try {
      const res = await fetch("/api/task-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, message: text }),
      });
      const data = (await res.json()) as { ok?: boolean; reply?: string; message?: string; history?: ChatMsg[]; error?: string };
      if (data.ok && Array.isArray(data.history)) {
        setMessages(data.history);
      } else {
        const errMsg = data.error ?? "No response from AI. Please try again.";
        setMessages((m) => [...m, { role: "assistant", content: errMsg, timestamp: new Date().toISOString() }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error. Please check your connection and try again.", timestamp: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, task.id]);

  const priorityColor = task.priority === "high" ? "var(--red)" : task.priority === "low" ? "var(--green)" : "var(--amber)";

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal aria-label={`AI chat for ${task.title}`}>
      <div className="task-chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-chat-header">
          <div className="task-chat-title">
            <span className="priority-dot" style={{ background: priorityColor }} />
            <span>{task.title}</span>
          </div>
          <div className="task-chat-label">AI Task Assistant</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="task-chat-scroll" aria-live="polite">
          {loading && (
            <div className="task-chat-empty">Loading conversation…</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="task-chat-empty">
              Ask me anything about this task — steps, time estimates, tips, or how to approach it.
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="chat-row user-row">
                <div className="bubble user">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="chat-row assistant-row">
                <div className="tangent-avatar" aria-hidden>T</div>
                <div className="bubble assistant">{m.content}</div>
              </div>
            )
          )}
          {busy && (
            <div className="chat-row assistant-row">
              <div className="tangent-avatar" aria-hidden>T</div>
              <div className="bubble assistant chat-loading-bubble" aria-busy>
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          className="chat-form"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this task…"
            aria-label="Message to AI"
            disabled={busy}
          />
          <button type="submit" className="btn surface-action-primary" disabled={busy || !input.trim()}>
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
