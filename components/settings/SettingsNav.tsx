"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarClock, ChevronRight, Database, History, KeyRound, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import type { SettingsPage } from "@/lib/settings/routes";

export const SETTINGS_NAV: { page: SettingsPage; label: string; description: string; icon: LucideIcon }[] = [
  { page: "account", label: "Account", description: "Your name, look, and signing out.", icon: UserRound },
  { page: "security", label: "Security", description: "Your password and how you sign in.", icon: KeyRound },
  { page: "schedule", label: "Schedule", description: "School, Canvas, calendars, and how much fits in a day.", icon: CalendarClock },
  { page: "notifications", label: "Notifications", description: "When Tangent nudges you, and when it stays quiet.", icon: Bell },
  { page: "context", label: "What Tangent knows", description: "The facts it plans with, and questions it still has.", icon: Sparkles },
  { page: "activity", label: "AI activity", description: "Everything Tangent changed for you, with undo.", icon: History },
  { page: "data", label: "Your data", description: "Export it, see what's stored, or delete it.", icon: Database },
];

export function settingsMeta(page: SettingsPage) {
  return SETTINGS_NAV.find((n) => n.page === page) ?? SETTINGS_NAV[0];
}

/** The Settings sections: a side list on a laptop ("sidebar"), the landing
 *  list with chevrons on a phone ("list"). */
export default function SettingsNav({ variant }: { variant: "sidebar" | "list" }) {
  const pathname = usePathname();
  if (variant === "list") {
    return (
      <nav aria-label="Settings sections">
        <ul className="settings-list">
          {SETTINGS_NAV.map(({ page, label, description, icon: Icon }) => (
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
      </nav>
    );
  }
  return (
    <nav className="settings-sidenav" aria-label="Settings sections">
      {SETTINGS_NAV.map(({ page, label, icon: Icon }) => {
        const href = `/settings/${page}`;
        const active = pathname === href;
        return (
          <Link key={page} href={href} className={`settings-sidenav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
