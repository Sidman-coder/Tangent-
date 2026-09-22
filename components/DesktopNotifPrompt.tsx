"use client";

import { useEffect, useState } from "react";
import { useAppState } from "./AppStateProvider";
import {
  getDesktopNotifPermission,
  hasPromptedForDesktopNotifs,
  isDesktopNotifSupported,
  markPromptedForDesktopNotifs,
  requestDesktopNotifPermission,
} from "@/lib/desktop-notifications";

// Shown once, after onboarding is complete and the student's first task
// exists — either the onboarding-generated School block or their first
// manual/voice-created task. Respects the browser's own permission state:
// once the student answers (grant or deny) or dismisses this explanation,
// it never asks again (see hasPromptedForDesktopNotifs / markPromptedForDesktopNotifs).
export default function DesktopNotifPrompt() {
  const { state } = useAppState();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    if (!state || state.tasks.length === 0) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("tangent-onboarded") !== "true") return;
    if (!isDesktopNotifSupported()) return;
    if (getDesktopNotifPermission() !== "default") return;
    if (hasPromptedForDesktopNotifs()) return;
    setVisible(true);
  }, [state, visible]);

  const dismiss = () => {
    markPromptedForDesktopNotifs();
    setVisible(false);
  };

  const enable = async () => {
    await requestDesktopNotifPermission();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="confirm-toast desktop-notif-prompt" role="alertdialog" aria-label="Enable desktop notifications">
      <span>Want a desktop alert for overdue tasks and reminders? Tangent only notifies you while a tab is open — nothing runs in the background.</span>
      <div className="confirm-toast-btns">
        <button type="button" className="surface-action-primary" onClick={() => void enable()}>
          Enable
        </button>
        <button type="button" className="surface-action-secondary" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
