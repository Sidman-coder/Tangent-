"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import SettingsNav from "./SettingsNav";
import "@/app/(app)/settings/settings.css";
import "@/components/ui/settings.css";

/** Settings around every page: the side list on a laptop; on a phone, a back
 *  button to the section list instead. */
export default function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";
  return (
    <div className={`settings-page${isRoot ? " is-root" : ""}`}>
      <div className="settings-layout">
        <SettingsNav variant="sidebar" />
        <div className="settings-main">
          {!isRoot && (
            <Link href="/settings" className="settings-back">
              <ChevronLeft size={18} aria-hidden="true" />
              Settings
            </Link>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
