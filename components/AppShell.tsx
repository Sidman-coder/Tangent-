"use client";

import StorageStatus from "@/components/StorageStatus";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as m from "motion/react-m";
import { pageEnter } from "@/lib/motion";
import { CalendarDays, FolderKanban, Home, MessageSquareText, Mic, Plus, Settings, type LucideIcon } from "lucide-react";
import NotificationBell, { NotificationBellButton } from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import GetToKnowYou, { GET_TO_KNOW_EVENT } from "./GetToKnowYou";
import FirstRun from "./FirstRun";
import TangentLogo from "@/components/TangentLogo";
import DesktopNotifPrompt from "./DesktopNotifPrompt";
import { useAppState, useUserTimezone } from "./AppStateProvider";
import { getUserToday } from "@/lib/time";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import { readSetAside, SET_ASIDE_EVENT } from "@/lib/today-local";
import { planSeriesColor } from "@/lib/task-colors";
import { requestHomeIntent, type HomeIntent } from "@/lib/home-intent";

// docs/design/TANGENT-STYLE.md §8 Nav. Four places you work, plus Settings.
// Tangents has no link (v3: not part of the core loop); /tangents still works.
type NavLink = { href: string; label: string; icon: LucideIcon };
const PLACES: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/ai", label: "Chats", icon: MessageSquareText },
];
const SETTINGS: NavLink = { href: "/settings", label: "Settings", icon: Settings };
const TABS: NavLink[] = [...PLACES, SETTINGS];

const SIDEBAR_PROJECTS = 8;
// The phone mic button sits only where there's no composer of its own.
const FAB_PATHS = new Set(["/calendar", "/projects"]);

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Coming in from the capture home ("Open app"), the chrome eases in instead
  // of appearing at once (.shell.is-arriving in app/styles/shell.css).
  const lastPath = useRef(pathname);
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    const from = lastPath.current;
    lastPath.current = pathname;
    if (from !== "/capture" || pathname === "/capture") return;
    setArriving(true);
    const t = window.setTimeout(() => setArriving(false), 700);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // One NotificationBell holds the data; the sidebar and the phone top bar
  // each draw a button for it, and CSS shows the one that fits.
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const toggleNotifs = useCallback(() => setNotifOpen((o) => !o), []);

  const { state, refresh } = useAppState();
  const tz = useUserTimezone();
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
    const zone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    void fetch(`/api/canvas/connect?ifStale=6&tz=${zone}`)
      .then((res) => res.json())
      .then((data: { added?: number; updated?: number }) => {
        // A re-sync that brought anything in should show it without a reload.
        if ((data.added ?? 0) + (data.updated ?? 0) > 0) void refresh();
      })
      .catch(() => {});
    // Once, on load: re-running on every refresh identity change would re-sync
    // in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Home's count: what's still open today, as Home itself lists it (school
  // blocks aren't to-dos; Not today takes a step off today's list).
  const today = getUserToday(tz);
  const [asideTick, setAsideTick] = useState(0);
  useEffect(() => {
    const bump = () => setAsideTick((n) => n + 1);
    window.addEventListener(SET_ASIDE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(SET_ASIDE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  const tasks = state?.tasks;
  const [openToday, setOpenToday] = useState(0);
  useEffect(() => {
    const aside = readSetAside(today);
    setOpenToday(
      (tasks ?? []).filter((t) => t.date === today && !t.completed && !isOnboardingSchoolTask(t) && !aside.has(t.id)).length,
    );
  }, [tasks, today, asideTick]);

  // The newest projects, each with how much of it is done.
  const plans = state?.plans;
  const projects = useMemo(() => {
    const list = (plans ?? []).slice(-SIDEBAR_PROJECTS).reverse();
    return list.map((plan) => {
      const steps = (tasks ?? []).filter((t) => t.planId === plan.id);
      const done = steps.filter((t) => t.completed).length;
      return {
        id: plan.id,
        title: plan.title,
        color: planSeriesColor(plan),
        done,
        total: steps.length,
        pct: steps.length ? Math.round((done / steps.length) * 100) : 0,
      };
    });
  }, [plans, tasks]);

  // Name comes from the student's profile (profiles.display_name).
  const profileName = state?.user.displayName?.trim() ?? "";
  const profileInitial = (profileName || "T").charAt(0).toUpperCase();

  // "New" focuses Home's composer; the phone mic button starts it listening.
  const goHome = useCallback(
    (intent: HomeIntent) => {
      requestHomeIntent(intent);
      if (window.location.pathname !== "/") router.push("/");
    },
    [router],
  );

  const firstRun = showOnboarding && (
    <FirstRun
      onComplete={async () => {
        await refresh();
        setShowOnboarding(false);
        // Setup as a conversation: right after the form, Tangent asks.
        window.dispatchEvent(new Event(GET_TO_KNOW_EVENT));
      }}
    />
  );

  // The capture home (/capture) is the whole screen: just the list and the mic
  // island. No sidebar, bars or mic button; "Open app" leads in.
  if (pathname === "/capture") {
    return (
      <div className="shell is-bare">
        {children}
        <CommandPalette />
        <GetToKnowYou />
        {firstRun}
      </div>
    );
  }

  const count = (href: string) => (href === "/" && openToday > 0 ? openToday : null);

  return (
    <div className={arriving ? "shell is-arriving" : "shell"}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="app-sidebar" aria-label="Sidebar">
        <Link href="/" className="app-brand" aria-label="Tangent, go to Home">
          <TangentLogo size={28} />
          <span className="app-brand-word">Tangent</span>
        </Link>

        <button
          type="button"
          className="app-new"
          onClick={() => goHome("focus")}
          aria-label="New: add to Tangent"
          data-tooltip="New"
          data-tooltip-side="right"
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="app-nav-label">New</span>
        </button>

        <nav className="app-sidebar-nav" aria-label="Main">
          {PLACES.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const n = count(href);
            return (
              <Link
                key={href}
                href={href}
                className="app-nav-item"
                aria-current={active ? "page" : undefined}
                data-tooltip={label}
                data-tooltip-side="right"
              >
                <span className="app-nav-icon">
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="app-nav-label">{label}</span>
                {n !== null && (
                  <span className="app-nav-count">
                    {n}
                    <span className="ui-visually-hidden"> open today</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {projects.length > 0 && (
          <section className="app-sidebar-projects" aria-labelledby="app-sidebar-projects-heading">
            <h2 id="app-sidebar-projects-heading" className="app-sidebar-heading">Projects</h2>
            <ul>
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="app-project-item"
                    aria-current={pathname === `/projects/${p.id}` ? "page" : undefined}
                  >
                    <span className="app-project-dot" style={{ "--dot": p.color } as CSSProperties} aria-hidden="true" />
                    <span className="app-project-name">{p.title}</span>
                    <span
                      className="app-project-pie"
                      style={{ "--pct": p.pct } as CSSProperties}
                      role="img"
                      aria-label={p.total ? `${p.done} of ${p.total} done` : "No steps yet"}
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/projects" className="app-project-all">All projects</Link>
          </section>
        )}

        <div className="app-sidebar-bottom">
          <NotificationBellButton variant="sidebar" unread={unread} expanded={notifOpen} onClick={toggleNotifs} />
          <Link
            href={SETTINGS.href}
            className="app-nav-item"
            aria-current={isActive(pathname, SETTINGS.href) ? "page" : undefined}
            data-tooltip={SETTINGS.label}
            data-tooltip-side="right"
          >
            <span className="app-nav-icon">
              <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="app-nav-label">{SETTINGS.label}</span>
          </Link>
          <Link
            href="/settings/account"
            className="app-user"
            aria-label={`${profileName || "Your account"}: account settings`}
            data-tooltip="Account"
            data-tooltip-side="right"
          >
            <span className="app-user-avatar" aria-hidden="true">{profileInitial}</span>
            <span className="app-user-name">{profileName || "Your account"}</span>
          </Link>
        </div>
      </aside>

      <header className="app-topbar">
        <Link href="/" className="app-brand" aria-label="Tangent, go to Home">
          <TangentLogo size={28} />
          <span className="app-brand-word">Tangent</span>
        </Link>
        <NotificationBellButton variant="top" unread={unread} expanded={notifOpen} onClick={toggleNotifs} />
      </header>

      <div className="shell-main">
        <div className="app-status">
          <StorageStatus />
        </div>
        <div className="shell-content">
          <m.div key={pathname} className="content-inner" {...pageEnter}>
            {children}
          </m.div>
        </div>
      </div>

      <nav className="app-tabbar" aria-label="Main">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="app-tab"
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            <span className="app-tab-icon">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="app-tab-label">{label}</span>
          </Link>
        ))}
      </nav>

      {FAB_PATHS.has(pathname) && (
        <button type="button" className="app-fab" onClick={() => goHome("listen")} aria-label="Say it to Tangent">
          <Mic size={24} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}

      <NotificationBell open={notifOpen} onOpenChange={setNotifOpen} onUnreadChange={setUnread} />
      <CommandPalette />
      <GetToKnowYou />
      {!showOnboarding && <DesktopNotifPrompt />}

      {firstRun}
    </div>
  );
}
