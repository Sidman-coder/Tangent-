"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";

const NAV_LINKS = [
  {
    href: "/",
    label: "Today",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /><path d="M3 12v9h18v-9" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/ai",
    label: "Console",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 014 4v1h1a3 3 0 010 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 010-6h1V6a4 4 0 014-4z" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const BELL_ICON = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SETTINGS_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const PAGE_TITLES: Record<string, string> = {
  "/": "Today",
  "/calendar": "Calendar",
  "/tasks": "Tasks",
  "/ai": "Console",
  "/settings": "Settings",
};

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] ?? "TANGENT";
}

const EST_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function estTimeFor(d: Date): string {
  return `${EST_TIME_FORMATTER.format(d)} EST`;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [estTime, setEstTime] = useState<string | null>(null);
  const title = pageTitleFor(pathname);
  const today = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  useEffect(() => {
    const update = () => setEstTime(estTimeFor(new Date()));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="shell">
      <aside className="rail" aria-label="Primary navigation">
        <Link href="/" className="rail-logo" aria-label="Tangent home">
          T
        </Link>

        <button
          type="button"
          className="rail-capture-btn"
          title="Ask TANGENT (⌘K)"
          aria-label="Ask TANGENT"
          onClick={() => window.dispatchEvent(new Event("tangent:open-palette"))}
        >
          <span className="rail-capture-icon"><Sparkles size={18} strokeWidth={1.75} /></span>
        </button>
        <div className="rail-capture-divider" aria-hidden />

        <nav className="rail-nav" aria-label="Primary">
          {NAV_LINKS.map(({ href, label, icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "rail-btn is-active" : "rail-btn"}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                {icon}
                {active && <span className="rail-btn-dot" aria-hidden="true" />}
                <span className="rail-tooltip">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-spacer" />

        <div className="rail-bottom">
          <button
            type="button"
            className="rail-btn"
            aria-label="Notifications"
            onClick={() => setNotifOpen((o) => !o)}
          >
            {BELL_ICON}
            <span className="rail-tooltip">Notifications</span>
          </button>
          <Link
            href="/settings"
            className={pathname.startsWith("/settings") ? "rail-btn is-active" : "rail-btn"}
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            aria-label="Settings"
          >
            {SETTINGS_ICON}
            {pathname.startsWith("/settings") && <span className="rail-btn-dot" aria-hidden="true" />}
            <span className="rail-tooltip">Settings</span>
          </Link>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <span className="topbar-datetime">
              <span className="topbar-date">{today}</span>
              {estTime && (
                <>
                  <span className="topbar-date-sep" aria-hidden="true">·</span>
                  <span className="topbar-time">{estTime}</span>
                </>
              )}
            </span>
            <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} />
          </div>
        </header>

        <div className="shell-content">
          <div className="content-inner">{children}</div>
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
