"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Home,
  Spline,
  ArrowUpRight,
  MessageSquareText,
  Search,
  Settings,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import FirstRun from "./FirstRun";
import TangentLogo from "@/components/TangentLogo";
import DesktopNotifPrompt from "./DesktopNotifPrompt";

// Three places you work, plus settings. Tasks used to be its own page; it only
// ever showed today, which Today already does, and everything else about a task
// belongs on the day it falls on. Tangents is deliberately not in this list: it
// is a mode, not a page, and it gets its own door at the bottom of the rail.
const NAV_LINKS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/ai", label: "Tangent AI", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profileName, setProfileName] = useState("");
  const today = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  useEffect(() => {
    const update = () => setEstTime(estTimeFor(new Date()));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("tangent-onboarded") !== "true") {
      setShowOnboarding(true);
    }
    const savedName = localStorage.getItem("tangent-user-name")?.trim();
    if (savedName) setProfileName(savedName);
  }, []);

  // Canvas used to update only when someone pressed a button, so a connected
  // feed went stale immediately. This asks the server to re-sync if it has been
  // more than six hours; the server no-ops otherwise, and a daily cron covers
  // anyone who never opens the app.
  useEffect(() => {
    void fetch("/api/canvas/connect?ifStale=6").catch(() => {});
  }, []);

  const profileInitial = (profileName || "T").charAt(0).toUpperCase();

  const openPalette = () => window.dispatchEvent(new Event("tangent:open-palette"));

  // Tangents takes over the window. Returning children bare rather than hiding
  // the chrome with CSS keeps the rail and topbar out of the tree entirely, so
  // nothing in them can catch a pointer or a tab stop over the canvas.
  if (pathname.startsWith("/tangents")) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <aside className="rail" aria-label="Primary navigation">
        <Link href="/" className="rail-logo" aria-label="Tangent home">
          <TangentLogo />
          <span className="rail-logo-word">Tangent</span>
        </Link>

        <nav className="rail-nav" aria-label="Primary">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "rail-btn is-active" : "rail-btn"}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span className="rail-btn-label">{label}</span>
                <span className="rail-tooltip">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-spacer" />

        {/* Tangents is a mode, not a page, so its entry is deliberately unlike
            a nav row: its own block, its own surface, and it leaves the app
            behind when you take it. */}
        <Link href="/tangents" className="rail-tangents" aria-label="Work on your tangents">
          <Spline size={17} aria-hidden="true" />
          <span className="rail-tangents-copy">
            <strong>Work on your</strong>
            <span>tangents</span>
          </span>
          <ArrowUpRight size={15} className="rail-tangents-arrow" aria-hidden="true" />
        </Link>

        <div className="rail-footer">
          <Link href="/settings" className="rail-profile" aria-label="Open account settings">
            <span className="rail-profile-avatar" aria-hidden="true">{profileInitial}</span>
            <span className="rail-profile-copy">
              <strong>{profileName || "Your workspace"}</strong>
              <span>Settings</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
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
            <button type="button" className="topbar-search" onClick={openPalette} aria-label="Search and capture">
              <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} />
            <Link href="/settings" className="topbar-avatar" aria-label="Open account settings">
              {profileInitial}
            </Link>
          </div>
        </header>

        {/* Path is a full-bleed instrument: it sets its own ground and needs the
            whole area, so it opts out of the padded, max-width content column. */}
        <div className={`shell-content${pathname === "/path" ? " is-bleed" : ""}`}>
          <div className="content-inner">{children}</div>
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Primary mobile navigation">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "mobile-nav-link is-active" : "mobile-nav-link"}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <CommandPalette />
      {!showOnboarding && <DesktopNotifPrompt />}

      {showOnboarding && <FirstRun onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}
