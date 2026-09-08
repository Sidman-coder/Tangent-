"use client"
import { useState, useEffect, useCallback } from "react"
import { Sun, Lightbulb, AlertTriangle, Clock, Calendar, Bell, X, type LucideIcon } from "lucide-react"
import { Notification } from "@/lib/types"

type NotificationBellProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function NotificationBell({ open: openProp, onOpenChange }: NotificationBellProps = {}) {
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
    try {
      const r = await fetch("/api/notifications")
      const data = await r.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }, [])

  // Poll every 60 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Run proactive check on mount
  useEffect(() => {
    fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "page_load" })
    }).then(() => fetchNotifications()).catch(() => {})
  }, [fetchNotifications])

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

  const handleGenerateBrief = async () => {
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

  const today = new Date().toISOString().slice(0, 10)
  const pinnedBrief = notifications.find(n => n.type === 'daily_brief' && n.timestamp.slice(0, 10) === today)
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

  return (
    <div className="notif-bell-wrapper">
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
                    className="notif-brief-btn"
                    onClick={handleGenerateBrief}
                    disabled={loading}
                  >
                    {loading ? "Generating..." : (<><Sun size={14} strokeWidth={2} /> Daily Brief</>)}
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
