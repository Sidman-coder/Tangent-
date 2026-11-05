"use client";

// Development-only: a page of the app inside the real shell, with sample data
// (lib/dev/sample-state.ts), for design review without an account.
// /dev/app/today, /dev/app/calendar, /dev/app/projects, /dev/app/school, /dev/app/settings,
// /dev/app/ai, /dev/app/preview, /dev/app/color. 404s in production. API calls fail here (no session), so
// anything loaded from the server shows its empty or error state.

import { notFound, useParams } from "next/navigation";
import { MockAppStateProvider, useUserTimezone } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import AppShell from "@/components/AppShell";
import LiquidGlass from "@/components/LiquidGlass";
import TaskDetail from "@/components/TaskDetail";
import TodayHome from "@/components/today/TodayHome";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import ColorPicker from "@/components/projects/ColorPicker";
import CalendarPage from "@/app/(app)/calendar/page";
import ProjectsPage from "@/app/(app)/projects/page";
import SchoolPage from "@/app/(app)/projects/school/page";
import SettingsPage from "@/app/(app)/settings/page";
import AiPage from "@/app/(app)/ai/page";
import { SAMPLE_STATE } from "@/lib/dev/sample-state";
import { addDaysYMD, getUserToday } from "@/lib/time";

function PreviewCalendarSample() {
  const today = getUserToday(useUserTimezone());
  return (
    <section className="preview-card" style={{ maxWidth: 680, margin: "24px auto" }}>
      <h1 className="preview-card-title">Robotics plan preview</h1>
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

const PAGES: Record<string, React.ComponentType> = {
  today: TodayHome,
  calendar: CalendarPage,
  projects: ProjectsPage,
  school: SchoolPage,
  settings: SettingsPage,
  ai: AiPage,
  preview: PreviewCalendarSample,
  color: ColorPickerSample,
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
          <LiquidGlass />
          <TaskDetail />
        </MotionProvider>
      </MockAppStateProvider>
    </PipelineFlagProvider>
  );
}
