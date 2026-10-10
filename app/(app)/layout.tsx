import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { PipelineFlagProvider } from "@/components/PipelineFlag";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";

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
        </MotionProvider>
      </AppStateProvider>
    </PipelineFlagProvider>
  );
}
