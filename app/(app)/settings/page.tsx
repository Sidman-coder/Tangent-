"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import CanvasConnectGuide from "@/components/CanvasConnectGuide";
import { CalendarSync } from "lucide-react";
import type { AppState, CanvasFeedStatus } from "@/lib/types";
import {
  type AppearanceMode,
  readTheme,
  setTheme,
} from "@/lib/theme";
import {
  getDesktopNotifPermission,
  getDesktopNotifSetting,
  isDesktopNotifSupported,
  requestDesktopNotifPermission,
  setDesktopNotifSetting,
} from "@/lib/desktop-notifications";
import { getInAppPopupsEnabled, setInAppPopupsEnabled } from "@/lib/notification-popups";
import { DAY_VIEW_OPTIONS, HELP_FOCUS_OPTIONS, formatSchoolHours } from "@/lib/onboarding";
import { prefsOf } from "@/lib/personalize";

export default function SettingsPage() {
  const { state, saveState, refresh } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [canvasFeed, setCanvasFeed] = useState<CanvasFeedStatus | null>(null);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canvasGuideOpen, setCanvasGuideOpen] = useState(false);

  const [appearance, setAppearance] = useState<AppearanceMode>("light");
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState(false);
  const [desktopNotifPermission, setDesktopNotifPermission] = useState<NotificationPermission | null>(null);
  const [desktopNotifSupported, setDesktopNotifSupported] = useState(true);
  const [inAppPopups, setInAppPopups] = useState(true);
  const accountEmail = state?.user.email ?? "";

  useEffect(() => {
    if (accountEmail) setInAppPopups(getInAppPopupsEnabled(accountEmail));
  }, [accountEmail]);

  const onToggleInAppPopups = () => {
    if (!accountEmail) return;
    const next = !inAppPopups;
    setInAppPopupsEnabled(accountEmail, next);
    setInAppPopups(next);
  };

  useEffect(() => {
    if (!state) return;
    setName(state.user.displayName);
    setEmail(state.user.email);
  }, [state]);

  // Masked feed status only; the real .ics URL never leaves the server.
  useEffect(() => {
    if (canvasGuideOpen) return;
    fetch("/api/canvas/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; feed?: CanvasFeedStatus | null }) => setCanvasFeed(data.ok ? data.feed ?? null : null))
      .catch(() => setCanvasFeed(null));
  }, [canvasGuideOpen]);

  useEffect(() => {
    setAppearance(readTheme());
    setDesktopNotifSupported(isDesktopNotifSupported());
    setDesktopNotifPermission(getDesktopNotifPermission());
    setDesktopNotifEnabled(getDesktopNotifSetting());
  }, []);

  const onToggleAppearance = () => {
    const next: AppearanceMode = appearance === "dark" ? "light" : "dark";
    setAppearance(next);
    setTheme(next);
  };
  const onToggleDesktopNotif = async () => {
    if (desktopNotifEnabled) {
      setDesktopNotifSetting(false);
      setDesktopNotifEnabled(false);
      return;
    }
    if (desktopNotifPermission === "granted") {
      setDesktopNotifSetting(true);
      setDesktopNotifEnabled(true);
      return;
    }
    if (desktopNotifPermission === "denied") return;
    const result = await requestDesktopNotifPermission();
    setDesktopNotifPermission(result);
    setDesktopNotifEnabled(result === "granted");
  };

  const desktopNotifHint = !desktopNotifSupported
    ? "Not supported in this browser."
    : desktopNotifPermission === "denied"
      ? "Blocked in your browser. Allow notifications for this site to turn it back on."
      : "Reuses the alerts already shown in the bell — no extra data is fetched. Only fires while a Tangent tab is open.";

  const prefs = prefsOf(state?.user);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const [redoing, setRedoing] = useState(false);

  // One answer at a time; the rest of the profile is untouched.
  const onChangePreference = async (key: "helpFocus" | "dayView", value: string) => {
    setPrefMsg(null);
    const res = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value || null }),
    }).catch(() => null);
    if (!res?.ok) {
      setPrefMsg("Couldn't save that. Try again.");
      return;
    }
    await refresh();
    setPrefMsg("Saved.");
  };

  // Setup opens again with every answer prefilled. School hours are replaced,
  // never added to, so finishing it twice leaves one School block.
  const onRestartOnboarding = async () => {
    setRedoing(true);
    const res = await fetch("/api/onboarding", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setRedoing(false);
      setPrefMsg("Could not restart setup.");
      return;
    }
    window.location.reload();
  };

  const onResetData = async () => {
    const ok = window.confirm(
      "Delete all your Tangent data?\n\nThis permanently removes your tasks, plans, chats, notifications, history and Canvas connection, and restarts setup. Your account stays. This can't be undone."
    );
    if (!ok) return;
    setResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      if (!res.ok) {
        setMsg("Could not delete your data.");
        return;
      }
      window.location.assign("/");
    } finally {
      setResetting(false);
    }
  };

  const onSave = async () => {
    if (!state) return;
    setSaving(true);
    const next: AppState = {
      ...state,
      user: { ...state.user, displayName: name.trim() || state.user.displayName },
    };
    try {
      const ok = await saveState(next);
      setMsg(ok ? "Profile updated." : "Could not save profile.");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <PageHeader title="Settings" description="Manage your profile and how Tangent feels." />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a href="#profile">Profile</a>
          <a href="#appearance">Appearance</a>
          <a href="#notifications">Notifications</a>
          <a href="#integrations">Integrations</a>
          <a href="#your-tangent">Your Tangent</a>
          <a href="#account">Account</a>
        </nav>

        <div className="settings-content">
          <section id="profile" className="settings-panel">
            <div className="settings-panel-head">
              <div><h2>Profile</h2><p>Used to personalize greetings and your workspace.</p></div>
            </div>
            <div className="settings-field-grid">
              <div className="field">
                <label htmlFor="dn">Display name</label>
                <input id="dn" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="em">Email</label>
                <input id="em" type="email" value={email} readOnly aria-describedby="em-hint" />
                <span id="em-hint" className="settings-field-hint">From your sign-in account.</span>
              </div>
            </div>
            <div className="settings-panel-actions">
              <Button variant="primary" loading={saving} loadingLabel="Saving…" onClick={() => void onSave()}>Save changes</Button>
              {msg && <p className="settings-status" role="status">{msg}</p>}
            </div>
          </section>

          <section id="appearance" className="settings-panel">
            <div className="settings-panel-head"><div><h2>Appearance</h2><p>Choose a comfortable theme and reading style.</p></div></div>
            <div className="settings-option-row">
              <div><strong>Dark mode</strong><span>Switch workspace colors across every page.</span></div>
              <button type="button" className={`toggle-switch${appearance === "dark" ? " on" : ""}`} role="switch" aria-checked={appearance === "dark"} aria-label="Dark mode" onClick={onToggleAppearance}>
                <span className="toggle-knob" />
              </button>
            </div>
          </section>

          <section id="notifications" className="settings-panel">
            <div className="settings-panel-head"><div><h2>Notifications</h2><p>Choose how new alerts reach you while a Tangent tab is open.</p></div></div>
            <div className="settings-option-row">
              <div><strong>In-app popups</strong><span>Show a short popup inside Tangent when a new notification arrives. Each one pops once.</span></div>
              <button
                type="button"
                className={`toggle-switch${inAppPopups ? " on" : ""}`}
                role="switch"
                aria-checked={inAppPopups}
                aria-label="Toggle in-app popups"
                onClick={onToggleInAppPopups}
                disabled={!accountEmail}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            <div className="settings-option-row">
              <div><strong>Desktop notifications</strong><span>{desktopNotifHint}</span></div>
              <button
                type="button"
                className={`toggle-switch${desktopNotifEnabled ? " on" : ""}`}
                role="switch"
                aria-checked={desktopNotifEnabled}
                aria-label="Toggle desktop notifications"
                onClick={() => void onToggleDesktopNotif()}
                disabled={!desktopNotifSupported || desktopNotifPermission === "denied"}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </section>

          <section id="integrations" className="settings-panel settings-integration-panel">
            <div className="settings-option-row">
              <div className="settings-integration-copy">
                <span className="settings-integration-icon" aria-hidden="true"><CalendarSync size={19} /></span>
                <div>
                  <strong>Canvas calendar</strong>
                  <span>
                    {canvasFeed
                      ? `Connected · ${canvasFeed.maskedUrl}${canvasFeed.lastSyncedAt ? ` · ${canvasFeed.lastSyncCount} items last sync` : ""}`
                      : "Bring assignments and due dates into your Tangent calendar."}
                  </span>
                </div>
              </div>
              <Button variant="primary" onClick={() => setCanvasGuideOpen(true)}>{canvasFeed ? "Reconnect Canvas" : "Connect Canvas"}</Button>
            </div>
          </section>

          <section id="your-tangent" className="settings-panel">
            <div className="settings-panel-head">
              <div><h2>Your Tangent</h2><p>Your answers from setup. Change one here, or go through setup again.</p></div>
            </div>
            <div className="settings-option-row">
              <div><strong>What Tangent helps with</strong><span>Shapes the examples you see and what Home shows.</span></div>
              <select
                className="settings-select"
                aria-label="What Tangent helps with"
                value={prefs.helpFocus ?? ""}
                onChange={(e) => void onChangePreference("helpFocus", e.target.value)}
                disabled={!state}
              >
                {!prefs.helpFocus && <option value="">Not set</option>}
                {HELP_FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="settings-option-row">
              <div><strong>Starting view</strong><span>What Home puts first. Nothing is hidden either way.</span></div>
              <select
                className="settings-select"
                aria-label="Starting view"
                value={prefs.dayView ?? ""}
                onChange={(e) => void onChangePreference("dayView", e.target.value)}
                disabled={!state}
              >
                {!prefs.dayView && <option value="">Not set</option>}
                {DAY_VIEW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="settings-option-row">
              <div>
                <strong>School hours</strong>
                <span>{state?.user.schoolHours ? formatSchoolHours(state.user.schoolHours) : "Not set. Add them by going through setup again."}</span>
              </div>
            </div>
            <div className="settings-option-row">
              <div><strong>Canvas</strong><span>{canvasFeed ? "Connected" : "Not connected"}</span></div>
              <Button variant="secondary" onClick={() => setCanvasGuideOpen(true)}>{canvasFeed ? "Reconnect" : "Connect Canvas"}</Button>
            </div>
            <div className="settings-option-row">
              <div><strong>Redo setup</strong><span>Go through the questions again with your answers filled in.</span></div>
              <Button variant="secondary" loading={redoing} loadingLabel="Opening…" onClick={() => void onRestartOnboarding()}>Redo setup</Button>
            </div>
            {prefMsg && <p className="settings-status" role="status">{prefMsg}</p>}
          </section>

          <section id="account" className="settings-panel">
            <div className="settings-option-row">
              <div><strong>Sign out</strong><span>Sign out of Tangent on this device.</span></div>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="secondary">Sign out</Button>
              </form>
            </div>
            <div className="settings-option-row">
              <div><strong>Delete all my data</strong><span>Removes your tasks, plans, chats and history. Your account stays.</span></div>
              <Button variant="danger" loading={resetting} loadingLabel="Deleting…" onClick={() => void onResetData()}>Delete data</Button>
            </div>
          </section>
        </div>
      </div>
      <CanvasConnectGuide open={canvasGuideOpen} onClose={() => setCanvasGuideOpen(false)} />
    </div>
  );
}
