"use client"
import { useState, useEffect, useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { PHONE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery"
import { duration, ease } from "@/lib/motion"
import { Sun, Lightbulb, AlertTriangle, Clock, Calendar, Bell, X, type LucideIcon } from "lucide-react"
import { Notification } from "@/lib/types"
import { notifyNewDesktopNotifications } from "@/lib/desktop-notifications"
import { useAppState, useUserTimezone } from "@/components/AppStateProvider"
import { getUserToday } from "@/lib/time"
import { useRouter } from "next/navigation"
import { QUESTIONS_EVENT } from "@/lib/questions-client"
import { claimPopups, getInAppPopupsEnabled, planToasts, popupCandidates, type Toast } from "@/lib/notification-popups"
import NotificationToasts from "@/components/NotificationToasts"
import Sheet from "@/components/ui/Sheet"
import Button from "@/components/ui/Button"
import EmptyState from "@/components/ui/EmptyState"
import { humanizeTimestamps } from "@/lib/humanize"
import { collapseDuplicates } from "@/lib/notification-dedupe"

type NotificationBellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The shell draws the bell buttons; it learns the unread count from here. */
  onUnreadChange?: (count: number) => void
}

/**
 * The one place notifications live: it polls, pops toasts and holds the inbox
 * sheet. The shell renders it once and draws NotificationBellButton wherever
 * the bell sits (sidebar on desktop, top bar on a phone).
 */
export default function NotificationBell({ open, onOpenChange, onUnreadChange }: NotificationBellProps) {
  const tz = useUserTimezone()
  const email = useAppState().state?.user.email ?? ""
  const [toasts, setToasts] = useState<Toast[]>([])
  // Ids already asked about in this tab, so each poll only claims new ones.
  const askedRef = useRef<Set<string>>(new Set())
  const lastFetchRef = useRef(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const router = useRouter()
  const setOpen = onOpenChange

  const fetchNotifications = useCallback(async () => {
    lastFetchRef.current = Date.now()
    try {
      const r = await fetch("/api/notifications")
      const data = await r.json()
      const raw: Notification[] = data.notifications || []
      // One per reminder: the reminder job can repeat itself (lib/notification-dedupe.ts).
      const list = collapseDuplicates(raw)
      setNotifications(list)
      // Desktop notifications piggyback on this same poll — no extra fetch.
      // See lib/desktop-notifications.ts for the opt-in + anti-spam rules.
      notifyNewDesktopNotifications(list)
    } catch {}
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  useEffect(() => {
    onUnreadChange?.(unreadCount)
  }, [onUnreadChange, unreadCount])

  // The proactive check runs once on load, then the list polls every minute.
  useEffect(() => {
    fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "page_load" })
    }).catch(() => {}).finally(() => void fetchNotifications())
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refetch as soon as the tab comes back (not a second loop — one fetch per
  // return, and never twice within 5 s since focus and visibility fire together).
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastFetchRef.current < 5000) return
      void fetchNotifications()
    }
    window.addEventListener("focus", onReturn)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      window.removeEventListener("focus", onReturn)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [fetchNotifications])

  // In-app popups for notifications that have never popped (see
  // lib/notification-popups.ts). Rides on the data the poll just fetched.
  useEffect(() => {
    if (!email) return
    const fresh = popupCandidates(notifications).filter(n => !askedRef.current.has(n.id))
    if (fresh.length === 0) return
    fresh.forEach(n => askedRef.current.add(n.id))
    const silent = open || !getInAppPopupsEnabled(email)
    void claimPopups(fresh.map(n => n.id), email, async (ids) => {
      const r = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_popups", ids })
      })
      if (!r.ok) throw new Error("claim failed")
      return r.json()
    }).then(claimed => {
      // Inbox open or popups off: claimed (so they never pop later) but not shown.
      if (silent || claimed.length === 0) return
      const ids = new Set(claimed)
      // Oldest first so the newest ends up at the bottom of the stack.
      const incoming = fresh.filter(n => ids.has(n.id)).reverse()
      setToasts(current => planToasts(current, incoming))
    }).catch(() => {
      // Try again on the next poll.
      fresh.forEach(n => askedRef.current.delete(n.id))
    })
  }, [notifications, email, open])

  // Opening the inbox clears popups; everything is in the list anyway.
  useEffect(() => {
    if (open) setToasts([])
  }, [open])

  const handleDismiss = async (id: string) => {
    // Its hidden copies go with it, so an older twin doesn't take its place.
    const twins = (notifications.find(n => n.id === id) as (Notification & { duplicateIds?: string[] }) | undefined)?.duplicateIds ?? []
    await Promise.all([id, ...twins].map(one => fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id: one })
    })))
    fetchNotifications()
  }

  const handleMarkRead = async (n: Notification) => {
    if (n.read) return
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id: n.id })
    })
    fetchNotifications()
  }

  const handleGenerateSummary = async () => {
    setLoading(true)
    try {
      await fetch("/api/daily-brief", { method: "POST" })
      await fetchNotifications()
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_all" })
      })
      await fetchNotifications()
      setOpen(false)
    } finally {
      setClearing(false)
    }
  }

  const handleReschedule = async (n: Notification) => {
    await fetch("/api/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n.actionData || {})
    })
    await handleDismiss(n.id)
  }

  const getIcon = (type: Notification['type']): LucideIcon => {
    switch (type) {
      case 'daily_brief': return Sun
      case 'proactive_suggestion': return Lightbulb
      case 'overdue_task': return AlertTriangle
      case 'upcoming_deadline': return Clock
      case 'reschedule_offer': return Calendar
      default: return Bell
    }
  }

  const today = getUserToday(tz)
  const pinnedBrief = notifications.find(n => n.type === 'daily_brief' && getUserToday(tz, new Date(n.timestamp)) === today)
  const restNotifications = notifications.filter(n => n !== pinnedBrief)

  const renderNotif = (n: Notification, pinned = false) => {
    const Icon = getIcon(n.type)
    return (
      <li
        key={n.id}
        className={`notif-item${!n.read ? ' is-unread' : ''}${pinned ? ' is-pinned' : ''}`}
        onClick={() => void handleMarkRead(n)}
      >
        <span className="notif-item-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
        <div className="notif-item-content">
          <p className="notif-item-title">
            {!n.read && <span className="ui-visually-hidden">Unread: </span>}
            {humanizeTimestamps(n.title)}
          </p>
          <p className="notif-item-body">{humanizeTimestamps(n.body)}</p>
          <div className="notif-item-meta">
            <time className="notif-item-time" dateTime={n.timestamp}>
              {new Date(n.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </time>
            {n.actionLabel && (
              <Button
                variant="secondary"
                size="sm"
                className="notif-item-action"
                onClick={e => {
                  e.stopPropagation()
                  if (n.type === 'reschedule_offer') void handleReschedule(n)
                  // Tangent's questions about a task are answered on Home.
                  if ((n.actionData as { kind?: string } | undefined)?.kind === 'questions') {
                    setOpen(false)
                    window.dispatchEvent(new Event(QUESTIONS_EVENT))
                    router.push('/#questions')
                  }
                }}
              >
                {n.actionLabel}
              </Button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="notif-item-dismiss"
          aria-label={`Dismiss ${humanizeTimestamps(n.title)}`}
          onClick={e => { e.stopPropagation(); void handleDismiss(n.id) }}
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </li>
    )
  }

  const dismissToast = (key: string) => setToasts(current => current.filter(t => t.key !== key))

  return (
    <>
      <NotificationToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onAction={n => void handleReschedule(n)}
        onOpenInbox={() => setOpen(true)}
      />
      <NotifSurface open={open} onClose={() => setOpen(false)}>
        <div className="notif-actions">
          {!pinnedBrief && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Sun size={16} strokeWidth={1.75} aria-hidden="true" />}
              loading={loading}
              loadingLabel="Writing today's summary"
              onClick={() => void handleGenerateSummary()}
            >
              Today&apos;s summary
            </Button>
          )}
          {notifications.length > 0 && (
            <Button size="sm" variant="ghost" loading={clearing} onClick={() => void handleClearAll()}>
              Clear all
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell strokeWidth={1.75} aria-hidden="true" />}
            title="Nothing new"
          >
            Tangent is keeping an eye on your week.
          </EmptyState>
        ) : (
          <ul className="notif-list">
            {pinnedBrief && renderNotif(pinnedBrief, true)}
            {restNotifications.map(n => renderNotif(n))}
          </ul>
        )}
      </NotifSurface>
    </>
  )
}

/**
 * Round 4 Phase 4: the inbox opens where the bell is. A popover anchored to
 * the bell on desktop (no sliding panel from the side), a bottom sheet on a
 * phone. Escape and a click outside close it; focus goes back to the bell.
 */
function NotifSurface({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isPhone = useMediaQuery(PHONE_QUERY, { sync: true })
  if (!mounted) return null
  if (isPhone) {
    return (
      <Sheet open={open} onClose={onClose} title="Notifications" className="notif-sheet">
        {children}
      </Sheet>
    )
  }
  return createPortal(
    <AnimatePresence>{open && <NotifPopover key="notif" onClose={onClose}>{children}</NotifPopover>}</AnimatePresence>,
    document.body,
  )
}

/** The bell that is on screen right now (sidebar on desktop, top bar on a phone). */
function visibleBell(): HTMLElement | null {
  const bells = Array.from(document.querySelectorAll<HTMLElement>("[data-notif-bell]"))
  return bells.find(b => b.getClientRects().length > 0) ?? null
}

const GAP = 10
const EDGE = 12

function NotifPopover({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" })
  const [origin, setOrigin] = useState("left bottom")
  // The parent passes a fresh onClose each render; the listeners below stay put.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Sit beside the bell: to its right when it is in the sidebar, under it when
  // it is in a top bar. Keep inside the window either way.
  useLayoutEffect(() => {
    openerRef.current = visibleBell()
    const place = () => {
      const bell = openerRef.current ?? visibleBell()
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (!bell) {
        setPos({ right: EDGE, top: EDGE })
        setOrigin("right top")
        return
      }
      const r = bell.getBoundingClientRect()
      if (r.left < vw / 2) {
        // Sidebar bell: open to its right. Low in the window, bottoms line up;
        // higher up, tops line up and the list scrolls inside what is left.
        const left = Math.min(r.right + GAP, vw - EDGE - 380)
        if (r.top > vh / 2) {
          setPos({ left, bottom: Math.max(EDGE, vh - r.bottom) })
          setOrigin("left bottom")
        } else {
          setPos({ left, top: Math.max(EDGE, r.top), maxHeight: Math.min(560, vh - Math.max(EDGE, r.top) - EDGE) })
          setOrigin("left top")
        }
      } else {
        setPos({ right: Math.max(EDGE, vw - r.right), top: r.bottom + GAP })
        setOrigin("right top")
      }
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [])

  useEffect(() => {
    const opener = openerRef.current
    const panel = panelRef.current
    panel?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onCloseRef.current()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel?.contains(t)) return
      // The bell toggles itself; don't close here and reopen there.
      if (t instanceof Element && t.closest("[data-notif-bell]")) return
      onCloseRef.current()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
      if (opener && document.activeElement && panel?.contains(document.activeElement)) opener.focus()
      else if (opener && document.activeElement === document.body) opener.focus()
    }
  }, [])

  return (
    <m.div
      ref={panelRef}
      className="notif-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby="notif-popover-title"
      tabIndex={-1}
      style={{ ...pos, transformOrigin: origin }}
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
      exit={{ opacity: 0, scale: 0.97, y: 4, transition: { duration: duration.fast, ease: ease.in } }}
    >
      <div className="notif-popover-head">
        <h2 id="notif-popover-title" className="notif-popover-title">Notifications</h2>
        <button type="button" className="notif-popover-close" aria-label="Close notifications" onClick={onClose}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="notif-popover-body">{children}</div>
    </m.div>
  )
}

/** The bell itself: a sidebar row on desktop, an icon in the phone top bar. */
export function NotificationBellButton({
  unread,
  expanded,
  onClick,
  variant,
}: {
  unread: number
  expanded: boolean
  onClick: () => void
  variant: "sidebar" | "top"
}) {
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
  if (variant === "top") {
    return (
      <button
        type="button"
        className="app-topbar-bell"
        data-notif-bell=""
        aria-label={label}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={onClick}
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && <span className="app-unread-dot" aria-hidden="true" />}
      </button>
    )
  }
  return (
    <button
      type="button"
      className="app-nav-item"
      data-notif-bell=""
      aria-label={label}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      data-tooltip="Notifications"
      data-tooltip-side="right"
      onClick={onClick}
    >
      <span className="app-nav-icon">
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && <span className="app-unread-dot" aria-hidden="true" />}
      </span>
      <span className="app-nav-label">Notifications</span>
      {unread > 0 && <span className="app-nav-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
  )
}
