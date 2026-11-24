"use client";

import StorageStatus from "@/components/StorageStatus";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as m from "motion/react-m";
import { pageEnter } from "@/lib/motion";
import { CalendarDays, ChevronRight, FolderKanban, Home, Mic, Plus, Route, Settings, type LucideIcon } from "lucide-react";
import NotificationBell, { NotificationBellButton } from "./NotificationBell";
import CommandPalette from "./CommandPalette";
import GetToKnowYou from "./GetToKnowYou";
import FirstRun from "./FirstRun";
import TangentLogo from "@/components/TangentLogo";
import DesktopNotifPrompt from "./DesktopNotifPrompt";
import { useAppState, useUserTimezone } from "./AppStateProvider";
import { getUserToday } from "@/lib/time";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import { readSetAside, SET_ASIDE_EVENT } from "@/lib/today-local";
import { planSeriesColor } from "@/lib/task-colors";
import { requestHomeIntent, type HomeIntent } from "@/lib/home-intent";
import { setCanvasSyncFailed } from "@/components/settings/useCanvasStatus";
import { recentProjectsAndTangents } from "@/lib/sidebar-recents";
import { useOpenedNow } from "@/lib/opened";
import { loadTangents, useTangents } from "@/components/tangents/useTangents";

// docs/design/TANGENT-STYLE.md §8 Nav. Four places you work, plus Settings.
// In the laptop sidebar, Projects opens and closes a list of the newest
// projects and Tangents (like a chat app's recents); only "All projects" goes
// to the Projects page, which holds both. Phones and the tablet icon rail keep
// a plain Projects link.
type NavLink = { href: string; label: string; icon: LucideIcon };
const PLACES: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];
const PROJECTS: NavLink = { href: "/projects", label: "Projects", icon: FolderKanban };
const SETTINGS: NavLink = { href: "/settings", label: "Settings", icon: Settings };
const TABS: NavLink[] = [...PLACES, PROJECTS, SETTINGS];

const RECENTS_OPEN_KEY = "tangent-sidebar-projects-open";
// The phone mic button sits only where there's no composer of its own.
const FAB_PATHS = new Set(["/calendar", "/projects"]);

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
const inProjects = (pathname: string) => isActive(pathname, "/projects") || isActive(pathname, "/tangents");

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
      .then((data: { ok?: boolean; skipped?: boolean; added?: number; updated?: number }) => {
        // The server already retried once. Still failing means one plain
        // message on School and Settings; a good sync clears it.
        if (data.skipped) return;
        setCanvasSyncFailed(data.ok === false);
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

  // The sidebar's recents: the newest projects and Tangents together. Each
  // project shows how much of it is done.
  const plans = state?.plans;
  const { paths } = useTangents();
  // Opens in this tab count at once; the server's last_opened_at covers the rest.
  const openedNow = useOpenedNow();
  const recents = useMemo(
    () =>
      recentProjectsAndTangents(plans, paths, openedNow).map((r) => {
        if (r.kind === "tangent") return { kind: r.kind, id: r.id, title: r.title, href: `/tangents/${r.id}` };
        const steps = (tasks ?? []).filter((t) => t.planId === r.id);
        const done = steps.filter((t) => t.completed).length;
        return {
          kind: r.kind,
          id: r.id,
          title: r.title,
          href: `/projects/${r.id}`,
          color: planSeriesColor(r.item),
          done,
          total: steps.length,
          pct: steps.length ? Math.round((done / steps.length) * 100) : 0,
        };
      }),
    [plans, paths, openedNow, tasks]
  );
  // A Tangent just made (or opened) should show in the list without a reload.
  useEffect(() => {
    if (pathname.startsWith("/tangents/")) void loadTangents();
  }, [pathname]);

  // Open or closed, remembered. Open until the student closes it. The slide
  // only runs once the saved state is read, so a closed list doesn't animate
  // shut on every page load.
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [recentsReady, setRecentsReady] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(RECENTS_OPEN_KEY) === "0") setRecentsOpen(false);
    } catch {}
    const raf = window.requestAnimationFrame(() => setRecentsReady(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);
  const toggleRecents = useCallback(() => {
    setRecentsOpen((open) => {
      try {
        window.localStorage.setItem(RECENTS_OPEN_KEY, open ? "0" : "1");
      } catch {}
      return !open;
    });
  }, []);
  // Closed, the list is out of the tab order and hidden from screen readers.
  const recentsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (recentsRef.current) recentsRef.current.inert = !recentsOpen;
  }, [recentsOpen]);

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
        // No second sheet right after setup (overnight C01): the first screen
        // is the add box. Tangent's follow-up question waits until the student
        // has added something of their own (see GetToKnowYou).
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
        <Link href="/capture" className="app-brand" aria-label="Tangent, go to the capture home">
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

          {/* Tablet icon rail: no room for the list, so Projects is a link. */}
          <Link
            href={PROJECTS.href}
            className="app-nav-item app-nav-projects-link"
            aria-current={inProjects(pathname) ? "page" : undefined}
            data-tooltip={PROJECTS.label}
            data-tooltip-side="right"
          >
            <span className="app-nav-icon">
              <FolderKanban size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="app-nav-label">{PROJECTS.label}</span>
          </Link>

          <button
            type="button"
            className={`app-nav-item app-nav-toggle${
              pathname === "/projects" || pathname === "/tangents" || (!recentsOpen && inProjects(pathname)) ? " is-current" : ""
            }`}
            aria-expanded={recentsOpen}
            aria-controls="app-sidebar-recents"
            onClick={toggleRecents}
          >
            <span className="app-nav-icon">
              <FolderKanban size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="app-nav-label">{PROJECTS.label}</span>
            <ChevronRight size={16} strokeWidth={1.75} className="app-nav-chevron" aria-hidden="true" />
          </button>

          <div
            ref={recentsRef}
            id="app-sidebar-recents"
            className={`app-recents${recentsOpen ? " is-open" : ""}${recentsReady ? " is-ready" : ""}`}
          >
            <div className="app-recents-inner">
              {recents.length > 0 && (
                <ul aria-label="Recent projects and Tangents">
                  {recents.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <Link
                        href={r.href}
                        className="app-project-item"
                        aria-current={pathname === r.href ? "page" : undefined}
                      >
                        {r.kind === "tangent" ? (
                          <span className="app-paths-icon" aria-hidden="true">
                            <Route size={14} strokeWidth={1.75} />
                          </span>
                        ) : (
                          <span className="app-project-dot" style={{ "--dot": r.color } as CSSProperties} aria-hidden="true" />
                        )}
                        <span className="app-project-name">{r.title}</span>
                        {r.kind === "tangent" ? (
                          <span className="ui-visually-hidden"> (Tangent)</span>
                        ) : (
                          <span
                            className="app-project-pie"
                            style={{ "--pct": r.pct } as CSSProperties}
                            role="img"
                            aria-label={r.total ? `${r.done} of ${r.total} done` : "No steps yet"}
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={PROJECTS.href} className="app-project-all" aria-current={pathname === PROJECTS.href ? "page" : undefined}>
                All projects
                <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </nav>

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
        <Link href="/capture" className="app-brand" aria-label="Tangent, go to the capture home">
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
