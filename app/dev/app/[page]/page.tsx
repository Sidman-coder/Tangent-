"use client";

// Development-only: a page of the app inside the real shell, with sample data
// (lib/dev/sample-state.ts), for design review without an account.
// /dev/app/today, /dev/app/calendar, /dev/app/projects, /dev/app/project, /dev/app/school, /dev/app/settings, /dev/app/settings-account (…-security, -schedule,
// -notifications, -context (sample facts on the map; -context-dense has ~150), -activity, -data),
// /dev/app/tangents, /dev/app/notifications (…-empty), /dev/app/draft (an unconfirmed plan; leave the page and the draft pill shows), /dev/app/preview, /dev/app/color, /dev/app/grill, /dev/app/review-mockup (static, overnight 4.5). 404s in production. API calls fail here (no session), so
// anything loaded from the server shows its empty or error state.

import { notFound, useParams } from "next/navigation";
import { MockAppStateProvider, useUserTimezone } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import AppShell from "@/components/AppShell";
import { SampleNotificationsContext } from "@/components/NotificationBell";
import { SampleKnowsContext } from "@/components/settings/WhatTangentKnows";
import { SAMPLE_KNOWS, denseKnows } from "@/lib/dev/sample-knows";
import type { Notification } from "@/lib/types";
import TaskDetail from "@/components/TaskDetail";
import DraftDock from "@/components/drafts/DraftDock";
import PreviewCard from "@/components/PreviewCard";
import FirstRun from "@/components/FirstRun";
import TodayHome from "@/components/today/TodayHome";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import ColorPicker from "@/components/projects/ColorPicker";
import RoundReviewSheet, { type RoundReviewSample } from "@/components/projects/RoundReviewSheet";
import { startQuestion } from "@/lib/round-review";
import SlotQuestionCard from "@/components/grill/SlotQuestionCard";
import ReviewMockup from "@/components/dev/ReviewMockup";
import { useEffect, useMemo, useState } from "react";
import { GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";
import { followUpById, followUpStorageKey } from "@/lib/student/follow-ups";
import CalendarPage from "@/app/(app)/calendar/page";
import ProjectsPage from "@/app/(app)/projects/page";
import SchoolPage from "@/app/(app)/projects/school/page";
import AllTasksPage from "@/app/(app)/tasks/page";
import ProjectView from "@/components/projects/ProjectView";
import SettingsPage from "@/app/(app)/settings/page";
import SettingsFrame from "@/components/settings/SettingsFrame";
import AccountSettings from "@/app/(app)/settings/account/page";
import SecuritySettingsPage from "@/app/(app)/settings/security/page";
import ScheduleSettings from "@/app/(app)/settings/schedule/page";
import NotificationSettings from "@/app/(app)/settings/notifications/page";
import ContextSettings from "@/app/(app)/settings/context/page";
import ActivitySettings from "@/app/(app)/settings/activity/page";
import DataSettings from "@/app/(app)/settings/data/page";
import TangentsPage from "@/app/(app)/tangents/page";
import { SAMPLE_STATE } from "@/lib/dev/sample-state";
import { addDaysYMD, getUserToday } from "@/lib/time";

function PreviewCalendarSample() {
  const today = getUserToday(useUserTimezone());
  return (
    <section className="preview-card" style={{ maxWidth: 680, margin: "24px auto" }}>
      <h1 className="preview-card-title">Robotics project preview</h1>
      <PlanCalendarPreview
        ops={[
          { op: "add_task", title: "Sketch the intake arm", date: today, time: "16:00", commitment: "flexible", plan_id: "p1", notes: "Make the first prototype easier to measure." },
          { op: "add_task", title: "Test the servo travel", date: addDaysYMD(today, 3), time: "16:30", commitment: "flexible", plan_id: "p1" },
          { op: "add_task", title: "Update the CAD model", date: addDaysYMD(today, 7), time: "17:00", commitment: "flexible", plan_id: "p1" },
        ]}
        tasks={SAMPLE_STATE.tasks}
        plans={SAMPLE_STATE.plans}
        weekStart={0}
        today={today}
      />
    </section>
  );
}

/** Round 5A 4.2: an unconfirmed plan on screen. Leave the page and it's kept
 *  as a draft (the pill bottom-right). Confirm/Discard 401 here (no session). */
function DraftSample() {
  const today = getUserToday(useUserTimezone());
  const ops = [
    { op: "create_plan" as const, ref: "cp", title: "Competitive programming" },
    ...["Solve 3 easy array problems", "Review two-pointer patterns", "Timed set: 2 medium problems", "Read one editorial", "Virtual contest (Div. 3)"].map((title, i) => ({
      op: "add_task" as const,
      title,
      date: addDaysYMD(today, i * 2 + 1),
      time: "16:30",
      commitment: "flexible" as const,
      plan_ref: "cp",
    })),
  ];
  const changeSet = {
    id: "00000000-0000-4000-8000-00000000d5a1",
    user_id: "00000000-0000-4000-8000-000000000001",
    source: "typed" as const,
    request_text: "plan competitive programming",
    summary: "Five short practice sessions over the next ten days, building to a virtual contest.",
    intent: "new_plan" as const,
    target_plan_id: null,
    ops,
    assumptions: [],
    status: "draft" as const,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    action_id: null,
  };
  const preview = { lines: ops.flatMap((o) => (o.op === "add_task" ? [`${o.title} · ${o.date}`] : [])), likelyDuplicates: [] };
  return (
    <div style={{ maxWidth: 680, margin: "24px auto" }}>
      <PreviewCard changeSet={changeSet} preview={preview} />
    </div>
  );
}

/** Round 5A Phase 5: the round review sheet with sample questions (the API
 *  isn't reachable here). at=last opens on "When should round 2 start?". */
function RoundReviewSample({ at }: { at: number }) {
  const today = getUserToday(useUserTimezone());
  const sample = useMemo<RoundReviewSample>(
    () => ({
      next: 2,
      at,
      oldIds: ["3", "9", "11"],
      questions: [
        { id: "q1", kind: "answer", text: "\"Robotics CAD: intake arm\" ran 3 days late. Was it the CAD work or the week?", chips: ["The CAD work", "The week", "Both"] },
        { id: "q2", kind: "answer", text: "Two steps got moved. Were after-school sessions too tight?", chips: ["Too tight", "About right", "Life got busy"] },
        { id: "q3", kind: "answer", text: "Waiting on servo motors held things up. Order parts earlier next round?", chips: ["Yes, first thing", "Not needed"] },
        startQuestion(2),
      ],
      ops: [
        ...[
          ["Mount the servos on the arm", 1, "16:00"],
          ["Measure the arm's reach", 2, "16:30"],
          ["Fix the CAD from the measurements", 4, "16:00"],
          ["Full intake test with the team", 6, "10:00"],
        ].map(([title, day, time]) => ({ op: "add_task" as const, title: String(title), date: addDaysYMD(today, Number(day)), time: String(time), commitment: "flexible" as const, plan_id: "p1" })),
        { op: "update_plan" as const, plan_id: "p1", notes: `Intake arm for regionals
Round — 2 · started ${today}` },
      ],
    }),
    [at, today]
  );
  return <RoundReviewSheet open onClose={() => {}} projectId="p1" onChanged={() => {}} sample={sample} />;
}

function ColorPickerSample() {
  const plan = SAMPLE_STATE.plans[0];
  return (
    <section className="project-side" style={{ maxWidth: 360, margin: "24px auto" }}>
      <ColorPicker planId={plan.id} color={plan.color} onChanged={() => {}} />
    </section>
  );
}

/** "Grill until enough": the SAT example's three steps, then the check-in. */
function GrillSample() {
  const [step, setStep] = useState(0);
  const steps = [
    { card: { id: "slot:hoursPerWeek", question: "How many hours a week can you give this?", options: ["1–2", "3–5", "6–10", "10+"], assume: "about 3 hours a week" }, score: 0.4, checkIn: false },
    { card: { id: "slot:preferredWorkTimes", question: "When do you usually like to work?", options: ["Mornings", "After school", "Evenings", "Weekends"], multi: true }, score: 0.6, checkIn: false },
    { card: { id: "checkIn", question: "Want to keep going or plan now?", options: ["Keep going", "Plan now"] }, score: 0.6, checkIn: true },
  ];
  const s = steps[step % steps.length];
  const next = () => setStep((n) => n + 1);
  return (
    <section className="add-asking" style={{ maxWidth: 520, margin: "24px auto", padding: "0 16px" }}>
      <SlotQuestionCard key={step} card={s.card} score={s.score} checkIn={s.checkIn} onAnswer={next} onSkip={next} onStop={() => setStep(0)} onKeepGoing={next} />
    </section>
  );
}

/** The daily follow-up bubble with a sample question (the API isn't reachable here). */
function FollowUpSample() {
  useEffect(() => {
    const q = followUpById("fuSlipFreeze", []);
    try {
      window.localStorage.setItem(followUpStorageKey("anonymous"), JSON.stringify({ v: 1, day: null, current: q, asked: [] }));
    } catch {}
    const t = window.setTimeout(() => window.dispatchEvent(new Event(GET_TO_KNOW_EVENT)), 300);
    return () => window.clearTimeout(t);
  }, []);
  return <TodayHome />;
}

/** Round 5A Phase 6: sample notifications for the bell (the API isn't
 *  reachable here). Three single overdue items show the merge into "Six
 *  tasks are overdue". Times are relative to now. */
function sampleNotifications(): Notification[] {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const n = (id: string, min: number, type: Notification["type"], title: string, body: string, extra: Partial<Notification> = {}): Notification => ({
    id, timestamp: ago(min), type, title, body, read: false, dismissed: false, ...extra,
  });
  return [
    n("n1", 4, "reschedule_offer", "Move Reel post task", "Tomorrow is packed. Move \"Post the Reel\" to Thursday at 4:30 PM?", { actionLabel: "Move it" }),
    n("n2", 38, "upcoming_deadline", "Reel analytics due tomorrow", "Nothing is planned for it yet. Add 30 minutes of prep today?", { actionLabel: "Add prep time" }),
    n("n3", 95, "overdue_task", "Six tasks are overdue", "The oldest is \"Outline the history essay\" from Monday."),
    n("n4", 100, "overdue_task", "\"Outline the history essay\" is overdue", "It was due Monday."),
    n("n5", 101, "overdue_task", "\"Chem lab write-up\" is overdue", "It was due Tuesday."),
    n("n6", 60 * 26, "proactive_suggestion", "Thursday looks light", "You could get ahead on the robotics CAD.", { read: true }),
    n("n7", 60 * 24 * 3, "upcoming_deadline", "SAT practice test on Saturday", "You planned two review sessions before it.", { read: true }),
  ];
}

/** The settings layout doesn't apply under /dev, so each page gets the frame here. */
function framed(Inner: React.ComponentType): React.ComponentType {
  return function Framed() {
    return <SettingsFrame><Inner /></SettingsFrame>;
  };
}

const PAGES: Record<string, React.ComponentType> = {
  today: TodayHome,
  calendar: CalendarPage,
  projects: ProjectsPage,
  project: function SampleProject() {
    return <ProjectView id="p1" />;
  },
  school: SchoolPage,
  tasks: AllTasksPage,
  settings: framed(SettingsPage),
  "settings-account": framed(AccountSettings),
  "settings-security": framed(SecuritySettingsPage),
  "settings-schedule": framed(ScheduleSettings),
  "settings-notifications": framed(NotificationSettings),
  "settings-context": framed(ContextSettings),
  "settings-activity": framed(ActivitySettings),
  "settings-data": framed(DataSettings),
  tangents: TangentsPage,
  paths: TangentsPage,
  preview: PreviewCalendarSample,
  draft: DraftSample,
  color: ColorPickerSample,
  "round-review": function RoundReviewFirst() {
    return <RoundReviewSample at={0} />;
  },
  "round-review-start": function RoundReviewLast() {
    return <RoundReviewSample at={3} />;
  },
  grill: GrillSample,
  "review-mockup": ReviewMockup,
  followup: FollowUpSample,
  setup: function SetupSample() {
    return <FirstRun onComplete={() => {}} />;
  },
};

/** /dev/app/notifications (sample list) and /dev/app/notifications-empty: the
 *  Today page with the bell fed from SampleNotificationsContext. */
const NOTIFICATION_PAGES: Record<string, () => Notification[]> = {
  notifications: sampleNotifications,
  "notifications-empty": () => [],
};

/** /dev/app/settings-context (-dense): What Tangent knows with sample facts. */
const KNOWS_PAGES: Record<string, () => typeof SAMPLE_KNOWS> = {
  "settings-context": () => SAMPLE_KNOWS,
  "settings-context-dense": denseKnows,
};

export default function AppPreview() {
  const { page } = useParams<{ page: string }>();
  const notifSample = useMemo(() => NOTIFICATION_PAGES[page]?.() ?? null, [page]);
  const knowsSample = useMemo(() => KNOWS_PAGES[page]?.() ?? null, [page]);
  if (process.env.NODE_ENV !== "development") notFound();
  const Page = notifSample ? TodayHome : page === "settings-context-dense" ? PAGES["settings-context"] : PAGES[page];
  if (!Page) notFound();
  return (
    <PipelineFlagProvider value={false}>
      <MockAppStateProvider state={SAMPLE_STATE}>
        <MotionProvider>
          <SampleNotificationsContext.Provider value={notifSample}>
            <SampleKnowsContext.Provider value={knowsSample}>
              <AppShell>
                <main id="main-content">
                  <Page />
                </main>
              </AppShell>
            </SampleKnowsContext.Provider>
          </SampleNotificationsContext.Provider>
          <TaskDetail />
          <DraftDock />
        </MotionProvider>
      </MockAppStateProvider>
    </PipelineFlagProvider>
  );
}
