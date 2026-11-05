"use client";

import PageHeader from "@/components/ui/PageHeader";
import SettingsNav from "@/components/settings/SettingsNav";
import SettingsRedirect from "@/components/settings/SettingsRedirect";

/** /settings: the section list on a phone; a laptop goes straight to Account. */
export default function SettingsPage() {
  return (
    <>
      <SettingsRedirect />
      <PageHeader title="Settings" description="How Tangent fits you, and everything it knows." />
      <SettingsNav variant="list" />
    </>
  );
}
