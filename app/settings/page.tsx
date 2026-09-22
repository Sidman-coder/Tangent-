"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import type { AppState } from "@/lib/types";
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
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const onRestartOnboarding = () => {
    localStorage.removeItem("tangent-onboarded");
    localStorage.removeItem("tangent-user-name");
    localStorage.removeItem("tangent-is-hs");
    window.location.reload();
  };

  const onSave = async () => {
    if (!state) return;
    setSaving(true);
    const next: AppState = {
      ...state,
      user: { displayName: name.trim() || state.user.displayName, email: email.trim() || state.user.email },
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
          <a href="#onboarding">Onboarding</a>
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
                <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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

          <section id="onboarding" className="settings-panel">
            <div className="settings-option-row">
              <div><strong>Restart onboarding</strong><span>Revisit the setup questions for this browser.</span></div>
              <Button variant="secondary" onClick={onRestartOnboarding}>Restart setup</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
