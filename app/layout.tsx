import { SERIES_CSS } from "@/lib/task-colors";
import type { Metadata, Viewport } from "next";
// Tokens first: every stylesheet after this reads them and none redefines them.
import "./styles/tokens.css";
// Self-hosted type (docs/design/TANGENT-STYLE.md §4): Bricolage Grotesque for
// display, Figtree for everything you read, IBM Plex Mono for keyboard chips.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/figtree/wght.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "@/components/ui/ui.css";
import "./styles/shell.css";
import "./styles/controls.css";

export const metadata: Metadata = {
  title: "Tangent",
  description: "A focused productivity workspace for students to plan their time and follow through.",
  // Added to a home screen, open full-screen like an app. `appleWebApp.capable`
  // emitted the deprecated apple-mobile-web-app-capable meta; the standard
  // name is set below and Apple keeps the title and status-bar style.
  appleWebApp: { title: "Tangent", statusBarStyle: "default" },
  other: { "mobile-web-app-capable": "yes" },
};

// viewport-fit=cover makes env(safe-area-inset-*) real on notched phones. The
// bottom bar, capture mode and sheets already pad with it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The on-screen keyboard shrinks the layout instead of covering it, so chat
  // composers and sheets stay above it.
  interactiveWidget: "resizes-content",
};

// Runs before the first paint, so a dark workspace opens dark. Applying the
// theme from an effect meant every load flashed the light palette first, and
// the browser chrome (scrollbars, form controls, the overscroll gutter) stayed
// light for the whole session. Kept deliberately small and dependency-free —
// anything slow here delays the first paint for everyone.
//
// An unset preference still resolves to light, matching setTheme's default;
// this only removes the flash, it does not change which theme you get.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("tangent-theme");t=t==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#121119":"#f7f6fb");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f7f6fb" />
        <style dangerouslySetInnerHTML={{ __html: SERIES_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {/* App chrome lives in app/(app)/layout.tsx, so sign-in pages don't mount it. */}
        {children}
      </body>
    </html>
  );
}
