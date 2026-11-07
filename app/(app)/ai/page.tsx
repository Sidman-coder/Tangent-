"use client";

// Chats: every task, project and general chat in one list, most recent first.
// Chatting happens where the chat is about (Home, a task, a project); this
// page finds and tidies them. Old /ai links are forwarded to their new home.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import PageHeader from "@/components/ui/PageHeader";
import { openTaskChat } from "@/components/chat/TaskChatSheet";
import { filterLibrary, libraryEntries, type LibraryEntry, type LibraryTab } from "@/lib/chat/library";
import { seriesColor } from "@/lib/task-colors";
import type { ChatSession } from "@/lib/types";
import "@/components/chat/chat-sheet.css";

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "general", label: "General" },
];

const SCOPE_LABEL: Record<LibraryEntry["scope"], string> = { general: "Ask Tangent", task: "Task", project: "Project" };

/** Where an old /ai link goes now, or null to stay on the library. */
function legacyTarget(search: string): string | null {
  const params = new URLSearchParams(search);
  const project = params.get("project");
  if (project) return `/projects/${encodeURIComponent(project)}?chat=1${params.get("ask") === "1" ? "&ask=1" : ""}`;
  const task = params.get("task");
  if (task) return `/?taskChat=${encodeURIComponent(task)}`;
  if (params.get("ask") === "1") return "/?ask=1";
  return null;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatLibraryPage() {
  const router = useRouter();
  const { state } = useAppState();
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("all");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const target = legacyTarget(window.location.search);
    if (target) router.replace(target);
  }, [router]);

  const load = useCallback(async () => {
    const res = await fetch("/api/sessions", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as { sessions?: ChatSession[] } | null) : null;
    if (!data?.sessions) {
      setFailed(true);
      setSessions((prev) => prev ?? []);
      return;
    }
    setFailed(false);
    setSessions(data.sessions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(
    () => (sessions ? libraryEntries(sessions, state?.tasks ?? [], state?.plans ?? []) : []),
    [sessions, state?.tasks, state?.plans]
  );
  const shown = useMemo(() => filterLibrary(entries, tab, query), [entries, tab, query]);

  const remove = async (id: string) => {
    setConfirmId(null);
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? prev);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", sessionId: id }),
    }).catch(() => null);
    if (!res?.ok) void load();
  };

  return (
    <div className="chat-library">
      <PageHeader title="Chats" description="Ask Tangent from Home, or tap Ask on a task or project. Every thread lands here." />

      <div className="chat-library-tools">
        <input
          name="chat-search"
          type="search"
          className="chat-library-search"
          placeholder="Search chats"
          aria-label="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chat-library-tabs" role="group" aria-label="Show">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="chat-library-tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {failed && <p className="chat-library-empty" role="status">Chats couldn&apos;t load. Try again in a moment.</p>}
      {sessions === null ? (
        <p className="chat-library-empty" role="status">Loading chats…</p>
      ) : shown.length === 0 && !failed ? (
        <p className="chat-library-empty">
          {entries.length === 0 ? "No chats yet. Ask Tangent anything from Home." : "Nothing matches."}
        </p>
      ) : (
        <ul className="chat-library-list">
          {shown.map((e) => {
            const inner = (
              <>
                <span className="chat-library-dot" style={{ background: seriesColor(e.color) }} aria-hidden="true" />
                <span className="chat-library-text">
                  <span className="chat-library-title">{e.title}</span>
                  <span className="chat-library-meta">
                    {SCOPE_LABEL[e.scope]}
                    {e.orphan ? " · deleted" : ""} · {when(e.updatedAt)}
                  </span>
                  {e.preview && <span className="chat-library-preview">{e.preview}</span>}
                </span>
              </>
            );
            return (
              <li key={e.id} className="chat-library-row">
                {e.href ? (
                  <Link className="chat-library-open" href={e.href}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="chat-library-open" onClick={() => e.taskId && openTaskChat(e.taskId)} aria-haspopup="dialog">
                    {inner}
                  </button>
                )}
                {confirmId === e.id ? (
                  <button type="button" className="chat-library-delete is-confirm" onClick={() => void remove(e.id)} aria-label={`Confirm delete ${e.title}`}>
                    Delete?
                  </button>
                ) : (
                  <button type="button" className="chat-library-delete" onClick={() => setConfirmId(e.id)} aria-label={`Delete chat ${e.title}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
