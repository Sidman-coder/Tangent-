import { redirect } from "next/navigation";
import { LEGACY_SETTINGS_PAGES } from "@/lib/settings/routes";

// What Tangent knows is part of Your Tangent now (its import moved to
// Connectors). Old links land on Your Tangent.
export default function ContextSettingsRedirect() {
  redirect(`/settings/${LEGACY_SETTINGS_PAGES.context}`);
}
