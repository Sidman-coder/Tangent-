"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { Sun, Lightbulb, AlertTriangle, Clock, Calendar, Bell, X, type LucideIcon } from "lucide-react"
import { Notification } from "@/lib/types"
import { notifyNewDesktopNotifications } from "@/lib/desktop-notifications"
import { useAppState, useUserTimezone } from "@/components/AppStateProvider"
import { getUserToday } from "@/lib/time"
import { claimPopups, getInAppPopupsEnabled, planToasts, popupCandidates, type Toast } from "@/lib/notification-popups"
import NotificationToasts from "@/components/NotificationToasts"

type NotificationBellProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function NotificationBell({ open: openProp, onOpenChange }: NotificationBellProps = {}) {
  const tz = useUserTimezone()
  const email = useAppState().state?.user.email ?? ""
  const [toasts, setToasts] = useState<Toast[]>([])
  // Ids already asked about in this tab, so each poll only claims new ones.
  const askedRef = useRef<Set<string>>(new Set())
  const lastFetchRef = useRef(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === "function" ? (next as (prev: boolean) => boolean)(open) : next
    if (onOpenChange) onOpenChange(resolved)
    if (!isControlled) setUncontrolledOpen(resolved)
  }, [isControlled, onOpenChange, open])

  const fetchNotifications = useCallback(async () => {
    lastFetchRef.current = Date.now()
    try {
      const r = await fetch("/api/notifications")
      const data = await r.json()
      const list: Notification[] = data.notifications || []
      setNotifications(list)
      setUnreadCount(data.unreadCount || 0)
      // Desktop notifications piggyback on this same poll — no extra fetch.
      // See lib/desktop-notifications.ts for the opt-in + anti-spam rules.
      notifyNewDesktopNotifications(list)
    } catch {}
  }, [])

  // Poll every 60 seconds
  useEffect(() => {
    fetchNotifications()
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

  // Run proactive check on mount
  useEffect(() => {
    fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "page_load" })
    }).then(() => fetchNotifications()).catch(() => {})
  }, [fetchNotifications])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  const handleDismiss = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id })
    })
    fetchNotifications()
  }

  const handleMarkRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id })
    })
    fetchNotifications()
  }

  const handleGenerateSummary = async () => {
    setLoading(true)
    await fetch("/api/daily-brief", { method: "POST" })
    await fetchNotifications()
    setLoading(false)
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
    <div
      key={n.id}
      className={`notif-item surface-record ${!n.read ? 'notif-item--unread' : ''} notif-item--${n.type}${pinned ? ' notif-item--pinned-brief' : ''}`}
      onClick={() => handleMarkRead(n.id)}
    >
      <div className="notif-item-icon"><Icon size={18} strokeWidth={1.75} /></div>
      <div className="notif-item-content">
        <div className="notif-item-title">{n.title}</div>
        <div className="notif-item-body">{n.body}</div>
        {n.actionLabel && (
          <button
            className="notif-item-action"
            onClick={e => {
              e.stopPropagation()
              if (n.type === 'reschedule_offer') void handleReschedule(n)
            }}
          >
            {n.actionLabel}
          </button>
        )}
        <div className="notif-item-time">
          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <button
        className="notif-item-dismiss"
        onClick={e => { e.stopPropagation(); handleDismiss(n.id) }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
    )
  }

  const dismissToast = (key: string) => setToasts(current => current.filter(t => t.key !== key))

  return (
    <div className="notif-bell-wrapper">
      <NotificationToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onAction={n => void handleReschedule(n)}
        onOpenInbox={() => setOpen(true)}
      />
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div className="notif-overlay" onClick={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="notif-panel-header">
              <span className="notif-panel-title">Notifications</span>
              <div className="notif-panel-actions">
                {!pinnedBrief && (
                  <button
                    className="notif-summary-btn"
                    onClick={handleGenerateSummary}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : (<><Sun size={14} strokeWidth={2} /> Today's Summary</>)}
                  </button>
                )}
                <button
                  className="notif-dismiss-all"
                  onClick={async () => {
                    await fetch("/api/notifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "dismiss_all" })
                    })
                    fetchNotifications()
                    setOpen(false)
                  }}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="notif-list">
              {notifications.length === 0 && (
                <div className="notif-empty">
                  No notifications. TANGENT is watching your schedule.
                </div>
              )}
              {pinnedBrief && renderNotif(pinnedBrief, true)}
              {restNotifications.map(n => renderNotif(n))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
