"use client";

import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import YourDataSection from "@/components/settings/YourDataSection";

export default function DataSettingsPage() {
  return (
    <>
      <SettingsPageHeader page="data" />
      <YourDataSection />
    </>
  );
}
