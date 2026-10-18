"use client";

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
  MessageSquareText,
  Mic,
  Settings,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";
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


export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  // One bell at a time: in the sidebar on desktop, in the top bar on a phone.
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // Hick's Law: one mic in view at a time. A page that leads with its own
  // composer (Today) marks it [data-primary-composer]; while that's on screen
  // the floating mic would be a second, identical choice, so it steps back.
  const [composerInView, setComposerInView] = useState(false);
  useEffect(() => {
    setComposerInView(false);
    let observer: IntersectionObserver | null = null;
    const attach = () => {
      const el = document.querySelector("[data-primary-composer]");
      if (!el) return false;
      observer = new IntersectionObserver(([entry]) => setComposerInView(entry.isIntersecting), { threshold: 0.2 });
      observer.observe(el);
      return true;
    };
    // The page renders after the shell; retry briefly until it mounts.
    let tries = 0;
    const timer = window.setInterval(() => {
      if (attach() || ++tries > 20) window.clearInterval(timer);
    }, 100);
    return () => { window.clearInterval(timer); observer?.disconnect(); };
  }, [pathname]);
  const { state, refresh } = useAppState();
  const refreshState = refresh;
  const [showOnboarding, setShowOnboarding] = useState(false);


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

  const openListening = () => window.dispatchEvent(new CustomEvent("tangent:open-palette", { detail: { listen: true } }));

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="rail lg lg-interactive" aria-label="Primary navigation">
        <Link href="/" className="rail-logo" aria-label="Tangent home">
          <TangentLogo />
          <span className="rail-logo-word">Tangent</span>
        </Link>

        <nav className="rail-nav" aria-label="Primary">
          {NAV_LINKS.filter((l) => l.href !== "/tangents" && l.href !== "/settings").map(({ href, label, icon: Icon }) => {
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


        {desktop && <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} placement="rail" />}

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
            <StorageStatus />
            {!desktop && <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} />}
          </div>
        </header>

        <div className="shell-content">
          <m.div key={pathname} className="content-inner" {...pageEnter}>
            {children}
          </m.div>
        </div>
      </div>

      <nav className="mobile-nav lg" aria-label="Primary mobile navigation">
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

      {/* The mic floats bottom-right on every page: say anything, from
          anywhere; it opens Add already listening. (⌘K opens it to type.)
          Not on Tangent AI, whose own composer mic talks to the chat. */}
      {!pathname.startsWith("/ai") && !composerInView && (
        <button type="button" className="float-mic lg lg-interactive" onClick={openListening} aria-label="Say it to Tangent" title="Say it  ·  ⌘K to type">
          <Mic size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      <CommandPalette />
      <GetToKnowYou />
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
