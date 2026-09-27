import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/figtree";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";

export const metadata: Metadata = {
  title: "Tangent",
  description: "A focused productivity workspace for students to plan their time and follow through.",
};

// Runs before the first paint, so a dark workspace opens dark. Applying the
// theme from an effect meant every load flashed the light palette first, and
// the browser chrome (scrollbars, form controls, the overscroll gutter) stayed
// light for the whole session. Kept deliberately small and dependency-free —
// anything slow here delays the first paint for everyone.
//
// An unset preference still resolves to light, matching setTheme's default;
// this only removes the flash, it does not change which theme you get.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("tangent-theme");t=t==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#13111d":"#f5f3fa");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f5f3fa" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
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
