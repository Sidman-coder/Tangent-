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
  type FontMode,
  setTheme,
  setFontMode,
} from "@/lib/theme";
import {
  getDesktopNotifPermission,
  getDesktopNotifSetting,
  isDesktopNotifSupported,
  requestDesktopNotifPermission,
  setDesktopNotifSetting,
} from "@/lib/desktop-notifications";

const FONT_MODE_PREVIEWS: Record<FontMode, { name: string; display: string }> = {
  formal: { name: "Formal", display: "'Libre Caslon Display', serif" },
  warm: { name: "Warm", display: "'Plus Jakarta Sans', sans-serif" },
};

export default function SettingsPage() {
  const { state, saveState, refresh } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [canvasFeed, setCanvasFeed] = useState<CanvasFeedStatus | null>(null);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canvasGuideOpen, setCanvasGuideOpen] = useState(false);

  const [appearance, setAppearance] = useState<AppearanceMode>("dark");
  const [fontMode, setFontModeState] = useState<FontMode>("warm");
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState(false);
  const [desktopNotifPermission, setDesktopNotifPermission] = useState<NotificationPermission | null>(null);
  const [desktopNotifSupported, setDesktopNotifSupported] = useState(true);

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
    const storedTheme = (localStorage.getItem("tangent-theme") as AppearanceMode | null) ?? "light";
    setAppearance(storedTheme);
    const storedFontMode = (localStorage.getItem("tangent-font-mode") as FontMode | null) ?? "warm";
    setFontModeState(storedFontMode);
    setDesktopNotifSupported(isDesktopNotifSupported());
    setDesktopNotifPermission(getDesktopNotifPermission());
    setDesktopNotifEnabled(getDesktopNotifSetting());
  }, []);

  const onToggleAppearance = () => {
    const next: AppearanceMode = appearance === "dark" ? "light" : "dark";
    setAppearance(next);
    setTheme(next);
  };

  const applyFontMode = (mode: FontMode) => {
    setFontModeState(mode);
    setFontMode(mode);
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

  const onRestartOnboarding = async () => {
    const res = await fetch("/api/onboarding", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setMsg("Could not restart setup.");
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
      <PageHeader eyebrow="Workspace" title="Settings" description="Manage your profile and how Tangent feels." />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a href="#profile">Profile</a>
          <a href="#appearance">Appearance</a>
          <a href="#notifications">Notifications</a>
          <a href="#integrations">Integrations</a>
          <a href="#onboarding">Onboarding</a>
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
              <div><strong>{appearance === "dark" ? "Dark mode" : "Light mode"}</strong><span>Switch workspace colors across every page.</span></div>
              <button type="button" className={`toggle-switch${appearance === "light" ? " on" : ""}`} role="switch" aria-checked={appearance === "light"} aria-label="Toggle light mode" onClick={onToggleAppearance}>
                <span className="toggle-knob" />
              </button>
            </div>
            <div className="settings-option-block">
              <div><strong>Type style</strong><span>Pick the display face used for major headings.</span></div>
              <div className="font-toggle-row">
                {(Object.keys(FONT_MODE_PREVIEWS) as FontMode[]).map((mode) => {
                  const preview = FONT_MODE_PREVIEWS[mode];
                  return <button key={mode} type="button" className={`font-toggle-btn${fontMode === mode ? " is-active" : ""}`} onClick={() => applyFontMode(mode)} aria-pressed={fontMode === mode} style={{ fontFamily: preview.display }}>{preview.name}</button>;
                })}
              </div>
            </div>
          </section>

          <section id="notifications" className="settings-panel">
            <div className="settings-panel-head"><div><h2>Notifications</h2><p>Get an OS notification for new alerts while a Tangent tab is open.</p></div></div>
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

          <section id="onboarding" className="settings-panel">
            <div className="settings-option-row">
              <div><strong>Restart onboarding</strong><span>Revisit the setup questions.</span></div>
              <Button variant="secondary" onClick={() => void onRestartOnboarding()}>Restart setup</Button>
            </div>
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
