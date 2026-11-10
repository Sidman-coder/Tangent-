"use client";

import { useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import CanvasConnectGuide from "@/components/CanvasConnectGuide";
import ConnectionsSection from "@/components/settings/ConnectionsSection";
import CommitmentsEditor from "@/components/settings/CommitmentsEditor";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { useCanvasStatus } from "@/components/settings/useCanvasStatus";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";
import Select from "@/components/ui/Select";
import FormMessage from "@/components/ui/FormMessage";
import { DEFAULT_CAPACITY, formatMinutes } from "@/lib/load";

type Msg = { tone: "success" | "error"; text: string } | null;

/** 30 min to 6 hrs in half hours, plus the current value if it's off-grid. */
function capacityOptions(current: number) {
  const steps = Array.from({ length: 12 }, (_, i) => (i + 1) * 30);
  const all = steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
  return all.map((m) => ({ value: String(m), label: formatMinutes(m) }));
}

const WEEK_START = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "6", label: "Saturday" },
];

export default function ScheduleSettingsPage() {
  const { state, refresh } = useAppState();
  const canvas = useCanvasStatus();
  const [guideOpen, setGuideOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const capacity = state?.user.capacity ?? DEFAULT_CAPACITY;

  const send = async (url: string, method: "POST" | "PATCH", body: unknown) => {
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMsg(res.ok && data.ok ? { tone: "success", text: "Saved." } : { tone: "error", text: data.error ?? "Couldn't save that. Try again." });
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach Tangent. Check your connection and try again." });
    }
    await refresh();
  };

  return (
    <>
      <SettingsPageHeader page="schedule" />

      <ConnectionsSection canvasLoaded={canvas.loaded} canvasConnected={canvas.connected} onConnectCanvas={() => setGuideOpen(true)} />

      <SettingsSection
        id="planning"
        title="Your week"
        description="How Tangent places work, so no day gets more than you can handle."
        footer={msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      >
        <CommitmentsEditor onSaved={refresh} />
        <SettingRow label="Work per school night" help="Past this, new work moves to a lighter day." htmlFor="cap-weekday">
          <Select
            id="cap-weekday"
            value={String(capacity.weekday)}
            disabled={!state}
            onChange={(e) => void send("/api/capacity", "POST", { ...capacity, weekday: Number(e.target.value) })}
            options={capacityOptions(capacity.weekday)}
          />
        </SettingRow>
        <SettingRow label="Work per weekend day" help="The same, for Saturdays and Sundays." htmlFor="cap-weekend">
          <Select
            id="cap-weekend"
            value={String(capacity.weekend)}
            disabled={!state}
            onChange={(e) => void send("/api/capacity", "POST", { ...capacity, weekend: Number(e.target.value) })}
            options={capacityOptions(capacity.weekend)}
          />
        </SettingRow>
        <SettingRow label="Week starts on" help="For the calendar and project previews." htmlFor="week-start">
          <Select
            id="week-start"
            value={String(state?.user.weekStart ?? 0)}
            disabled={!state}
            onChange={(e) => void send("/api/settings", "PATCH", { weekStart: Number(e.target.value) })}
            options={WEEK_START}
          />
        </SettingRow>
      </SettingsSection>

      <CanvasConnectGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          canvas.reload();
        }}
      />
    </>
  );
}
