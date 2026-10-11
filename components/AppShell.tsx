"use client";

import { browserTimezone, zoneAbbreviation } from "@/lib/time";
import StorageStatus from "@/components/StorageStatus";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { pageEnter, spring } from "@/lib/motion";
import {
  CalendarDays,
  FolderKanban,
  Home,
  LogOut,
  MessageSquareText,
  Search,
  Settings,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import CaptureDock from "./CaptureDock";
import GetToKnowYou, { GET_TO_KNOW_EVENT } from "./GetToKnowYou";
import FirstRun from "./FirstRun";
import TangentLogo from "@/components/TangentLogo";
import DesktopNotifPrompt from "./DesktopNotifPrompt";
import { useAppState } from "./AppStateProvider";

// Five places you work, plus settings. Projects is where Plans live now;
// Tangents is a main place too (it used to hide in a card at the rail's foot). Tasks used to be its own page; it only
// ever showed today, which Today already does, and everything else about a task
// belongs on the day it falls on. Tangents is deliberately not in this list: it
// is a mode, not a page, and it gets its own door at the bottom of the rail.
/** The Tangents orbit, small enough to be a nav icon: the dot keeps
 *  circling, so the feature that used to hide in a card at the bottom of the
 *  rail is a first-class place and still feels alive. */
function OrbitIcon({ size = 19 }: { size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" }) {
  return (
    <svg className="rail-orbit nav-orbit" viewBox="0 0 34 34" width={size} height={size} aria-hidden="true">
      <circle className="rail-orbit-ring" cx="17" cy="17" r="13" />
      <circle className="rail-orbit-core" cx="17" cy="17" r="4" />
      <g className="rail-orbit-spin">
        <circle className="rail-orbit-dot" cx="17" cy="4" r="3.4" />
      </g>
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tangents", label: "Tangents", icon: OrbitIcon },
  { href: "/ai", label: "Tangent AI", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** "9:30 PM EDT" in the student's own timezone (profiles.timezone). */
function clockFor(d: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${time} ${zoneAbbreviation(timeZone, d)}`;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [clock, setClock] = useState<string | null>(null);
  const { state, refresh } = useAppState();
  const refreshState = refresh;
  const [showOnboarding, setShowOnboarding] = useState(false);
  const tz = state?.user.timezone ?? browserTimezone();
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(clockFor(now, tz));
      setToday(now.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }));
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [tz]);

  // Onboarding state lives on the student's profile (profiles.onboarded_at).
  // Only opens the flow; FirstRun closes it once its answers are saved.
  const loaded = state !== null;
  const onboardedAt = state?.user.onboardedAt;
  useEffect(() => {
    if (loaded && !onboardedAt) setShowOnboarding(true);
  }, [loaded, onboardedAt]);

  // Canvas used to update only when someone pressed a button, so a connected
  // feed went stale immediately. This asks the server to re-sync if it has been
  // more than six hours; the server no-ops otherwise, and a daily cron covers
  // anyone who never opens the app.
  useEffect(() => {
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void fetch(`/api/canvas/connect?ifStale=6&tz=${tz}`)
      .then((res) => res.json())
      .then((data: { added?: number; updated?: number }) => {
        // A re-sync that brought anything in should show it without a reload.
        if ((data.added ?? 0) + (data.updated ?? 0) > 0) void refreshState();
      })
      .catch(() => {});
    // Once, on load: re-running on every refresh identity change would re-sync
    // in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Name comes from the student's profile (profiles.display_name).
  const profileName = state?.user.displayName?.trim() ?? "";
  const profileInitial = (profileName || "T").charAt(0).toUpperCase();

  const openPalette = () => window.dispatchEvent(new Event("tangent:open-palette"));

  // Tangents takes over the window. Returning children bare rather than hiding
  // the chrome with CSS keeps the rail and topbar out of the tree entirely, so
  // nothing in them can catch a pointer or a tab stop over the canvas.
  if (pathname.startsWith("/tangents")) {
    return (
      // Opacity only: a lift or blur here would move the goal card off the
      // spot the field's portal delivered it to.
      <m.div
        key={pathname}
        className="tangents-route"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.22 } }}
      >
        {children}
      </m.div>
    );
  }

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="rail" aria-label="Primary navigation">
        <Link href="/" className="rail-logo" aria-label="Tangent home">
          <TangentLogo />
          <span className="rail-logo-word">Tangent</span>
        </Link>

        <nav className="rail-nav" aria-label="Primary">
          {NAV_LINKS.filter((l) => l.href !== "/tangents").map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "rail-btn is-active" : "rail-btn"}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                {/* One pill, shared across every row: it glides to the page you
                    open instead of blinking off here and on there. */}
                {active && (
                  <m.span
                    layoutId="rail-active"
                    className="rail-active-pill"
                    transition={{ ...spring.layout, visualDuration: 0.3, bounce: 0 }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span className="rail-btn-label">{label}</span>
                <span className="rail-tooltip">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-spacer" />

        {/* Tangents sits at the foot of the rail, apart from the daily places:
            the long view, one step removed. Its orbit keeps circling. */}
        {(() => {
          const active = pathname.startsWith("/tangents");
          return (
            <Link
              href="/tangents"
              className={`rail-btn rail-btn-tangents${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label="Tangents"
            >
              {active && (
                <m.span
                  layoutId="rail-active"
                  className="rail-active-pill"
                  transition={{ ...spring.layout, visualDuration: 0.3, bounce: 0 }}
                  aria-hidden="true"
                />
              )}
              <OrbitIcon size={22} />
              <span className="rail-btn-label">Tangents</span>
              <span className="rail-tooltip">Tangents</span>
            </Link>
          );
        })()}


        <div className="rail-footer">
          <Link href="/settings" className="rail-profile" aria-label="Open account settings">
            <span className="rail-profile-avatar" aria-hidden="true">{profileInitial}</span>
            <span className="rail-profile-copy">
              <strong>{profileName || "Your workspace"}</strong>
              <span>Settings</span>
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rail-signout" aria-label="Sign out" title="Sign out">
              <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
              <span className="rail-signout-label">Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-right">
            <StorageStatus />
            <span className="topbar-datetime">
              {today && <span className="topbar-date">{today}</span>}
              {clock && (
                <>
                  <span className="topbar-date-sep" aria-hidden="true">·</span>
                  <span className="topbar-time">{clock}</span>
                </>
              )}
            </span>
            <button type="button" className="topbar-search" onClick={openPalette} aria-label="Tell Tangent">
              <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Tell Tangent</span>
              <kbd>⌘K</kbd>
            </button>
            <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} />
            <Link href="/settings" className="topbar-avatar" aria-label="Open account settings">
              {profileInitial}
            </Link>
          </div>
        </header>

        <div className="shell-content">
          <m.div key={pathname} className="content-inner" {...pageEnter}>
            {children}
          </m.div>
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
      <GetToKnowYou />
      {/* Instant capture lives on Today only. Mounted here, not in the page,
          so it is usable while Today is still loading and a recording isn't
          cut off when the loading skeleton swaps for the real page. */}
      {pathname === "/" && <CaptureDock />}
      {!showOnboarding && <DesktopNotifPrompt />}

      {showOnboarding && <FirstRun
          onComplete={async () => {
            await refresh();
            setShowOnboarding(false);
            // Setup as a conversation: right after the form, Tangent asks.
            window.dispatchEvent(new Event(GET_TO_KNOW_EVENT));
          }}
        />}
    </div>
  );
}
