"use client";

// Settings for the daily brief: what Tangent reads (sources), how often and
// when it arrives. Opened from the "Your Brief" pill in the console header.

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { BriefConfig, BriefSource } from "@/lib/types";
import type { SuggestedBriefSource } from "@/lib/brief-sources";

export const CADENCE_LABEL: Record<BriefConfig["cadence"], string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
};
const SOURCE_TYPE_LABEL: Record<BriefSource["type"], string> = {
  rss: "RSS feed",
  manual_url: "Website URL",
  stale_check: "Notice stale tasks",
};

export type BriefSummary = Pick<BriefConfig, "cadence" | "deliveryTime">;

type Props = {
  /** Called after a successful save so the header pill can update. */
  onSaved: (summary: BriefSummary) => void;
};

export default function BriefPanel({ onSaved }: Props) {
  const [briefSources, setBriefSources] = useState<BriefSource[]>([]);
  const [briefCadence, setBriefCadence] = useState<BriefConfig["cadence"]>("daily");
  const [briefTime, setBriefTime] = useState("07:00");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newSourceType, setNewSourceType] = useState<BriefSource["type"]>("rss");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [savingBrief, setSavingBrief] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedBriefSource[]>([]);

  useEffect(() => {
    fetch("/api/brief-config")
      .then((res) => res.json())
      .then((data: { ok?: boolean; config?: BriefConfig | null }) => {
        if (data.ok && data.config) {
          setBriefSources(data.config.sources ?? []);
          setBriefCadence(data.config.cadence ?? "daily");
          setBriefTime(data.config.deliveryTime ?? "07:00");
        }
      })
      .catch(() => {});
  }, []);

  const addBriefSource = useCallback(() => {
    const label = newSourceLabel.trim();
    if (!label) return;
    const source: BriefSource = {
      id: crypto.randomUUID(),
      type: newSourceType,
      label,
      ...(newSourceType !== "stale_check" && newSourceUrl.trim() ? { url: newSourceUrl.trim() } : {}),
    };
    setBriefSources((prev) => [...prev, source]);
    setNewSourceLabel("");
    setNewSourceUrl("");
    setNewSourceType("rss");
    setShowAddSource(false);
    setBriefSaved(false);
  }, [newSourceLabel, newSourceType, newSourceUrl]);

  const removeBriefSource = useCallback((id: string) => {
    setBriefSources((prev) => prev.filter((s) => s.id !== id));
    setBriefSaved(false);
  }, []);

  const findSources = useCallback(async () => {
    const query = findQuery.trim();
    if (!query || findLoading) return;
    setFindLoading(true);
    setFindError(null);
    try {
      const res = await fetch("/api/brief-sources/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.suggestions ?? []);
        if (!data.suggestions?.length) setFindError("No sources found — try a different topic.");
      } else {
        setFindError(data.error ?? "Couldn't find sources.");
      }
    } catch {
      setFindError("Couldn't find sources.");
    } finally {
      setFindLoading(false);
    }
  }, [findQuery, findLoading]);

  const confirmSuggestion = useCallback((suggestion: SuggestedBriefSource) => {
    const source: BriefSource = {
      id: crypto.randomUUID(),
      type: suggestion.type,
      label: suggestion.label,
      url: suggestion.url,
    };
    setBriefSources((prev) => [...prev, source]);
    setSuggestions((prev) => prev.filter((s) => s.url !== suggestion.url));
    setBriefSaved(false);
  }, []);

  const dismissSuggestion = useCallback((suggestion: SuggestedBriefSource) => {
    setSuggestions((prev) => prev.filter((s) => s.url !== suggestion.url));
  }, []);

  const saveBriefSettings = useCallback(async () => {
    setSavingBrief(true);
    setBriefSaved(false);
    try {
      const res = await fetch("/api/brief-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: briefSources, cadence: briefCadence, deliveryTime: briefTime }),
      });
      const data = await res.json();
      if (data.ok) {
        setBriefSaved(true);
        onSaved({ cadence: briefCadence, deliveryTime: briefTime });
      }
    } catch {
      // best-effort — settings stay in local state, user can retry Save
    } finally {
      setSavingBrief(false);
    }
  }, [briefSources, briefCadence, briefTime, onSaved]);

  return (
    <div className="console-brief-setup">
      <p className="tg-brief-intro">
        A short read that lands {CADENCE_LABEL[briefCadence].toLowerCase()} at the time you pick: what’s due, what
        slipped, and anything new from the sources below.
      </p>
      <div className="console-brief-sources">
        {briefSources.length === 0 && (
          <p className="console-brief-empty">No sources yet. Add one below.</p>
        )}
        {briefSources.map((source) => (
          <div key={source.id} className="card-sm console-brief-source-row">
            <div className="console-brief-source-info">
              <span className="console-brief-source-label">{source.label}</span>
              <span className="console-brief-source-type">{SOURCE_TYPE_LABEL[source.type]}</span>
            </div>
            <button
              type="button"
              className="console-brief-remove"
              aria-label={`Remove ${source.label}`}
              onClick={() => removeBriefSource(source.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="card-sm console-brief-find">
        <label className="console-brief-field">
          <span>Find sources</span>
          <div className="console-brief-find-row">
            <input
              className="console-brief-text-input"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void findSources();
                }
              }}
              placeholder="e.g. AI news, F1, climate policy"
            />
            <button
              type="button"
              className="console-chip"
              onClick={() => void findSources()}
              disabled={findLoading || !findQuery.trim()}
            >
              {findLoading ? "Finding…" : "Find sources"}
            </button>
          </div>
        </label>
        {findError && <p className="console-brief-empty">{findError}</p>}
        {suggestions.map((s) => (
          <div key={s.url} className="card-sm console-brief-suggestion-row">
            <div className="console-brief-source-info">
              <span className="console-brief-source-label">{s.label}</span>
              <span className="console-brief-source-type">
                {s.type === "rss" ? "RSS feed" : "Website URL"} · {s.reason}
              </span>
            </div>
            <div className="console-brief-actions">
              <button type="button" className="console-chip" onClick={() => dismissSuggestion(s)}>
                Skip
              </button>
              <button type="button" className="console-chip" onClick={() => confirmSuggestion(s)}>
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddSource ? (
        <div className="card-sm console-brief-add-form">
          <label className="console-brief-field">
            <span>Label</span>
            <input
              className="console-brief-text-input"
              value={newSourceLabel}
              onChange={(e) => setNewSourceLabel(e.target.value)}
              placeholder="Morning news"
            />
          </label>
          <label className="console-brief-field">
            <span>Type</span>
            <select
              className="console-brief-text-input"
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value as BriefSource["type"])}
            >
              <option value="rss">RSS feed</option>
              <option value="manual_url">Website URL</option>
              <option value="stale_check">Notice stale tasks</option>
            </select>
          </label>
          {newSourceType !== "stale_check" && (
            <label className="console-brief-field">
              <span>URL</span>
              <input
                className="console-brief-text-input"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
          )}
          <div className="console-brief-actions">
            <button type="button" className="console-chip" onClick={() => setShowAddSource(false)}>
              Cancel
            </button>
            <button type="button" className="console-chip" onClick={addBriefSource} disabled={!newSourceLabel.trim()}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="console-chip console-brief-add-toggle"
          onClick={() => setShowAddSource(true)}
        >
          + Add source
        </button>
      )}

      <div className="console-brief-config-row">
        <span className="console-brief-config-label">Cadence</span>
        <div className="console-mode-row">
          {(["daily", "weekdays", "weekly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`console-mode-pill${briefCadence === c ? " console-mode-pill--active" : ""}`}
              onClick={() => {
                setBriefCadence(c);
                setBriefSaved(false);
              }}
            >
              {CADENCE_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="console-brief-config-row">
        <span className="console-brief-config-label">Delivery time</span>
        <input
          type="time"
          className="console-brief-time-input"
          value={briefTime}
          onChange={(e) => {
            setBriefTime(e.target.value);
            setBriefSaved(false);
          }}
        />
      </div>

      <button
        type="button"
        className="neu-btn-primary console-brief-save"
        onClick={() => void saveBriefSettings()}
        disabled={savingBrief}
      >
        {savingBrief ? "Saving…" : briefSaved ? "Saved ✓" : "Save brief settings"}
      </button>
    </div>
  );
}
