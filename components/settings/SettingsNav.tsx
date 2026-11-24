"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Bell, CalendarClock, ChevronRight, Database, History, KeyRound, LifeBuoy, Lightbulb, UserRound, type LucideIcon } from "lucide-react";
import type { SettingsPage } from "@/lib/settings/routes";
import { usePipelineV2 } from "@/components/PipelineFlag";

/** Round 5B Phase 1: "What Tangent knows" leads the list and is featured.
 *  Review 2026-11-24: grouped (about you / the app / your privacy), Schedule
 *  moved up beside What Tangent knows and named "Schedule and apps", because
 *  that is where Canvas and calendars connect and nobody looks for them under
 *  "Schedule". */
type NavItem = { page: SettingsPage; label: string; description: string; icon: LucideIcon; featured?: boolean; group: string; v2Only?: boolean };
export const SETTINGS_NAV: NavItem[] = [
  { page: "context", label: "What Tangent knows", description: "The facts it plans with, and what it still wants to ask.", icon: Lightbulb, featured: true, group: "About you" },
  { page: "schedule", label: "Schedule and apps", description: "School hours, Canvas, calendars, and how much fits in a day.", icon: CalendarClock, group: "About you" },
  { page: "notifications", label: "Notifications", description: "When Tangent nudges you, and when it stays quiet.", icon: Bell, group: "The app" },
  { page: "account", label: "Account", description: "Your name, look, and signing out.", icon: UserRound, group: "The app" },
  { page: "security", label: "Security", description: "Your password and how you sign in.", icon: KeyRound, group: "The app" },
  { page: "activity", label: "AI activity", description: "Everything Tangent changed for you, with undo.", icon: History, group: "Your privacy", v2Only: true },
  { page: "data", label: "Your data", description: "Export it, see what's stored, or delete it.", icon: Database, group: "Your privacy" },
  { page: "privacy", label: "Help and privacy", description: "Where your words go, the policies, and how to reach us.", icon: LifeBuoy, group: "Your privacy" },
];

/** The sections this student can use: AI activity only shows once it is on for
 *  them, instead of a page that says "Not on for your account yet". */
function useNav(): NavItem[] {
  const v2 = usePipelineV2();
  return SETTINGS_NAV.filter((n) => !n.v2Only || v2);
}

function byGroup(items: NavItem[]): [string, NavItem[]][] {
  const out = new Map<string, NavItem[]>();
  for (const it of items) out.set(it.group, [...(out.get(it.group) ?? []), it]);
  return Array.from(out.entries());
}

export function settingsMeta(page: SettingsPage) {
  return SETTINGS_NAV.find((n) => n.page === page) ?? SETTINGS_NAV[0];
}

/** True on that section's page (and its /dev preview, /dev/app/settings-<page>). */
function isCurrent(pathname: string, page: SettingsPage) {
  return pathname === `/settings/${page}` || pathname.endsWith(`/settings-${page}`);
}

/** The Settings sections: a side list on a laptop ("sidebar"), the landing
 *  list with chevrons on a phone ("list"), and underline tabs across the top
 *  of each page on a phone ("tabs"). */
export default function SettingsNav({ variant }: { variant: "sidebar" | "list" | "tabs" }) {
  const pathname = usePathname();
  const tabsRef = useRef<HTMLElement>(null);
  const nav = useNav();
  // Keep the current tab in view when the strip scrolls sideways.
  useEffect(() => {
    if (variant !== "tabs") return;
    const current = tabsRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [variant, pathname]);
  if (variant === "tabs") {
    return (
      <nav ref={tabsRef} className="settings-tabs ui-tabs ui-tabs--underline" aria-label="Settings sections">
        {nav.map(({ page, label }) => {
          const active = isCurrent(pathname, page);
          return (
            <Link key={page} href={`/settings/${page}`} className="ui-tab" aria-current={active ? "page" : undefined}>
              <span className="ui-tab-label">{label}</span>
              {active && <span className="ui-tab-underline" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
    );
  }
  if (variant === "list") {
    return (
      <nav aria-label="Settings sections" className="settings-list-groups">
        {byGroup(nav).map(([group, items]) => (
          <section key={group} aria-label={group}>
            <h2 className="settings-list-group">{group}</h2>
            <ul className="settings-list">
              {items.map(({ page, label, description, icon: Icon }) => (
                <li key={page}>
                  <Link href={`/settings/${page}`} className="settings-list-link">
                    <Icon size={18} aria-hidden="true" />
                    <span className="settings-list-copy">
                      <strong>{label}</strong>
                      <span>{description}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className="settings-list-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    );
  }
  return (
    <nav className="settings-sidenav" aria-label="Settings sections">
      {byGroup(nav).map(([group, items], gi) => (
        <div key={group} className="settings-sidenav-group">
          {gi > 0 && <span className="settings-sidenav-label">{group}</span>}
          {items.map(({ page, label, icon: Icon, featured }) => {
            const href = `/settings/${page}`;
            const active = isCurrent(pathname, page);
            return (
              <Link key={page} href={href} className={`settings-sidenav-link${active ? " is-active" : ""}${featured ? " is-featured" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={featured ? 18 : 16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
