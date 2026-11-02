"use client";

// Settings → Connections: everywhere Tangent can learn from. The more it can
// see, the less it asks. Canvas syncs on its own; calendars come in from a
// file; Notion, Docs and other AIs come in as context.

import { useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import CalendarImport from "@/components/settings/CalendarImport";
import ImportContext from "@/components/settings/ImportContext";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";

export default function ConnectionsSection({
  canvasLoaded,
  canvasConnected,
  onConnectCanvas,
}: {
  canvasLoaded: boolean;
  canvasConnected: boolean;
  onConnectCanvas: () => void;
}) {
  const [importing, setImporting] = useState(false);

  return (
    <section id="connections" className="settings-group" aria-labelledby="connections-title">
      <h2 id="connections-title" className="settings-group-title">Connections</h2>
      <p className="settings-group-note">The more Tangent can see, the less it has to ask and the better it plans.</p>
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Canvas</strong>
            <span>Assignments and due dates flow into your calendar on their own, every few hours.</span>
            {canvasLoaded && (
              <span className={`settings-status-line${canvasConnected ? " is-done" : ""}`}>
                {canvasConnected && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                {canvasConnected ? "Connected" : "Not connected"}
              </span>
            )}
          </div>
          <Button size="sm" variant={canvasConnected ? "secondary" : "primary"} onClick={onConnectCanvas} disabled={!canvasLoaded}>
            {canvasConnected ? "Reconnect" : "Connect"}
          </Button>
        </div>

        <div className="settings-row is-stacked">
          <div className="settings-row-copy">
            <strong>Google, Apple or Outlook calendar</strong>
            <span>Bring the next two months of events in from a calendar file. Tangent plans around them.</span>
          </div>
          <CalendarImport />
        </div>

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
      </div>
    </section>
  );
}
