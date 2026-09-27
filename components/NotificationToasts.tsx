"use client"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Sun, Lightbulb, AlertTriangle, Clock, Calendar, Bell, X, type LucideIcon } from "lucide-react"
import type { Notification } from "@/lib/types"
import { POPUP_AUTO_DISMISS_MS, type Toast } from "@/lib/notification-popups"

type Props = {
  toasts: Toast[]
  onDismiss: (key: string) => void
  onAction: (n: Notification) => void
  onOpenInbox: () => void
}

function iconFor(type: Notification["type"]): LucideIcon {
  switch (type) {
    case "daily_brief": return Sun
    case "proactive_suggestion": return Lightbulb
    case "overdue_task": return AlertTriangle
    case "upcoming_deadline": return Clock
    case "reschedule_offer": return Calendar
    default: return Bell
  }
}

/** In-app popups for new notifications: bottom-right on desktop, top on
 *  mobile. Each auto-dismisses after ~8 s unless hovered or focused; Escape
 *  (or the ✕) dismisses. Dismissing only hides the popup — the notification
 *  stays in the inbox. */
export default function NotificationToasts({ toasts, onDismiss, onAction, onOpenInbox }: Props) {
  // Portal to <body> so the header's stacking/containing context can't clip it.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="notif-toasts" role="region" aria-label="New notifications" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.key} toast={t} onDismiss={onDismiss} onAction={onAction} onOpenInbox={onOpenInbox} />
      ))}
    </div>,
    document.body
  )
}

function ToastCard({ toast, onDismiss, onAction, onOpenInbox }: { toast: Toast } & Omit<Props, "toasts">) {
  const paused = useRef(false)
  const remaining = useRef(POPUP_AUTO_DISMISS_MS)
  const startedAt = useRef(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = () => onDismiss(toast.key)

  const start = () => {
    if (timer.current) clearTimeout(timer.current)
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onDismiss(toast.key), remaining.current)
  }
  const pause = () => {
    if (paused.current) return
    paused.current = true
    if (timer.current) clearTimeout(timer.current)
    remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current))
  }
  const resume = (e: React.FocusEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    // Stay paused while the pointer is over the card or focus is inside it.
    const card = e.currentTarget
    if (e.type === "blur" && (card.contains(e.relatedTarget as Node | null) || card.matches(":hover"))) return
    if (e.type === "mouseleave" && card.contains(document.activeElement)) return
    if (!paused.current) return
    paused.current = false
    start()
  }

  useEffect(() => {
    start()
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.key])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      dismiss()
    }
  }

  if (toast.kind === "summary") {
    return (
      <div className="notif-toast surface-record" role="status" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume} onKeyDown={onKeyDown}>
        <div className="notif-item-icon"><Bell size={18} strokeWidth={1.75} /></div>
        <div className="notif-item-content">
          <div className="notif-item-title">{toast.count} new notifications</div>
          <button className="notif-item-action" onClick={() => { onOpenInbox(); dismiss() }}>View all</button>
        </div>
        <button className="notif-item-dismiss" onClick={dismiss} aria-label="Dismiss popup"><X size={14} strokeWidth={2} /></button>
      </div>
    )
  }

  const n = toast.notification
  const Icon = iconFor(n.type)
  const label = n.type === "reschedule_offer" ? n.actionLabel || "Reschedule" : "View"
  return (
    <div className={`notif-toast surface-record notif-item--${n.type}`} role="status" onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume} onKeyDown={onKeyDown}>
      <div className="notif-item-icon"><Icon size={18} strokeWidth={1.75} /></div>
      <div className="notif-item-content">
        <div className="notif-item-title">{n.title}</div>
        <div className="notif-item-body">{n.body}</div>
        <button
          className="notif-item-action"
          onClick={() => {
            if (n.type === "reschedule_offer") onAction(n)
            else onOpenInbox()
            dismiss()
          }}
        >
          {label}
        </button>
      </div>
      <button className="notif-item-dismiss" onClick={dismiss} aria-label="Dismiss popup"><X size={14} strokeWidth={2} /></button>
    </div>
  )
}
