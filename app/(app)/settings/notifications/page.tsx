"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import {
  getDesktopNotifPermission,
  getDesktopNotifSetting,
  isDesktopNotifSupported,
  requestDesktopNotifPermission,
  setDesktopNotifSetting,
} from "@/lib/desktop-notifications";
import { getInAppPopupsEnabled, setInAppPopupsEnabled } from "@/lib/notification-popups";
import type { NotificationPrefs } from "@/lib/settings/notification-prefs";

type Msg = { tone: "success" | "error"; text: string } | null;
const DEFAULT_QUIET = { start: "22:00", end: "07:00" };

export default function NotificationSettingsPage() {
  const { state } = useAppState();
  const email = state?.user.email ?? "";
  const [inAppPopups, setInAppPopups] = useState(true);
  const [desktopOn, setDesktopOn] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [supported, setSupported] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [quietDraft, setQuietDraft] = useState(DEFAULT_QUIET);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (email) setInAppPopups(getInAppPopupsEnabled(email));
  }, [email]);
  useEffect(() => {
    setSupported(isDesktopNotifSupported());
    setPermission(getDesktopNotifPermission());
    setDesktopOn(getDesktopNotifSetting());
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; notificationPrefs?: NotificationPrefs }) => {
        const p = d.ok ? d.notificationPrefs ?? {} : {};
        setPrefs(p);
        if (p.quietHours) setQuietDraft(p.quietHours);
      })
      .catch(() => setPrefs({}));
  }, []);

  const onDesktop = async (next: boolean) => {
    if (!next) {
      setDesktopNotifSetting(false);
      setDesktopOn(false);
      return;
    }
    if (permission === "granted") {
      setDesktopNotifSetting(true);
      setDesktopOn(true);
      return;
    }
    if (permission === "denied") return;
    const result = await requestDesktopNotifPermission();
    setPermission(result);
    setDesktopOn(result === "granted");
  };

  const saveQuiet = async (quietHours: NotificationPrefs["quietHours"]) => {
    const next: NotificationPrefs = { ...prefs, quietHours };
    if (!quietHours) delete next.quietHours;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPrefs: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ tone: "error", text: data.error ?? "Couldn't save that. Try again." });
        return;
      }
      setPrefs(next);
      setMsg({ tone: "success", text: quietHours ? "Quiet hours saved." : "Quiet hours off." });
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach Tangent. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const desktopHint = !supported
    ? "Not supported in this browser."
    : permission === "denied"
      ? "Blocked in your browser. Allow notifications for this site to turn it back on."
      : "Reuses the alerts already shown in the bell. Only fires while a Tangent tab is open.";

  const quietOn = Boolean(prefs?.quietHours);
  const quietChanged = quietOn && (prefs?.quietHours?.start !== quietDraft.start || prefs?.quietHours?.end !== quietDraft.end);
  const quietValid = quietDraft.start !== quietDraft.end;

  return (
    <>
      <SettingsPageHeader page="notifications" />

      <SettingsSection id="notifications" title="Alerts">
        <SettingRow label="In-app popups" help="A short popup inside Tangent when something new arrives.">
          <Toggle
            label="In-app popups"
            checked={inAppPopups}
            disabled={!email}
            onChange={(next) => {
              setInAppPopupsEnabled(email, next);
              setInAppPopups(next);
            }}
          />
        </SettingRow>
        <SettingRow label="Desktop notifications" help={desktopHint}>
          <Toggle label="Desktop notifications" checked={desktopOn} disabled={!supported || permission === "denied"} onChange={(next) => void onDesktop(next)} />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        id="quiet-hours"
        title="Quiet hours"
        description="Tangent's check-ins and nudges wait until these end."
        footer={msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      >
        <SettingRow label="Quiet hours" help={prefs === null ? "Checking…" : quietOn ? "On, in your time zone." : "Off."}>
          <Toggle label="Quiet hours" checked={quietOn} disabled={prefs === null || busy} onChange={(on) => void saveQuiet(on ? quietDraft : undefined)} />
        </SettingRow>
        {quietOn && (
          <div className="settings-row is-stacked">
            <div className="settings-times">
              <label htmlFor="quiet-start">From</label>
              <input id="quiet-start" type="time" className="settings-input" value={quietDraft.start} onChange={(e) => setQuietDraft((q) => ({ ...q, start: e.target.value }))} />
              <label htmlFor="quiet-end">to</label>
              <input id="quiet-end" type="time" className="settings-input" value={quietDraft.end} onChange={(e) => setQuietDraft((q) => ({ ...q, end: e.target.value }))} />
              {quietChanged && (
                <Button size="sm" variant="primary" disabled={!quietValid} loading={busy} loadingLabel="Saving…" onClick={() => void saveQuiet(quietDraft)}>Save</Button>
              )}
            </div>
            {!quietValid && <FormMessage tone="error">Pick a start and end that aren&apos;t the same time.</FormMessage>}
          </div>
        )}
      </SettingsSection>

      <SettingsSection id="install" title="Put Tangent on your phone" description="Installed, it opens like an app, full screen.">
        <SettingRow label="iPhone or iPad" help="In Safari, tap Share, then Add to Home Screen." />
        <SettingRow label="Android" help="In Chrome, open the ⋮ menu, then Install app or Add to Home screen." />
        <SettingRow label="Laptop" help="In Chrome or Edge, click the install icon at the right end of the address bar." />
      </SettingsSection>
    </>
  );
}
