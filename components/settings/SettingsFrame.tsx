"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SettingsNav from "./SettingsNav";
import "@/app/(app)/settings/settings.css";
import "@/components/ui/settings.css";

/** Settings around every page: the side list on a laptop; on a phone,
 *  underline tabs across the top (the /settings landing keeps its list). */
export default function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";
  return (
    <div className={`settings-page${isRoot ? " is-root" : ""}`}>
      <div className="settings-layout">
        <SettingsNav variant="sidebar" />
        <div className="settings-main">
          {!isRoot && <SettingsNav variant="tabs" />}
          {children}
        </div>
      </div>
    </div>
  );
}
