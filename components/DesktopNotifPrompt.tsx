"use client";

import { useEffect, useState } from "react";
import { claimOverlay, hasFirstRealItem, overlayHolder, releaseOverlay, subscribeOverlay } from "@/lib/first-run-gates";
import { useAppState } from "./AppStateProvider";
import {
  getDesktopNotifPermission,
  hasPromptedForDesktopNotifs,
  isDesktopNotifSupported,
  markPromptedForDesktopNotifs,
  requestDesktopNotifPermission,
} from "@/lib/desktop-notifications";

// Shown once, after onboarding is complete and the student has added their own
// first item (not the School block, not a Canvas import), and only when no
// other optional overlay is open (overnight C01). Respects the browser's own permission state:
// once the student answers (grant or deny) or dismisses this explanation,
// it never asks again (see hasPromptedForDesktopNotifs / markPromptedForDesktopNotifs).
export default function DesktopNotifPrompt() {
  const { state } = useAppState();
  const [visible, setVisible] = useState(false);

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeOverlay(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (visible) return;
    if (!state || !hasFirstRealItem(state.tasks)) return;
    if (typeof window === "undefined") return;
    if (!state.user.onboardedAt) return;
    if (!isDesktopNotifSupported()) return;
    if (getDesktopNotifPermission() !== "default") return;
    if (hasPromptedForDesktopNotifs()) return;
    if (overlayHolder() !== null) return;
    if (!claimOverlay("desktop-notifs")) return;
    setVisible(true);
  }, [state, visible, tick]);

  const dismiss = () => {
    markPromptedForDesktopNotifs();
    setVisible(false);
    releaseOverlay("desktop-notifs");
  };

  const enable = async () => {
    await requestDesktopNotifPermission();
    setVisible(false);
    releaseOverlay("desktop-notifs");
  };

  if (!visible) return null;

  return (
    <div className="confirm-toast desktop-notif-prompt" role="alertdialog" aria-label="Enable desktop notifications">
      <span>Want a desktop alert for past-due tasks and reminders? Tangent only notifies you while a tab is open — nothing runs in the background.</span>
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
