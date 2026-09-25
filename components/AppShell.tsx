"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarSync,
  CheckSquare2,
  Home,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import FirstRun from "./FirstRun";
import CanvasConnectGuide from "./CanvasConnectGuide";
import VoiceCaptureFab from "./VoiceCaptureFab";
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
    href: "/ai",
    label: "Tangent AI",
    icon: MessageSquareText,
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Today",
  "/calendar": "Calendar",
  "/tasks": "Tasks",
  "/ai": "Tangent AI",
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profileInitial, setProfileInitial] = useState("T");
  const [canvasGuideOpen, setCanvasGuideOpen] = useState(false);
  const title = pageTitleFor(pathname);
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
    if (savedName) setProfileInitial(savedName.charAt(0).toUpperCase());
  }, []);

  const openPalette = () => window.dispatchEvent(new Event("tangent:open-palette"));

  return (
    <div className="shell">
      <aside className="rail" aria-label="Primary navigation">
        <Link href="/" className="rail-logo" aria-label="Tangent home">
          <span className="rail-logo-mark" aria-hidden="true">T</span>
          <span className="rail-logo-word">Tangent</span>
        </Link>

        <button
          type="button"
          className="rail-capture-btn"
          title="Ask TANGENT (⌘K)"
          aria-label="Ask TANGENT"
          onClick={openPalette}
        >
          <span className="rail-capture-icon"><Sparkles size={18} strokeWidth={1.75} /></span>
          <span className="rail-capture-label">Capture</span>
          <kbd className="rail-capture-key">⌘K</kbd>
        </button>

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
              <strong>My workspace</strong>
              <span>Student plan</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-context">
            <span className="topbar-eyebrow">Workspace</span>
            <span className="topbar-title">{title}</span>
          </div>
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
            <button type="button" className="topbar-new-task" onClick={openPalette}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              <span>New task</span>
            </button>
            <button
              type="button"
              className="topbar-canvas-connect"
              onClick={() => setCanvasGuideOpen(true)}
              aria-label="Connect Canvas calendar"
              title="Connect Canvas calendar"
            >
              <CalendarSync size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Connect Canvas</span>
            </button>
            <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} />
            <Link href="/settings" className="topbar-avatar" aria-label="Open account settings">
              {profileInitial}
            </Link>
          </div>
        </header>

        <div className="shell-content">
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
      <CanvasConnectGuide open={canvasGuideOpen} onClose={() => setCanvasGuideOpen(false)} />
      {/* The AI console has its own mic in the composer; the FAB would cover Send. */}
      {pathname !== "/ai" && <VoiceCaptureFab />}
      {!showOnboarding && <DesktopNotifPrompt />}

      {showOnboarding && <FirstRun onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}
