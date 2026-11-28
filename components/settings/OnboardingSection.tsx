"use client";

// Settings → Onboarding: everything Tangent needs to fit you, in one place,
// each with whether it's done. The tour, Tangent's first questions, Grill me,
// context from another AI, Canvas, and the setup answers.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import GrillQueue from "@/components/settings/GrillQueue";
import { GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";
import { FACTS_CHANGED_EVENT } from "@/components/settings/WhatTangentKnows";

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
  // The count comes from the facts on this page (one source), not a second fetch
  // that went stale after an edit or Forget and showed 0 beside "24 facts".
  const [facts, setFacts] = useState<number | null>(null);
  useEffect(() => {
    const onFacts = (e: Event) => setFacts(typeof (e as CustomEvent).detail === "number" ? (e as CustomEvent).detail : null);
    window.addEventListener(FACTS_CHANGED_EVENT, onFacts);
    return () => window.removeEventListener(FACTS_CHANGED_EVENT, onFacts);
  }, []);

  const known = facts ?? 0;

  return (
    <section id="onboarding" className="settings-group" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title" className="settings-group-title">Help Tangent learn</h2>
      <p className="settings-group-note">Ways to fill in the gaps. Come back to any of these whenever you like.</p>
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Let Tangent get to know you</strong>
            <span>One question at a time, about what Tangent doesn&apos;t know yet. You type the answer.</span>
            <Status done={known >= ENOUGH_FACTS}>{facts === null ? "Checking…" : `Tangent knows ${known} thing${known === 1 ? "" : "s"} about you`}</Status>
          </div>
          <Button size="sm" variant={known >= ENOUGH_FACTS ? "secondary" : "primary"} onClick={() => window.dispatchEvent(new Event(GET_TO_KNOW_EVENT))}>
            Ask me one
          </Button>
        </div>

        <GrillQueue />

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Connect your apps</strong>
            <span>Canvas and your calendars, so Tangent starts out knowing your week.</span>
            {canvasLoaded && <Status done={canvasConnected}>{canvasConnected ? "Canvas connected" : "Nothing connected yet"}</Status>}
          </div>
          <Link href="/settings/schedule" className={`ui-button ui-button--sm ${canvasConnected ? "ui-button--secondary" : "ui-button--primary"}`}>
            Open
          </Link>
        </div>

        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Setup answers</strong>
            <span>Your grade, your regular commitments, what matters this year and how you work. Go through them again, prefilled.</span>
          </div>
          <Button size="sm" loading={redoing} loadingLabel="Opening…" onClick={onRedoSetup}>
            Redo setup
          </Button>
        </div>
      </div>
    </section>
  );
}
