"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { settingsLanding } from "@/lib/settings/routes";

/** Old /settings#… and ?activity= links land on their new page; on a laptop
 *  /settings opens Account, on a phone it stays the section list. */
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = settingsLanding(
      window.matchMedia("(min-width: 861px)").matches,
      window.location.search,
      window.location.hash
    );
    if (target) router.replace(target);
  }, [router]);
  return null;
}
