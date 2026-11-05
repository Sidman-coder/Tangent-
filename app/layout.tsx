import { SERIES_CSS } from "@/lib/task-colors";
import type { Metadata, Viewport } from "next";
// Body type is the platform's own (SF Pro on Apple devices); Tangent's display
// face, Bricolage Grotesque, is kept for big titles — the brand's voice.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";
import "./liquid-glass.css";

export const metadata: Metadata = {
  title: "Tangent",
  description: "A focused productivity workspace for students to plan their time and follow through.",
  // Added to an iPhone home screen, open full-screen like an app.
  appleWebApp: { capable: true, title: "Tangent", statusBarStyle: "default" },
};

// viewport-fit=cover makes env(safe-area-inset-*) real on notched phones. The
// bottom bar, capture mode and sheets already pad with it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before the first paint, so a dark workspace opens dark. Applying the
// theme from an effect meant every load flashed the light palette first, and
// the browser chrome (scrollbars, form controls, the overscroll gutter) stayed
// light for the whole session. Kept deliberately small and dependency-free —
// anything slow here delays the first paint for everyone.
//
// An unset preference still resolves to light, matching setTheme's default;
// this only removes the flash, it does not change which theme you get.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("tangent-theme");t=t==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0e0d14":"#f5f4f9");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f5f4f9" />
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
