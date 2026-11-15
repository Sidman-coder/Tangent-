"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { Bell, ChevronRight, Database, History, KeyRound, Plug, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import type { SettingsPage } from "@/lib/settings/routes";

type NavEntry = { page: SettingsPage; label: string; description: string; icon: LucideIcon; featured?: boolean };

// Your Tangent is the main page, so it leads in violet; Connectors follows it,
// then a hairline before the account pages.
export const SETTINGS_NAV: NavEntry[] = [
  { page: "your-tangent", label: "Your Tangent", description: "What Tangent knows about you, how it plans your week, and how it learns more.", icon: Sparkles, featured: true },
  { page: "connectors", label: "Connectors", description: "Canvas, your calendars, and notes or other AIs Tangent can learn from.", icon: Plug },
  { page: "account", label: "Account", description: "Your name, look, and signing out.", icon: UserRound },
  { page: "security", label: "Security", description: "Your password and how you sign in.", icon: KeyRound },
  { page: "notifications", label: "Notifications", description: "When Tangent nudges you, and when it stays quiet.", icon: Bell },
  { page: "activity", label: "AI activity", description: "Everything Tangent changed for you, with undo.", icon: History },
  { page: "data", label: "Your data", description: "Export it, see what's stored, or delete it.", icon: Database },
];
const GROUP_BREAK_AFTER: SettingsPage = "connectors";

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
  // Keep the current tab in view when the strip scrolls sideways.
  useEffect(() => {
    if (variant !== "tabs") return;
    const current = tabsRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [variant, pathname]);
  if (variant === "tabs") {
    return (
      <nav ref={tabsRef} className="settings-tabs ui-tabs ui-tabs--underline" aria-label="Settings sections">
        {SETTINGS_NAV.map(({ page, label, featured }) => {
          const active = isCurrent(pathname, page);
          return (
            <Link key={page} href={`/settings/${page}`} className={`ui-tab${featured ? " is-featured" : ""}`} aria-current={active ? "page" : undefined}>
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
      <nav aria-label="Settings sections">
        <ul className="settings-list">
          {SETTINGS_NAV.map(({ page, label, description, icon: Icon, featured }) => (
            <li key={page} className={featured ? "is-featured" : undefined}>
              <Link href={`/settings/${page}`} className={`settings-list-link${featured ? " is-featured" : ""}`}>
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
      </nav>
    );
  }
  return (
    <nav className="settings-sidenav" aria-label="Settings sections">
      {SETTINGS_NAV.map(({ page, label, icon: Icon, featured }) => {
        const href = `/settings/${page}`;
        const active = isCurrent(pathname, page);
        return (
          <Fragment key={page}>
            <Link
              href={href}
              className={`settings-sidenav-link${featured ? " is-featured" : ""}${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={featured ? 18 : 16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
            {page === GROUP_BREAK_AFTER && <span className="settings-sidenav-break" aria-hidden="true" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
