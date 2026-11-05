"use client";

// Development-only: a page of the app inside the real shell, with sample data
// (lib/dev/sample-state.ts), for design review without an account.
// /dev/app/today, /dev/app/calendar, /dev/app/projects, /dev/app/school, /dev/app/settings,
// /dev/app/ai. 404s in production. API calls fail here (no session), so
// anything loaded from the server shows its empty or error state.

import { notFound, useParams } from "next/navigation";
import { MockAppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import AppShell from "@/components/AppShell";
import LiquidGlass from "@/components/LiquidGlass";
import TaskDetail from "@/components/TaskDetail";
import TodayHome from "@/components/today/TodayHome";
import CalendarPage from "@/app/(app)/calendar/page";
import ProjectsPage from "@/app/(app)/projects/page";
import SchoolPage from "@/app/(app)/projects/school/page";
import SettingsPage from "@/app/(app)/settings/page";
import AiPage from "@/app/(app)/ai/page";
import { SAMPLE_STATE } from "@/lib/dev/sample-state";

const PAGES: Record<string, React.ComponentType> = {
  today: TodayHome,
  calendar: CalendarPage,
  projects: ProjectsPage,
  school: SchoolPage,
  settings: SettingsPage,
  ai: AiPage,
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
