"use client";

// Asks queued Grill me questions, one card at a time. Skip always works, Later
// closes and leaves the rest in the queue. It checks in after IN_A_ROW, and an
// answer that could change a plan offers a re-plan preview: never silent, and
// nothing moves until the student confirms that preview in the project chat.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ClarifyCard from "@/components/console/ClarifyCard";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";
import { putAsk, askAboutHref } from "@/lib/ask-handoff";
import { GRILL_EVENT, answerGrill, skipGrill } from "@/lib/grill-client";
import { IN_A_ROW, replanRequest, type GrillItem } from "@/lib/grill-queue";
import "./grill.css";

type Offer = { projectId: string; question: string; answer: string };

export default function GrillDeck({
  items,
  max,
  onDone,
}: {
  items: GrillItem[];
  /** Stop here, whatever is left in the queue. */
  max?: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  // What's being asked doesn't shift underneath the student as the queue reloads.
  const [deck] = useState(() => (max ? items.slice(0, max) : items));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);

  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  // Today and Settings reload once this deck has gone, not between its cards.
  useEffect(() => () => void window.dispatchEvent(new Event(GRILL_EVENT)), []);

  const finished = deck.length === 0 || index >= deck.length;
  useEffect(() => {
    if (finished) doneRef.current?.();
  }, [finished]);

  const advance = () => {
    const next = index + 1;
    setOffer(null);
    setIndex(next);
    if (next < deck.length && next % IN_A_ROW === 0) setPaused(true);
  };

  if (finished) return null;

  if (offer) {
    return (
      <div className="grill-note" role="status">
        <p>That could change the plan. Want to see what a new one looks like? Nothing moves until you confirm it.</p>
        <div className="grill-actions">
          <Button
            variant="primary"
            onClick={() => {
              putAsk("ai", replanRequest(offer.question, offer.answer));
              router.push(`${askAboutHref({ kind: "project", id: offer.projectId })}&ask=1`);
            }}
          >
            See a new plan
          </Button>
          <button type="button" className="tg-chip" onClick={advance}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (paused) {
    return (
      <div className="grill-note" role="status">
        <p>That&apos;s {index} in a row. Keep going?</p>
        <div className="grill-actions">
          <Button variant="primary" onClick={() => setPaused(false)}>
            Keep going
          </Button>
          <button type="button" className="tg-chip" onClick={() => doneRef.current?.()}>
            That&apos;s enough for now
          </button>
        </div>
      </div>
    );
  }

  const item = deck[index];
  return (
    <div className="grill-deck">
      {deck.length > 1 && (
        <p className="grill-count">
          {index + 1} of {deck.length}
        </p>
      )}
      <ClarifyCard
        key={item.id}
        questions={[{ id: item.id, question: item.question, options: item.choices, instant: true }]}
        disabled={busy}
        skipLabel="Later"
        onSubmit={async (answers) => {
          if (!answers) {
            doneRef.current?.();
            return;
          }
          setBusy(true);
          const answer = answers[0]?.answer;
          if (!answer) {
            await skipGrill(item.id);
            setBusy(false);
            advance();
            return;
          }
          const saved = await answerGrill(item.id, answer);
          setBusy(false);
          // What Tangent knows shows it straight away.
          window.dispatchEvent(new Event(GET_TO_KNOW_DONE_EVENT));
          if (saved?.replan && saved.projectId) setOffer({ projectId: saved.projectId, question: item.question, answer });
          else advance();
        }}
      />
    </div>
  );
}
