"use client";

// Settings → Connectors: everywhere Tangent can learn from. Canvas and
// calendar files (from the old Schedule page), and notes or what another AI
// knows about you (from the old What Tangent knows page).

import { useState } from "react";
import CanvasConnectGuide from "@/components/CanvasConnectGuide";
import ConnectionsSection from "@/components/settings/ConnectionsSection";
import ImportContext from "@/components/settings/ImportContext";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { useCanvasStatus } from "@/components/settings/useCanvasStatus";
import SettingsSection from "@/components/ui/SettingsSection";
import Button from "@/components/ui/Button";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";

export default function ConnectorsSettingsPage() {
  const canvas = useCanvasStatus();
  const [guideOpen, setGuideOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <SettingsPageHeader page="connectors" />

      <ConnectionsSection canvasLoaded={canvas.loaded} canvasConnected={canvas.connected} onConnectCanvas={() => setGuideOpen(true)} />

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

      <CanvasConnectGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          canvas.reload();
        }}
      />
    </>
  );
}
