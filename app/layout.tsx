import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import { ThemeInit } from "@/components/ThemeInit";

export const metadata: Metadata = {
  title: "Tangent",
  description: "A focused productivity workspace for students to plan their time and follow through.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeInit />
        <AppStateProvider>
          <MotionProvider>
            <AppShell>
              <main id="main-content">{children}</main>
            </AppShell>
          </MotionProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
