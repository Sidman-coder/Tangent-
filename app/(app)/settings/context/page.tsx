"use client";

import { useState } from "react";
import OnboardingSection from "@/components/settings/OnboardingSection";
import WhatTangentKnows from "@/components/settings/WhatTangentKnows";
import ImportContext from "@/components/settings/ImportContext";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { useCanvasStatus } from "@/components/settings/useCanvasStatus";
import SettingsSection from "@/components/ui/SettingsSection";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";

export default function ContextSettingsPage() {
  const canvas = useCanvasStatus();
  const [redoing, setRedoing] = useState(false);
  const [redoError, setRedoError] = useState(false);
  const [importing, setImporting] = useState(false);

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
      <SettingsPageHeader page="context" />

      <WhatTangentKnows />

      <SettingsSection id="import" title="Bring in what you already have" description="The more Tangent knows, the less it has to ask.">
        <div className="settings-row is-stacked">
          <div className="settings-row-main">
            <div className="settings-row-copy">
              <strong>Notion, Google Docs, ChatGPT or Claude</strong>
              <span>Paste notes, a doc, or what another AI knows about you. Tangent keeps what&apos;s useful.</span>
            </div>
            <Button size="sm" onClick={() => setImporting((v) => !v)}>{importing ? "Close" : "Bring it in"}</Button>
          </div>
          {importing && (
            <ImportContext
              onDone={() => {
                setImporting(false);
                window.dispatchEvent(new Event(GET_TO_KNOW_DONE_EVENT));
              }}
            />
          )}
        </div>
      </SettingsSection>

      <OnboardingSection canvasLoaded={canvas.loaded} canvasConnected={canvas.connected} onRedoSetup={() => void redoSetup()} redoing={redoing} />
      {redoError && <FormMessage tone="error">Couldn&apos;t restart setup. Try again.</FormMessage>}
    </>
  );
}
