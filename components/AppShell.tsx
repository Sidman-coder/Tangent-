"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckSquare2,
  Home,
  Spline,
  MessageSquareText,
  Search,
  Settings,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import FirstRun from "./FirstRun";
import TangentLogo from "@/components/TangentLogo";
import DesktopNotifPrompt from "./DesktopNotifPrompt";

const NAV_LINKS = [
  {
    href: "/",
    label: "Today",
    icon: Home,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare2,
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
  },
  {
    href: "/path",
    label: "Path",
    icon: Spline,
  },
  {
    href: "/ai",
    label: "Tangent AI",
    icon: MessageSquareText,
  },
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

  const profileInitial = (profileName || "T").charAt(0).toUpperCase();

  const openPalette = () => window.dispatchEvent(new Event("tangent:open-palette"));

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
