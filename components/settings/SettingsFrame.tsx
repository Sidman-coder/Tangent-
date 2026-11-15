"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import SettingsNav from "./SettingsNav";
import "@/app/(app)/settings/settings.css";
import "@/components/ui/settings.css";

/** Scroll past this and the What Tangent knows map takes over; back above
 *  the lower mark and the sub-nav returns (the gap stops it flickering while
 *  the layout widens). */
const TAKEOVER_ON = 48;
const TAKEOVER_OFF = 8;

/** Settings around every page: the side list on a laptop; on a phone,
 *  underline tabs across the top (the /settings landing keeps its list).
 *  Round 5B Phase 1: on What Tangent knows the sub-nav slides away once the
 *  page scrolls, and a phone gets a "Settings" back link instead of tabs. */
export default function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";
  const isKnows = pathname === "/settings/context" || pathname.endsWith("/settings-context");
  const [takeover, setTakeover] = useState(false);

  useEffect(() => {
    if (!isKnows) {
      setTakeover(false);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      setTakeover((on) => (on ? y > TAKEOVER_OFF : y > TAKEOVER_ON));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isKnows]);

  const toTop = () => {
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>(".settings-sidenav-link.is-active")?.focus({ preventScroll: true });
  };

  return (
    <div className={`settings-page${isRoot ? " is-root" : ""}${isKnows ? " is-knows" : ""}${takeover ? " is-takeover" : ""}`}>
      <div className="settings-layout">
        <SettingsNav variant="sidebar" />
        <div className="settings-main">
          {isKnows && (
            <>
              <Link href="/settings" className="settings-back settings-back--phone">
                <ChevronLeft size={16} aria-hidden="true" />
                Settings
              </Link>
              <button type="button" className="settings-back settings-back--desk" onClick={toTop}>
                <ChevronLeft size={16} aria-hidden="true" />
                Settings
              </button>
            </>
          )}
          {!isRoot && <SettingsNav variant="tabs" />}
          {children}
        </div>
      </div>
    </div>
  );
}
