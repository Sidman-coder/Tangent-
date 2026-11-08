"use client";

// Chats: every task, project and Home chat in one list, most recent first.
// Chatting happens where the chat is about (Home, a task, a project); this
// page finds and tidies them. Old /ai links are forwarded to their new home.
// Layout: docs/design/WIREFRAMES.md §4.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, MessagesSquare, Search, Trash2 } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Skeleton from "@/components/ui/Skeleton";
import { openTaskChat } from "@/components/chat/TaskChatSheet";
import { plainText } from "@/components/console/markdown-parse";
import { filterLibrary, libraryEntries, type LibraryEntry, type LibraryTab } from "@/lib/chat/library";
import { seriesColor } from "@/lib/task-colors";
import type { ChatSession } from "@/lib/types";
import "@/components/chat/chat-sheet.css";

const TABS: { value: LibraryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "general", label: "Home" },
  { value: "tasks", label: "Tasks" },
  { value: "projects", label: "Projects" },
];

const SCOPE_LABEL: Record<LibraryEntry["scope"], string> = { general: "Home chat", task: "Task chat", project: "Project chat" };
const EMPTY_TAB: Record<LibraryTab, string> = {
  all: "",
  general: "No Home chats yet.",
  tasks: "No task chats yet. Tap Ask on a task to start one.",
  projects: "No project chats yet. Open a project and tap Chat.",
};

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
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 12 * 60) return `${Math.floor(minutes / 60)}h`;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.ceil((start.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Home chats get the Home icon; project chats a dot and task chats a ring,
 *  in their color. */
function ScopeMark({ entry }: { entry: LibraryEntry }) {
  if (entry.scope === "general") return <Home size={15} strokeWidth={1.75} aria-hidden="true" />;
  return (
    <span
      className={`chat-library-dot${entry.scope === "task" ? " is-ring" : ""}`}
      style={{ "--chat-dot": seriesColor(entry.color) } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}

export default function ChatLibraryPage() {
  const router = useRouter();
  const { state } = useAppState();
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("all");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

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
  const inTab = useMemo(() => filterLibrary(entries, tab, ""), [entries, tab]);
  const shown = useMemo(() => filterLibrary(entries, tab, query), [entries, tab, query]);

  const remove = async (id: string) => {
    setDeletingId(id);
    setDeleteFailed(false);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", sessionId: id }),
    }).catch(() => null);
    setDeletingId(null);
    if (!res?.ok) {
      setDeleteFailed(true);
      return;
    }
    setConfirmId(null);
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? prev);
  };

  // Focus goes back to the row's trash button.
  const cancelDelete = () => {
    const id = confirmId;
    setConfirmId(null);
    setDeleteFailed(false);
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-chat-delete="${CSS.escape(id)}"]`)?.focus());
  };

  let body: React.ReactNode;
  if (sessions === null) {
    body = <Skeleton rows={4} label="Loading chats" className="chat-library-skeleton" />;
  } else if (failed && entries.length === 0) {
    body = (
      <EmptyState icon={<MessagesSquare size={20} strokeWidth={1.75} />} title="Chats couldn't load" action={<Button size="sm" onClick={() => void load()}>Try again</Button>}>
        Check your connection, then try again.
      </EmptyState>
    );
  } else if (entries.length === 0) {
    body = (
      <EmptyState icon={<MessagesSquare size={20} strokeWidth={1.75} />} title="No chats yet">
        Ask Tangent anything from Home.
      </EmptyState>
    );
  } else if (shown.length === 0) {
    body = query.trim() && inTab.length > 0 ? (
      <EmptyState
        icon={<Search size={20} strokeWidth={1.75} />}
        title={`No chats match “${query.trim()}”`}
        action={<Button size="sm" onClick={() => setQuery("")}>Clear search</Button>}
      />
    ) : (
      <EmptyState icon={<MessagesSquare size={20} strokeWidth={1.75} />} title={EMPTY_TAB[tab] || "No chats here yet."} />
    );
  } else {
    body = (
      <ul className="chat-library-list">
        {shown.map((e) => {
          const preview = e.preview ? plainText(e.preview).replace(/\s+/g, " ").trim() : "";
          const inner = (
            <>
              <span className="chat-library-mark">
                <ScopeMark entry={e} />
              </span>
              <span className="chat-library-title">
                <span className="ui-visually-hidden">{SCOPE_LABEL[e.scope]}: </span>
                {e.title}
              </span>
              <span className="chat-library-preview">
                {e.orphan && <span className="chat-library-flag">Deleted · </span>}
                {preview}
              </span>
              <time className="chat-library-when" dateTime={e.updatedAt}>
                {when(e.updatedAt)}
              </time>
            </>
          );
          return (
            <li key={e.id} className="chat-library-row">
              <div className="chat-library-item">
                {e.href ? (
                  <Link className="chat-library-open" href={e.href}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className="chat-library-open" onClick={() => e.taskId && openTaskChat(e.taskId)} aria-haspopup="dialog">
                    {inner}
                  </button>
                )}
                <IconButton
                  size="sm"
                  className="chat-library-delete"
                  label={`Delete chat: ${e.title}`}
                  tooltipSide="left"
                  icon={<Trash2 size={16} strokeWidth={1.75} />}
                  aria-expanded={confirmId === e.id}
                  data-chat-delete={e.id}
                  onClick={() => {
                    setDeleteFailed(false);
                    setConfirmId(confirmId === e.id ? null : e.id);
                  }}
                />
              </div>
              {confirmId === e.id && (
                <div className="chat-library-confirm">
                  <ConfirmPanel
                    title="Delete this chat?"
                    actionLabel="Delete"
                    busyLabel="Deleting…"
                    busy={deletingId === e.id}
                    onConfirm={() => void remove(e.id)}
                    onCancel={cancelDelete}
                  >
                    <p>The tasks and projects it added stay. The chat itself can&apos;t be brought back.</p>
                    {deleteFailed && (
                      <p role="alert" className="chat-library-error">
                        Couldn&apos;t delete the chat. Try again.
                      </p>
                    )}
                  </ConfirmPanel>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="chat-library">
      <header className="chat-library-head">
        <h1 className="page-header-title">Chats</h1>
        <label className="chat-library-search">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            name="chat-search"
            type="search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
          />
        </label>
      </header>

      <SegmentedTabs
        variant="underline"
        label="Show chats"
        idPrefix="chat-tabs"
        value={tab}
        onChange={(v) => {
          setTab(v);
          setConfirmId(null);
        }}
        options={TABS.map((t) => ({ ...t, controls: "chat-library-panel" }))}
        className="chat-library-tabs"
      />

      <div id="chat-library-panel" role="tabpanel" aria-labelledby={`chat-tabs-tab-${tab}`} className="chat-library-panel">
        {failed && entries.length > 0 && (
          <p className="chat-library-error" role="status">
            Couldn&apos;t refresh your chats. These may be out of date.
          </p>
        )}
        {body}
      </div>
    </div>
  );
}
