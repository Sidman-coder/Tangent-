"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import type { AppState } from "@/lib/types";
import {
  type AppearanceMode,
  type FontMode,
  setTheme,
  setFontMode,
} from "@/lib/theme";

const FONT_MODE_PREVIEWS: Record<FontMode, { name: string; display: string }> = {
  formal: { name: "Formal", display: "'Libre Caslon Display', serif" },
  warm: { name: "Warm", display: "'Plus Jakarta Sans', sans-serif" },
};

export default function SettingsPage() {
  const { state, saveState, refresh } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [msg, setMsg] = useState<string | null>(null);

  const [appearance, setAppearance] = useState<AppearanceMode>("dark");
  const [fontMode, setFontModeState] = useState<FontMode>("warm");

  useEffect(() => {
    if (!state) return;
    setName(state.user.displayName);
    setEmail(state.user.email);
  }, [state]);

  useEffect(() => {
    setApiKey(localStorage.getItem("tangent_openai_key") ?? "");
    setModel(localStorage.getItem("tangent_openai_model") ?? "gpt-4o-mini");

    const storedTheme = (localStorage.getItem("tangent-theme") as AppearanceMode | null) ?? "light";
    setAppearance(storedTheme);
    const storedFontMode = (localStorage.getItem("tangent-font-mode") as FontMode | null) ?? "warm";
    setFontModeState(storedFontMode);
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

  const onSave = async () => {
    if (!state) return;
    localStorage.setItem("tangent_openai_key", apiKey.trim());
    localStorage.setItem("tangent_openai_model", model.trim() || "gpt-4o-mini");
    const next: AppState = {
      ...state,
      user: { displayName: name.trim() || state.user.displayName, email: email.trim() || state.user.email },
    };
    const ok = await saveState(next);
    setMsg(ok ? "Saved profile and stored API key locally in this browser." : "Could not save profile.");
    await refresh();
  };

  return (
    <>
      <section className="card" style={{ maxWidth: 520 }}>
        <div className="settings-section-head" style={{ marginTop: 0 }}>Profile</div>
        <div className="field">
          <label htmlFor="dn">Display name</label>
          <input id="dn" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="settings-section-head" style={{ marginTop: "1.75rem" }}>AI Configuration</div>
        <div className="field">
          <label htmlFor="key">OpenAI API key (browser only)</label>
          <input
            id="key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            placeholder="sk-…"
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            For production, prefer <code style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>OPENAI_API_KEY</code> on the server.
          </span>
        </div>
        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label htmlFor="model">Model</label>
          <input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </div>
        <button type="button" className="btn surface-action-primary" style={{ marginTop: "1.25rem" }} onClick={() => void onSave()}>
          Save changes
        </button>
        {msg && <p className="status-banner" style={{ marginTop: "0.75rem" }}>{msg}</p>}
      </section>

      <section className="card" style={{ maxWidth: 520, marginTop: "1.25rem" }}>
        <div className="settings-section-head" style={{ marginTop: 0 }}>Appearance Mode</div>
        <div className="theme-mode-row">
          <div className="theme-mode-row-label">
            <span className="theme-mode-row-title">{appearance === "dark" ? "Dark mode" : "Light mode"}</span>
            <span className="theme-mode-row-desc">Switch between dark and light workspace colors.</span>
          </div>
          <button
            type="button"
            className={`toggle-switch${appearance === "light" ? " on" : ""}`}
            role="switch"
            aria-checked={appearance === "light"}
            aria-label="Toggle light mode"
            onClick={onToggleAppearance}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="settings-section-head" style={{ marginTop: "1.75rem" }}>Font Mode</div>
        <div className="font-toggle-row">
          {(Object.keys(FONT_MODE_PREVIEWS) as FontMode[]).map((mode) => {
            const preview = FONT_MODE_PREVIEWS[mode];
            return (
              <button
                key={mode}
                type="button"
                className={`font-toggle-btn${fontMode === mode ? " is-active" : ""}`}
                onClick={() => applyFontMode(mode)}
                aria-pressed={fontMode === mode}
                style={{ fontFamily: preview.display }}
              >
                {preview.name}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
