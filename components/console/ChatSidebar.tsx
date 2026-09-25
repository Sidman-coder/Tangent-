"use client";

// Saved chats for the AI console, docked to the right of the conversation.
// Search, a Pinned section, and a per-chat menu (rename inline, highlight
// color, pin, delete) — the ChatGPT / Claude / Gemini sidebar feature set.
// A chat's color is the one the user picked, else the color of the task it
// created (thin left bar plus a swatch that opens the task's calendar).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, MoreHorizontal, PanelRightClose, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import type { ChatSession } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { resolveChatTask, type ChatTask } from "@/components/console/chatTask";
import TaskColorPopover from "@/components/console/TaskColorPopover";

/** Highlight colors — the app accent first, then calendar-friendly hues. */
export const CHAT_COLORS = [
  { hex: "#5b3df0", name: "Violet" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#0ea5a4", name: "Teal" },
  { hex: "#22a06b", name: "Green" },
  { hex: "#e5a50a", name: "Amber" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#e0567a", name: "Rose" },
  { hex: "#8a8f98", name: "Slate" },
] as const;

type Props = {
  sessions: ChatSession[];
  activeId: string | null;
  state: AppState | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onStyle: (id: string, style: { color?: string | null; pinned?: boolean }) => void;
  /** Hides the panel on wide screens so the conversation gets the full width. */
  onCollapse: () => void;
  /** Drawer state on narrow screens; the list is always shown on wide ones. */
  open: boolean;
  onClose: () => void;
};

type Row = { session: ChatSession; task: ChatTask | null };

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

const MENU_W = 216;

export default function ChatSidebar({
  sessions,
  activeId,
  state,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onStyle,
  onCollapse,
  open,
  onClose,
}: Props) {
  const [popover, setPopover] = useState<{ id: string; task: ChatTask; anchor: DOMRect } | null>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; confirmDelete: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Close the row menu on outside click, Escape, or scroll.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (menuRef.current?.contains(t) || t.closest(`[data-menu-for="${menu.id}"]`)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onScroll = () => setMenu(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
    };
  }, [menu]);

  const { pinned, recent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: Row[] = sessions
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.messages.some((m) => m.content.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((s) => ({ session: s, task: resolveChatTask(s, state) }));
    return { pinned: all.filter((r) => r.session.pinned), recent: all.filter((r) => !r.session.pinned) };
  }, [sessions, state, query]);

  const openMenu = (id: string, el: HTMLElement) => {
    if (menu?.id === id) return setMenu(null);
    const r = el.getBoundingClientRect();
    const estH = 236;
    const top = r.bottom + 4 + estH > window.innerHeight ? Math.max(8, r.top - estH - 4) : r.bottom + 4;
    const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8));
    setMenu({ id, top, left, confirmDelete: false });
  };

  const startRename = (s: ChatSession) => {
    setMenu(null);
    setEditingId(s.id);
    setDraft(s.title);
  };

  const commitRename = () => {
    const id = editingId;
    const title = draft.trim();
    setEditingId(null);
    if (!id || !title) return;
    const current = sessions.find((s) => s.id === id);
    if (current && current.title !== title) onRename(id, title);
  };

  const remove = (id: string) => {
    setMenu(null);
    setRemoving((prev) => new Set(prev).add(id));
    // Let the row collapse before it leaves the list.
    window.setTimeout(() => {
      onDelete(id);
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 240);
  };

  const menuSession = menu ? sessions.find((s) => s.id === menu.id) ?? null : null;

  const renderRow = ({ session, task }: Row, index: number) => {
    const color = session.color ?? task?.color ?? null;
    const isActive = session.id === activeId;
    const isEditing = editingId === session.id;
    return (
      <li
        key={session.id}
        className={[
          "tg-chat-row",
          isActive && "is-active",
          color && "has-color",
          session.color && "is-highlighted",
          removing.has(session.id) && "is-removing",
          menu?.id === session.id && "has-menu",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--chat-color": color ?? undefined, "--i": Math.min(index, 12) } as CSSProperties}
      >
        {isEditing ? (
          <form
            className="tg-chat-rename"
            onSubmit={(e) => {
              e.preventDefault();
              commitRename();
            }}
          >
            <input
              autoFocus
              value={draft}
              maxLength={80}
              aria-label="Chat name"
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingId(null);
                }
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            className="tg-chat-open"
            aria-current={isActive ? "true" : undefined}
            onClick={() => onSelect(session.id)}
            onDoubleClick={() => startRename(session)}
          >
            <span className="tg-chat-title">{session.title}</span>
            <span className="tg-chat-meta">
              {task ? `${task.name} · ` : ""}
              {whenLabel(session.updatedAt)}
            </span>
          </button>
        )}
        {!isEditing && task && (
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
        {!isEditing && (
          <button
            type="button"
            className="tg-chat-more"
            data-menu-for={session.id}
            aria-label={`Options for ${session.title}`}
            aria-haspopup="menu"
            aria-expanded={menu?.id === session.id}
            onClick={(e) => openMenu(session.id, e.currentTarget)}
          >
            <MoreHorizontal size={15} strokeWidth={2} />
          </button>
        )}
      </li>
    );
  };

  const empty = pinned.length === 0 && recent.length === 0;

  return (
    <>
      {open && <div className="tg-side-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`tg-side${open ? " is-open" : ""}`} aria-label="Chats">
        <div className="tg-side-head">
          <button type="button" className="tg-new-chat" onClick={onNew}>
            <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
            New chat
          </button>
          <button type="button" className="tg-icon-btn tg-side-collapse" aria-label="Hide chats" title="Hide chats" onClick={onCollapse}>
            <PanelRightClose size={16} strokeWidth={1.8} />
          </button>
          <button type="button" className="tg-icon-btn tg-side-close" aria-label="Close chats" onClick={onClose}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {sessions.length > 0 && (
          <label className="tg-side-search">
            <Search size={14} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="Search chats"
              aria-label="Search chats"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}

        {sessions.length === 0 ? (
          <div className="tg-side-empty">You haven’t started any chats yet.</div>
        ) : empty ? (
          <div className="tg-side-empty">No chats match “{query.trim()}”.</div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <div className="tg-side-label">
                  <Pin size={11} strokeWidth={2.2} aria-hidden="true" /> Pinned
                </div>
                <ul className="tg-chat-list">{pinned.map(renderRow)}</ul>
              </>
            )}
            {recent.length > 0 && (
              <>
                <div className="tg-side-label">Recent</div>
                <ul className="tg-chat-list">{recent.map((r, i) => renderRow(r, i + pinned.length))}</ul>
              </>
            )}
          </>
        )}

        {popover && (
          <TaskColorPopover task={popover.task} anchor={popover.anchor} onClose={() => setPopover(null)} />
        )}

        {menu && menuSession && (
          <div
            ref={menuRef}
            className="tg-menu"
            role="menu"
            aria-label={`Options for ${menuSession.title}`}
            style={{ top: menu.top, left: menu.left, width: MENU_W }}
          >
            {menu.confirmDelete ? (
              <div className="tg-menu-confirm">
                <p>
                  Delete “{menuSession.title}”? <span>This can’t be undone.</span>
                </p>
                <div>
                  <button type="button" className="tg-btn" onClick={() => setMenu({ ...menu, confirmDelete: false })}>
                    Cancel
                  </button>
                  <button type="button" className="tg-btn tg-btn-danger" onClick={() => remove(menuSession.id)} autoFocus>
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" role="menuitem" className="tg-menu-item" onClick={() => startRename(menuSession)}>
                  <Pencil size={14} strokeWidth={1.9} aria-hidden="true" /> Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="tg-menu-item"
                  onClick={() => {
                    onStyle(menuSession.id, { pinned: !menuSession.pinned });
                    setMenu(null);
                  }}
                >
                  {menuSession.pinned ? (
                    <PinOff size={14} strokeWidth={1.9} aria-hidden="true" />
                  ) : (
                    <Pin size={14} strokeWidth={1.9} aria-hidden="true" />
                  )}
                  {menuSession.pinned ? "Unpin" : "Pin to top"}
                </button>
                <div className="tg-menu-sep" role="separator" />
                <div className="tg-menu-label">Highlight</div>
                <div className="tg-menu-colors">
                  <button
                    type="button"
                    className={`tg-color-dot is-none${!menuSession.color ? " is-on" : ""}`}
                    aria-label="No highlight"
                    title="None — use the task color"
                    onClick={() => onStyle(menuSession.id, { color: null })}
                  >
                    <X size={11} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  {CHAT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`tg-color-dot${menuSession.color === c.hex ? " is-on" : ""}`}
                      style={{ "--dot": c.hex } as CSSProperties}
                      aria-label={`${c.name} highlight`}
                      aria-pressed={menuSession.color === c.hex}
                      title={c.name}
                      onClick={() => onStyle(menuSession.id, { color: c.hex })}
                    >
                      {menuSession.color === c.hex && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <div className="tg-menu-sep" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="tg-menu-item is-danger"
                  onClick={() => setMenu({ ...menu, confirmDelete: true })}
                >
                  <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
