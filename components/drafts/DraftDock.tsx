"use client";

// Round 5A 4.2: unconfirmed plan drafts, Gmail-style. A small pill sits
// bottom-right on any page where the draft isn't already open:
// "Draft plan · Competitive programming · 5 steps", with Hide (Round 6: hides
// the pill everywhere but the page it was drafted on; discards nothing).
// Click it and a floating card opens: the brief layered on top of a calendar
// card, with Confirm / Discard (with Undo) / "Open full view" (back to where
// it was drafted). Up to 2 stack; a third asks before replacing the oldest.
// The list lives in sessionStorage (lib/drafts/draft-store.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { FileClock, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Toast, { ToastPortal } from "@/components/ui/Toast";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import { usePreviewActions } from "@/components/preview/usePreviewActions";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import {
  DRAFTS_EVENT,
  EMPTY,
  acceptPending,
  forgetDraft,
  hideDraft,
  loadDrafts,
  openDraftIds,
  saveDrafts,
  updateDrafts,
  visibleDrafts,
  type DraftEntry,
  type DraftState,
} from "@/lib/drafts/draft-store";
import { getUserToday } from "@/lib/time";
import "./drafts.css";

const UNDO_MS = 5000;

async function discardOnServer(id: string) {
  await fetch(`/api/changesets/${encodeURIComponent(id)}/discard`, { method: "POST" }).catch(() => {});
}

export default function DraftDock() {
  const pathname = usePathname();
  const [state, setState] = useState<DraftState>(EMPTY);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  // The open card keeps its own copy of the entry. Confirm or an expired draft
  // makes the store forget it; deriving the card from the list unmounted it
  // before "Added 5 steps" or the error could show (overnight 2, Sam sim).
  const [openCard, setOpenCard] = useState<DraftEntry | null>(null);
  const cardId = openCard?.id ?? null;
  const setCardId = useCallback((next: string | null | ((id: string | null) => string | null)) => {
    setOpenCard((prev) => {
      const id = typeof next === "function" ? next(prev?.id ?? null) : next;
      if (!id) return null;
      if (prev?.id === id) return prev;
      return loadDrafts().drafts.find((d) => d.id === id) ?? null;
    });
  }, []);
  const [held, setHeld] = useState<DraftEntry | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const read = () => {
      setState(loadDrafts());
      setOpenIds(openDraftIds());
    };
    read();
    window.addEventListener(DRAFTS_EVENT, read);
    return () => window.removeEventListener(DRAFTS_EVENT, read);
  }, []);

  // A new page: the card closes.
  useEffect(() => setCardId(null), [pathname, setCardId]);

  // Discard (in the card) takes it away now and discards for real when the
  // Undo toast ends.
  const remove = useCallback((d: DraftEntry) => {
    if (timer.current) window.clearTimeout(timer.current);
    setHeld((prev) => {
      if (prev && prev.id !== d.id) void discardOnServer(prev.id);
      return d;
    });
    forgetDraft(d.id);
    setCardId(null);
    timer.current = window.setTimeout(() => {
      void discardOnServer(d.id);
      setHeld(null);
      timer.current = null;
    }, UNDO_MS);
  }, [setCardId]);

  const undoRemove = () => {
    if (!held) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const back = held;
    setHeld(null);
    updateDrafts((s) => (s.drafts.some((d) => d.id === back.id) ? s : { ...s, drafts: [...s.drafts, back].slice(-2) }));
  };

  // The floating card marks its own draft open too; that one stays listed.
  const onScreen = new Set(Array.from(openIds).filter((id) => id !== cardId));
  const shown = visibleDrafts(state, onScreen, Date.now(), pathname);
  const card = openCard;
  const pending = state.pending;

  return (
    <>
      <div className="draft-dock" aria-label="Draft plans" role="region">
        <AnimatePresence initial={false}>
          {card && <DraftCard key={card.id} draft={card} onClose={() => setCardId(null)} onDiscard={() => remove(card)} />}
        </AnimatePresence>
        {pending && (
          <div className="draft-ask" role="alertdialog" aria-labelledby="draft-ask-text">
            <p id="draft-ask-text">
              You have 2 drafts. Keep “{pending.title}” and replace the oldest one?
            </p>
            <div className="draft-ask-actions">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const { state: next, dropped } = acceptPending(loadDrafts());
                  saveDrafts(next);
                  if (dropped) void discardOnServer(dropped.id);
                }}
              >
                Replace oldest
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void discardOnServer(pending.id);
                  forgetDraft(pending.id);
                }}
              >
                Discard new draft
              </Button>
            </div>
          </div>
        )}
        <div className="draft-pills">
          {shown.map((d) => (
            <div key={d.id} className={`draft-pill${cardId === d.id ? " is-open" : ""}`}>
              <button
                type="button"
                className="draft-pill-open"
                aria-expanded={cardId === d.id}
                onClick={() => setCardId((id) => (id === d.id ? null : d.id))}
              >
                <FileClock size={15} strokeWidth={1.75} aria-hidden="true" />
                <span className="draft-pill-kind">Draft plan</span>
                <span className="draft-pill-title">{d.title}</span>
                <span className="draft-pill-count">
                  {d.stepCount} step{d.stepCount === 1 ? "" : "s"}
                </span>
              </button>
              <button
                type="button"
                className="draft-pill-hide"
                aria-label={`Hide draft ${d.title}`}
                onClick={() => {
                  if (cardId === d.id) setCardId(null);
                  updateDrafts((st) => hideDraft(st, d.id));
                }}
              >
                Hide
              </button>
            </div>
          ))}
        </div>
      </div>
      <ToastPortal>
        {held && (
          <Toast
            key={held.id}
            title="Draft discarded"
            duration={null}
            action={
              <Button size="sm" variant="secondary" onClick={undoRemove}>
                Undo
              </Button>
            }
          >
            {held.title}
          </Toast>
        )}
      </ToastPortal>
    </>
  );
}

function DraftCard({ draft, onClose, onDiscard }: { draft: DraftEntry; onClose: () => void; onDiscard: () => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { state, refresh } = useAppState();
  const timezone = useUserTimezone();
  const { cs, view, phase, busy, error, result, confirm } = usePreviewActions({
    changeSet: draft.changeSet,
    preview: draft.preview,
    onChanged: () => void refresh(),
  });
  const today = getUserToday(timezone);
  const done = phase !== "draft";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const motion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, visualDuration: 0.25, bounce: 0 } },
        exit: { opacity: 0, y: 8, transition: { duration: 0.12 } },
      };

  return (
    <m.div className="draft-card" role="dialog" aria-label={`Draft plan: ${draft.title}`} {...motion}>
      <div className="draft-card-cal" aria-hidden={!done ? undefined : true}>
        <PlanCalendarPreview ops={cs.ops} tasks={state?.tasks ?? []} plans={state?.plans ?? []} weekStart={state?.user.weekStart ?? 0} today={today} />
      </div>
      <div className="draft-card-brief">
        <div className="draft-card-head">
          <span className="draft-card-kicker">Draft plan</span>
          <button type="button" className="draft-pill-x" aria-label="Close" onClick={onClose}>
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <h2 className="draft-card-title">{draft.title}</h2>
        {cs.summary && <p className="draft-card-why">{cs.summary}</p>}
        <ul className="draft-card-lines">
          {view.lines.slice(0, 6).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
          {view.lines.length > 6 && <li className="is-more">and {view.lines.length - 6} more</li>}
        </ul>
        {error && (
          <p className="draft-card-status is-error" role="alert">
            {error}
          </p>
        )}
        {phase === "confirmed" && (
          <p className="draft-card-status" role="status">
            Added{result && result.created >= 0 ? ` ${result.created} step${result.created === 1 ? "" : "s"}` : ""} to your calendar.
          </p>
        )}
        {phase === "discarded" && (
          <p className="draft-card-status" role="status">
            Discarded.
          </p>
        )}
        <div className="draft-card-actions">
          {!done ? (
            <>
              <Button variant="primary" size="sm" loading={busy} onClick={() => void confirm()}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onDiscard}>
                Discard
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  onClose();
                  router.push(`${draft.origin}${draft.origin.includes("?") ? "&" : "?"}draft=${encodeURIComponent(draft.id)}`);
                }}
              >
                Open full view
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </m.div>
  );
}
