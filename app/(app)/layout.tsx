import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import FeatureTour from "@/components/FeatureTour";
import TaskDetail from "@/components/TaskDetail";
import TaskChatSheet from "@/components/chat/TaskChatSheet";
import RecentChanges from "@/components/RecentChanges";
import UndoToast from "@/components/UndoToast";

// Signed-in app chrome. Sign-in, waitlist and under-13 pages live outside this group
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
          <TaskDetail />
          <TaskChatSheet />
          <RecentChanges />
          <UndoToast />
        </MotionProvider>
      </AppStateProvider>
    </PipelineFlagProvider>
  );
}
