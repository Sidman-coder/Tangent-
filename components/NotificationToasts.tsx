"use client"
import { Sun, Lightbulb, AlertTriangle, Clock, Calendar, Bell, type LucideIcon } from "lucide-react"
import type { Notification } from "@/lib/types"
import { POPUP_AUTO_DISMISS_MS, type Toast as PopupToast } from "@/lib/notification-popups"
import { humanizeTimestamps } from "@/lib/humanize"
import Button from "@/components/ui/Button"
import Toast, { ToastPortal } from "@/components/ui/Toast"

type Props = {
  toasts: PopupToast[]
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

/** In-app popups for new notifications, in the shared toast region. Each
 *  auto-dismisses after ~8 s unless hovered or focused; Escape (or the ✕)
 *  dismisses. Dismissing only hides the popup — the notification stays in
 *  the inbox. */
export default function NotificationToasts({ toasts, onDismiss, onAction, onOpenInbox }: Props) {
  return (
    <ToastPortal>
      {toasts.map((t) => {
        const dismiss = () => onDismiss(t.key)
        if (t.kind === "summary") {
          return (
            <Toast
              key={t.key}
              tone="info"
              icon={<Bell strokeWidth={1.75} aria-hidden="true" />}
              title={`${t.count} new notifications`}
              duration={POPUP_AUTO_DISMISS_MS}
              onDismiss={dismiss}
              dismissLabel="Dismiss popup"
              action={
                <Button variant="secondary" size="sm" onClick={() => { onOpenInbox(); dismiss() }}>
                  View all
                </Button>
              }
            />
          )
        }
        const n = t.notification
        const Icon = iconFor(n.type)
        const label = n.type === "reschedule_offer" ? n.actionLabel || "Reschedule" : "View"
        return (
          <Toast
            key={t.key}
            tone="info"
            icon={<Icon strokeWidth={1.75} aria-hidden="true" />}
            title={humanizeTimestamps(n.title)}
            duration={POPUP_AUTO_DISMISS_MS}
            onDismiss={dismiss}
            dismissLabel="Dismiss popup"
            className={`notif-item--${n.type}`}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (n.type === "reschedule_offer") onAction(n)
                  else onOpenInbox()
                  dismiss()
                }}
              >
                {label}
              </Button>
            }
          >
            {n.body ? humanizeTimestamps(n.body) : undefined}
          </Toast>
        )
      })}
    </ToastPortal>
  )
}
