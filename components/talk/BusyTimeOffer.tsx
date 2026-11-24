"use client";

// Round 6 (item 5): when the student mentions a recurring busy time ("I work
// at the bakery Wed 4-9pm and Sat-Sun 8am-2pm"), one tap saves it as a
// commitment: "Add bakery shifts as busy time?" → Yes / Not now. Nothing is
// added without the tap. Read from the student's own words in code
// (lib/busy-offer.ts), so it costs no AI call; the commitments already saved
// come from the calendar, so a block that's already there is never offered.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAppState } from "@/components/AppStateProvider";
import { busyOffer, busyOfferQuestion } from "@/lib/busy-offer";
import { commitmentsFromTasks } from "@/lib/commitments";

const DISMISSED_KEY = "tangent:busy-offer-dismissed";

function dismissedLabels(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function rememberDismissed(label: string) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(new Set([...dismissedLabels(), label]))));
  } catch {
    /* private mode: it just shows again next time */
  }
}

export default function BusyTimeOffer({ text }: { text: string }) {
  const { state, refresh } = useAppState();
  const [phase, setPhase] = useState<"ask" | "saving" | "added" | "failed" | "gone">("ask");
  // Read once per sentence; after Yes the calendar holds it, so keep the offer we showed.
  const [shown, setShown] = useState<ReturnType<typeof busyOffer>>(null);
  const live = useMemo(() => busyOffer(text, commitmentsFromTasks(state?.tasks ?? [])), [text, state?.tasks]);
  const offer = shown ?? live;
  if (!offer || phase === "gone") return null;
  if (phase === "ask" && dismissedLabels().includes(offer.label)) return null;

  const add = async () => {
    setShown(offer);
    setPhase("saving");
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: offer.commitment }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !data?.ok) throw new Error("not saved");
      setPhase("added");
      void refresh();
    } catch {
      setPhase("failed");
    }
  };

  if (phase === "added") {
    return (
      <p className="busy-offer is-done" role="status">
        Added. It&apos;s in <Link href="/settings/schedule">Settings → Schedule</Link>.
      </p>
    );
  }
  return (
    <div className="busy-offer" role="group" aria-label="Busy time">
      <span className="talk-plan-ask">{phase === "failed" ? "That didn't save. Try again?" : busyOfferQuestion(offer)}</span>
      <Button
        variant="secondary"
        size="sm"
        icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />}
        onClick={() => void add()}
        disabled={phase === "saving"}
      >
        Yes
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          rememberDismissed(offer.label);
          setPhase("gone");
        }}
        disabled={phase === "saving"}
      >
        Not now
      </Button>
    </div>
  );
}
