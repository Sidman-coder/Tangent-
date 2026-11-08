"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";
import TextField from "@/components/ui/TextField";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import FormMessage from "@/components/ui/FormMessage";
import { clearLocalAppData } from "@/lib/auth/clear-local";
import { type AppearanceMode, readTheme, setTheme } from "@/lib/theme";
import { HELP_FOCUS_OPTIONS } from "@/lib/onboarding";
import { prefsOf } from "@/lib/personalize";
import type { AppState } from "@/lib/types";

type Msg = { tone: "success" | "error"; text: string } | null;

export default function AccountSettingsPage() {
  const { state, saveState, refresh } = useAppState();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [appearance, setAppearance] = useState<AppearanceMode>("light");
  const prefs = prefsOf(state?.user);

  useEffect(() => {
    if (state) setName(state.user.displayName);
  }, [state]);
  useEffect(() => setAppearance(readTheme()), []);

  const nameChanged = Boolean(state && name.trim() && name.trim() !== state.user.displayName);

  const onSave = async () => {
    if (!state) return;
    setSaving(true);
    const next: AppState = { ...state, user: { ...state.user, displayName: name.trim() || state.user.displayName } };
    try {
      const ok = await saveState(next);
      setMsg(ok ? { tone: "success", text: "Name saved." } : { tone: "error", text: "Couldn't save your name. Try again." });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const onHelpFocus = async (value: string) => {
    setMsg(null);
    const res = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helpFocus: value || null }),
    }).catch(() => null);
    if (!res?.ok) return setMsg({ tone: "error", text: "Couldn't save that. Try again." });
    await refresh();
    setMsg({ tone: "success", text: "Saved." });
  };

  return (
    <>
      <SettingsPageHeader page="account" />

      <SettingsSection id="profile" title="Profile" footer={msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}>
        <SettingRow label="Name" help="What Tangent calls you." htmlFor="settings-name">
          <TextField id="settings-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          {nameChanged && (
            <Button size="sm" variant="primary" loading={saving} loadingLabel="Saving…" onClick={() => void onSave()}>Save</Button>
          )}
        </SettingRow>
        <SettingRow label="Email" help="From your sign-in account.">
          <span className="settings-row-value">{state?.user.email ?? ""}</span>
        </SettingRow>
        <SettingRow label="What Tangent helps with" help="Shapes its examples and suggestions." htmlFor="settings-help-focus">
          <Select
            id="settings-help-focus"
            value={prefs.helpFocus ?? ""}
            onChange={(e) => void onHelpFocus(e.target.value)}
            disabled={!state}
            options={[...(prefs.helpFocus ? [] : [{ value: "", label: "Not set" }]), ...HELP_FOCUS_OPTIONS]}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection id="appearance" title="Appearance">
        <SettingRow label="Dark mode" help="Across every page, on this device.">
          <Toggle
            label="Dark mode"
            checked={appearance === "dark"}
            onChange={(on) => {
              const next: AppearanceMode = on ? "dark" : "light";
              setAppearance(next);
              setTheme(next);
            }}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection id="account" title="Sign out">
        <SettingRow label="Sign out" help="On this device. To sign out everywhere, open Security.">
          <form action="/auth/signout" method="post" onSubmit={clearLocalAppData}>
            <Button type="submit" size="sm">Sign out</Button>
          </form>
        </SettingRow>
      </SettingsSection>
    </>
  );
}
