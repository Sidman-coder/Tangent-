import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import FeatureTour from "@/components/FeatureTour";
import LiquidGlass from "@/components/LiquidGlass";
import TaskDetail from "@/components/TaskDetail";
import RecentChanges from "@/components/RecentChanges";
import UndoToast from "@/components/UndoToast";

// Signed-in app chrome. Sign-in and invite-only pages live outside this group
// so they don't mount the shell or start polling student data.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PipelineFlagProvider value={TANGENT_PIPELINE_V2}>
      <AppStateProvider>
        <MotionProvider>
          <AppShell>
            <main id="main-content">{children}</main>
          </AppShell>
          {/* Outside AppShell so they survive the Tangents takeover. */}
          <FeatureTour />
          <LiquidGlass />
          <TaskDetail />
          <RecentChanges />
          <UndoToast />
        </MotionProvider>
      </AppStateProvider>
    </PipelineFlagProvider>
  );
}
