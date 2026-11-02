// Sample data for the development-only previews in app/dev/*. Never imported
// by app code.

import type { AppState } from "@/lib/types";

function ymd(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const t = (id: string, title: string, day: number, time: string, extra: Record<string, unknown> = {}) => ({
  id, title, date: ymd(day), time, completed: false, ...extra,
});

export const SAMPLE_STATE = {
  user: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, displayName: "Juann", onboardedAt: "2026-10-01", preferences: {} },
  plans: [{ id: "p1", title: "Robotics", description: "Intake arm for regionals", taskIds: [], color: "#2f9e6e", createdAt: "", taskCount: 3 }],
  tasks: [
    t("1", "Physics lab writeup", 1, "23:59", { source: "canvas", kind: "school" }),
    t("2", "Study for APUSH quiz", 0, "17:00", { kind: "personal", startAction: "Open chapter 7 and skim the headings" }),
    t("3", "Robotics CAD: intake arm", 3, "16:00", { kind: "academic-ec", planId: "p1" }),
    t("4", "Buy poster board", 5, "12:00", { kind: "personal" }),
    t("5", "Calc problem set 4.3", 6, "23:59", { source: "canvas", kind: "school" }),
    t("6", "Email Dr. Chann about the booth", 0, "09:00", { kind: "academic-ec" }),
    t("7", "Soccer practice", 2, "16:30", { kind: "side-ec" }),
    t("8", "Chem test review", 4, "19:00", { kind: "personal", calendarId: "cal_school" }),
    t("9", "Robotics: order servo motors", 1, "15:00", { kind: "academic-ec", planId: "p1" }),
    t("10", "Dentist", 8, "10:00", { kind: "personal" }),
  ],
  calendars: [],
  events: [],
  weeklyPlan: [],
  lastVoiceCommand: null,
  lastVoiceResponse: null,
} as unknown as AppState;