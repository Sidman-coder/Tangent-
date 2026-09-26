import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";

// Signed-in app chrome. Sign-in and invite-only pages live outside this group
// so they don't mount the shell or start polling student data.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <MotionProvider>
        <AppShell>
          <main id="main-content">{children}</main>
        </AppShell>
      </MotionProvider>
    </AppStateProvider>
  );
}
