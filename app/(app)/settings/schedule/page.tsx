import { redirect } from "next/navigation";
import { LEGACY_SETTINGS_PAGES } from "@/lib/settings/routes";

// Schedule was split: its week settings live on Your Tangent, Canvas and
// calendars on Connectors. Old links land on Your Tangent.
export default function ScheduleSettingsRedirect() {
  redirect(`/settings/${LEGACY_SETTINGS_PAGES.schedule}`);
}
