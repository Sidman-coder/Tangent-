"use client";

// Settings → Onboarding: everything Tangent needs to fit you, in one place,
// each with whether it's done. The tour, Tangent's first questions, Grill me,
// context from another AI, Canvas, and the setup answers.

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { GET_TO_KNOW_DONE_EVENT, GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";
import { TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";

const ENOUGH_FACTS = 4;

function Status({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span className={`settings-status-line${done ? " is-done" : ""}`}>
      {done && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </span>
  );
}

export default function OnboardingSection({
  canvasLoaded,
  canvasConnected,
  onRedoSetup,
  redoing,
}: {
  canvasLoaded: boolean;
  canvasConnected: boolean;
  onRedoSetup: () => void;
  redoing: boolean;
}) {
  const [toured, setToured] = useState(false);
  const [facts, setFacts] = useState<number | null>(null);

  const loadFacts = useCallback(() => {
    void fetch("/api/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { context?: { entries?: unknown[] } }) => setFacts(d.context?.entries?.length ?? 0))
      .catch(() => setFacts(0));
  }, []);

  useEffect(() => {
    try {
      setToured(window.localStorage.getItem(TOUR_DONE_KEY) === "1");
    } catch {}
    loadFacts();
    window.addEventListener(GET_TO_KNOW_DONE_EVENT, loadFacts);
    return () => window.removeEventListener(GET_TO_KNOW_DONE_EVENT, loadFacts);
  }, [loadFacts]);

  const known = facts ?? 0;

  return (
    <section id="onboarding" className="settings-group" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title" className="settings-group-title">Onboarding</h2>
      <p className="settings-group-note">Everything Tangent needs to fit you. Come back to any of it whenever you like.</p>
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Take the tour</strong>
            <span>A two-minute walk through adding, the calendar, projects and Tangents.</span>
            <Status done={toured}>{toured ? "Done" : "Not yet"}</Status>
          </div>
          <Button size="sm" variant={toured ? "secondary" : "primary"} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
            {toured ? "Take it again" : "Start tour"}
          </Button>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Let Tangent get to know you</strong>
            <span>Six quick questions about school, goals and how you work. About two minutes.</span>
            <Status done={known >= ENOUGH_FACTS}>{facts === null ? "Checking…" : `Tangent knows ${known} thing${known === 1 ? "" : "s"} about you`}</Status>
          </div>
          <Button size="sm" variant={known >= ENOUGH_FACTS ? "secondary" : "primary"} onClick={() => window.dispatchEvent(new Event(GET_TO_KNOW_EVENT))}>
            Start
          </Button>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Grill me</strong>
            <span>Tangent asks one sharp question at a time, as many as you like. Answer out loud or tap.</span>
          </div>
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent(GET_TO_KNOW_EVENT, { detail: { mode: "grill" } }))}>
            Grill me
          </Button>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Connect your apps</strong>
            <span>Canvas, your calendars, Notion and other AIs, so Tangent starts out knowing your week.</span>
            {canvasLoaded && <Status done={canvasConnected}>{canvasConnected ? "Canvas connected" : "Nothing connected yet"}</Status>}
          </div>
          <Button size="sm" variant={canvasConnected ? "secondary" : "primary"} onClick={() => document.getElementById("connections")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Open
          </Button>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Setup answers</strong>
            <span>School hours, what you want help with, and where you&apos;re starting. Go through them again, prefilled.</span>
          </div>
          <Button size="sm" loading={redoing} loadingLabel="Opening…" onClick={onRedoSetup}>
            Redo setup
          </Button>
        </div>
      </div>
    </section>
  );
}
