"use client";

// Settings → Connections: what Tangent can read, one line each about what it
// keeps and how to stop (overnight C16). Canvas syncs on its own; calendars
// come in from a file. (Notion, Docs and other AIs come in on What Tangent knows.)

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import CalendarImport from "@/components/settings/CalendarImport";

export default function ConnectionsSection({
  canvasLoaded,
  canvasConnected,
  canvasSyncFailed = false,
  canvasItemCount = 0,
  onConnectCanvas,
  onCanvasDisconnected,
}: {
  canvasLoaded: boolean;
  canvasConnected: boolean;
  canvasSyncFailed?: boolean;
  /** Canvas items in the calendar now, for the Disconnect question. */
  canvasItemCount?: number;
  onConnectCanvas: () => void;
  onCanvasDisconnected?: () => void;
}) {
  // Overnight 2, Phase 6 (Sid approved): Disconnect asks once, inline, whether
  // the items Canvas brought in go too. The feed link always goes.
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null);
  const [result, setResult] = useState<{ tone: "done" | "error"; text: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (asking) panel.current?.querySelector("button")?.focus();
  }, [asking]);

  const disconnect = async (removeItems: boolean) => {
    setBusy(removeItems ? "remove" : "keep");
    setResult(null);
    try {
      const res = await fetch("/api/canvas/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItems }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; removedItems?: number };
      if (!res.ok || !data.ok) throw new Error("failed");
      const n = data.removedItems ?? 0;
      setResult({
        tone: "done",
        text: removeItems
          ? `Canvas disconnected. Deleted the feed link and ${n} Canvas item${n === 1 ? "" : "s"}.`
          : "Canvas disconnected. Deleted the feed link; your Canvas items stay.",
      });
      setAsking(false);
      onCanvasDisconnected?.();
    } catch {
      setResult({ tone: "error", text: "Canvas could not be disconnected. Try again." });
    } finally {
      setBusy(null);
    }
  };
  const items = `${canvasItemCount} Canvas item${canvasItemCount === 1 ? "" : "s"}`;

  return (
    <section id="connections" className="settings-group" aria-labelledby="connections-title">
      <h2 id="connections-title" className="settings-group-title">Connections</h2>
      <p className="settings-group-note">Connect only what helps. Tangent reads nothing until you do.</p>
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Canvas</strong>
            <span>Assignments and due dates flow into your calendar on their own, every few hours.</span>
            <span className="settings-row-fine">We keep your private feed link and the due dates it brings in. Disconnect deletes the link, and the items too if you say so.</span>
            {canvasLoaded && (
              <span className={`settings-status-line${canvasConnected ? " is-done" : ""}`}>
                {canvasConnected && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                {canvasConnected ? "Connected" : "Not connected"}
              </span>
            )}
            {canvasSyncFailed && <span className="settings-row-fine" role="status">Canvas didn&apos;t update. Your last assignments are still here. Reconnect to fix it.</span>}
            {result && (
              <span className="settings-row-fine" role="status">
                {result.text}
              </span>
            )}
          </div>
          <div className="settings-row-control">
            {canvasConnected && !asking && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setAsking(true);
                }}
              >
                Disconnect
              </Button>
            )}
            <Button size="sm" variant={canvasConnected && !canvasSyncFailed ? "secondary" : "primary"} onClick={onConnectCanvas} disabled={!canvasLoaded}>
              {canvasConnected ? "Reconnect" : "Connect"}
            </Button>
          </div>
        </div>

        {asking && (
          <div className="settings-row is-stacked">
            <div
              ref={panel}
              className="confirm-panel"
              role="group"
              aria-labelledby="canvas-disconnect-title"
              onKeyDown={(e) => {
                if (e.key === "Escape" && !busy) setAsking(false);
              }}
            >
              <p id="canvas-disconnect-title" className="confirm-panel-title">Disconnect Canvas?</p>
              <div className="confirm-panel-body">
                <p>
                  We&apos;ll delete your feed link.{canvasItemCount > 0 ? ` Remove the ${items} too?` : ""}
                </p>
              </div>
              <div className="confirm-panel-actions">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)} disabled={busy !== null}>
                  Cancel
                </Button>
                {canvasItemCount > 0 ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void disconnect(false)} disabled={busy !== null} loading={busy === "keep"} loadingLabel="Disconnecting…">
                      Keep the items
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => void disconnect(true)} disabled={busy !== null} loading={busy === "remove"} loadingLabel="Removing…">
                      Remove {items}
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="danger" size="sm" onClick={() => void disconnect(false)} disabled={busy !== null} loading={busy === "keep"} loadingLabel="Disconnecting…">
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="settings-row is-stacked">
          <div className="settings-row-copy">
            <strong>Google, Apple or Outlook calendar</strong>
            <span>Bring the next two months of events in from a calendar file. Tangent plans around them.</span>
            <span className="settings-row-fine">We keep only the events you choose to add, as normal calendar items. Delete them any time from your calendar.</span>
          </div>
          <CalendarImport />
        </div>

      </div>
    </section>
  );
}
