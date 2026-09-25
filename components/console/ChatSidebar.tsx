"use client";

// Past chats for the AI console (v0 / Notion layout: New chat button, "Recent
// chats" label, dashed empty state). A chat that created or changed a task is
// tagged with that task's calendar color — a thin left bar plus a small swatch
// button that opens the task's color legend and session calendar.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import type { ChatSession } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { resolveChatTask, type ChatTask } from "@/components/console/chatTask";
import TaskColorPopover from "@/components/console/TaskColorPopover";

type Props = {
  sessions: ChatSession[];
  activeId: string | null;
  state: AppState | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Drawer state on narrow screens; the list is always shown on wide ones. */
  open: boolean;
  onClose: () => void;
};

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000
  );
  if (days <= 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatSidebar({ sessions, activeId, state, onSelect, onNew, open, onClose }: Props) {
  const [popover, setPopover] = useState<{ id: string; task: ChatTask; anchor: DOMRect } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = useMemo(
    () =>
      sessions
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((s) => ({ session: s, task: resolveChatTask(s, state) })),
    [sessions, state]
  );

  return (
    <>
      {open && <div className="tg-side-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`tg-side${open ? " is-open" : ""}`} aria-label="Chats">
        <button type="button" className="tg-new-chat" onClick={onNew}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          New chat
        </button>

        <div className="tg-side-label">Recent chats</div>

        {rows.length === 0 ? (
          <div className="tg-side-empty">You haven’t started any chats yet.</div>
        ) : (
          <ul className="tg-chat-list">
            {rows.map(({ session, task }) => (
              <li
                key={session.id}
                className={`tg-chat-row${session.id === activeId ? " is-active" : ""}${task ? " has-task" : ""}`}
                style={task ? ({ "--chat-color": task.color } as CSSProperties) : undefined}
              >
                <button
                  type="button"
                  className="tg-chat-open"
                  aria-current={session.id === activeId ? "true" : undefined}
                  onClick={() => onSelect(session.id)}
                >
                  <span className="tg-chat-title">{session.title}</span>
                  <span className="tg-chat-meta">
                    {task ? `${task.name} · ` : ""}
                    {whenLabel(session.updatedAt)}
                  </span>
                </button>
                {task && (
                  <button
                    type="button"
                    className="tg-chat-swatch"
                    aria-label={`Show ${task.name} on the calendar`}
                    aria-expanded={popover?.id === session.id}
                    onClick={(e) => {
                      const anchor = e.currentTarget.getBoundingClientRect();
                      setPopover((p) => (p?.id === session.id ? null : { id: session.id, task, anchor }));
                    }}
                  >
                    <span aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {popover && (
          <TaskColorPopover task={popover.task} anchor={popover.anchor} onClose={() => setPopover(null)} />
        )}
      </aside>
    </>
  );
}
