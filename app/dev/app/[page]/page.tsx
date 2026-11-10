"use client";

// Development-only: a page of the app inside the real shell, with sample data
// (lib/dev/sample-state.ts), for design review without an account.
// /dev/app/today, /dev/app/calendar, /dev/app/projects, /dev/app/project, /dev/app/school, /dev/app/settings, /dev/app/settings-account (…-security, -schedule,
// -notifications, -context, -activity, -data),
// /dev/app/tangents, /dev/app/preview, /dev/app/color, /dev/app/grill. 404s in production. API calls fail here (no session), so
// anything loaded from the server shows its empty or error state.

import { notFound, useParams } from "next/navigation";
import { MockAppStateProvider, useUserTimezone } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import AppShell from "@/components/AppShell";
import TaskDetail from "@/components/TaskDetail";
import TodayHome from "@/components/today/TodayHome";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import ColorPicker from "@/components/projects/ColorPicker";
import SlotQuestionCard from "@/components/grill/SlotQuestionCard";
import { useState } from "react";
import CalendarPage from "@/app/(app)/calendar/page";
import ProjectsPage from "@/app/(app)/projects/page";
import SchoolPage from "@/app/(app)/projects/school/page";
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
  color: ColorPickerSample,
  grill: GrillSample,
};

export default function AppPreview() {
  const { page } = useParams<{ page: string }>();
  if (process.env.NODE_ENV !== "development") notFound();
  const Page = PAGES[page];
  if (!Page) notFound();
  return (
    <PipelineFlagProvider value={false}>
      <MockAppStateProvider state={SAMPLE_STATE}>
        <MotionProvider>
          <AppShell>
            <main id="main-content">
              <Page />
            </main>
          </AppShell>
          <TaskDetail />
        </MotionProvider>
      </MockAppStateProvider>
    </PipelineFlagProvider>
  );
}
