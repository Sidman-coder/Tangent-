"use client";

// Settings → Your Tangent, the main Settings page: what Tangent knows about you
// (You, mapped), the tour, how it plans your week, and how it gets to know you.
// Took over from Schedule's week settings and What Tangent knows.

import { useState } from "react";
import OnboardingSection from "@/components/settings/OnboardingSection";
import WhatTangentKnows from "@/components/settings/WhatTangentKnows";
import TourCard from "@/components/settings/TourCard";
import YourWeekSection from "@/components/settings/YourWeekSection";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { useCanvasStatus } from "@/components/settings/useCanvasStatus";
import FormMessage from "@/components/ui/FormMessage";

export default function YourTangentSettingsPage() {
  const canvas = useCanvasStatus();
  const [redoing, setRedoing] = useState(false);
  const [redoError, setRedoError] = useState(false);

  // Setup opens again with every answer prefilled. School hours are replaced,
  // never added to, so finishing it twice leaves one School block.
  const redoSetup = async () => {
    setRedoing(true);
    setRedoError(false);
    const res = await fetch("/api/onboarding", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setRedoing(false);
      setRedoError(true);
      return;
    }
    window.location.reload();
  };

  return (
    <>
      <SettingsPageHeader page="your-tangent" />

      <WhatTangentKnows />

      <TourCard />

      <YourWeekSection />

      <OnboardingSection canvasLoaded={canvas.loaded} canvasConnected={canvas.connected} onRedoSetup={() => void redoSetup()} redoing={redoing} />
      {redoError && <FormMessage tone="error">Couldn&apos;t restart setup. Try again.</FormMessage>}
    </>
  );
}
