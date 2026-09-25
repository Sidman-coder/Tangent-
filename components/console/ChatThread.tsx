"use client";

// Chronological message list for the AI console. The thread fills the space
// between the header and the composer and scrolls itself so the latest
// exchange is on screen. Older turns fold behind an "N earlier messages"
// divider. When the latest reply is taller than the viewport, it's pinned
// by its top edge and a plain "continues below" notice says so, rather than
// clipping text.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PenMark from "@/components/console/PenMark";
import type { Turn } from "@/components/console/turns";

/** Turns kept open by default; anything older folds behind the divider. */
const VISIBLE_TURNS = 3;
const LIVE_STEPS = ["Reading your request", "Checking your tasks", "Composing a response"] as const;

type Props = {
  turns: Turn[];
  busy: boolean;
  pendingRequest: string | null;
  onConfirm: (turnId: string, pendingId: string, confirm: boolean) => void;
  onUndone: () => void;
};

export default function ChatThread({ turns, busy, pendingRequest, onConfirm, onUndone }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  /** null = everything visible; otherwise why content sits below the fold. */
  const [below, setBelow] = useState<null | "reply" | "newer">(null);

  const hidden = expanded ? 0 : Math.max(0, turns.length - VISIBLE_TURNS);
  const shown = turns.slice(hidden);
  const last = turns[turns.length - 1];

  const measure = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const gap = sc.scrollHeight - sc.scrollTop - sc.clientHeight;
    if (gap <= 8) return setBelow(null);
    const latest = latestRef.current;
    const readingLatest = latest ? sc.scrollTop + 1 >= latest.offsetTop - 24 : false;
    setBelow(readingLatest ? "reply" : "newer");
  }, []);

  // Bring the newest exchange into view whenever it changes.
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    const latest = latestRef.current;
    if (!sc) return;
    if (latest && latest.offsetHeight > sc.clientHeight - 32) {
      // Too tall to fit: start at the question, let the notice point down.
      sc.scrollTop = latest.offsetTop - 16;
    } else {
      sc.scrollTop = sc.scrollHeight;
    }
    measure();
  }, [turns.length, busy, last?.response, last?.pendingConfirm, measure]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [measure]);

  const scrollDown = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="tg-thread-wrap">
      <div className="tg-thread" ref={scrollerRef} onScroll={measure} aria-live="polite">
        <div className="tg-thread-inner">
          {hidden > 0 && (
            <button type="button" className="tg-earlier" onClick={() => setExpanded(true)}>
              <span className="tg-earlier-line" aria-hidden="true" />
              <span className="tg-earlier-label">
                {hidden * 2} earlier message{hidden * 2 === 1 ? "" : "s"} · Show
              </span>
              <span className="tg-earlier-line" aria-hidden="true" />
            </button>
          )}

          {shown.map((t, i) => {
            const isLatest = !busy && i === shown.length - 1;
            return (
              <article key={t.id} className="tg-turn" ref={isLatest ? latestRef : undefined}>
                <div className="tg-msg-user">{t.request}</div>
                <div className="tg-msg-assistant">
                  <PenMark className="tg-msg-mark" />
                  <div className="tg-msg-body">
                    {(t.tools.length > 0 || t.sourcesChecked.length > 0) && (
                      <div className="tg-msg-meta">
                        {t.tools.map((tool) => (
                          <span key={tool} className="tg-meta-chip">{tool}</span>
                        ))}
                        {t.sourcesChecked.map((source) => (
                          <span key={source} className="tg-meta-chip">Checked {source}</span>
                        ))}
                      </div>
                    )}
                    <div className="tg-msg-text">{t.response}</div>
                    {t.pendingConfirm && (
                      <div className="tg-confirm">
                        <button
                          type="button"
                          className="tg-btn tg-btn-dark"
                          onClick={() => onConfirm(t.id, t.pendingConfirm!.id, true)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="tg-btn"
                          onClick={() => onConfirm(t.id, t.pendingConfirm!.id, false)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {t.actionId && t.actionLabel && (
                      <ActionReceipt actionId={t.actionId} label={t.actionLabel} onUndone={onUndone} />
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {busy && (
            <article className="tg-turn is-pending" ref={latestRef}>
              <div className="tg-msg-user">{pendingRequest}</div>
              <div className="tg-msg-assistant">
                <PenMark className="tg-msg-mark is-working" />
                <ol className="tg-steps">
                  {LIVE_STEPS.map((step, i) => (
                    <li key={step} style={{ animationDelay: `${i * 0.35}s` }}>{step}</li>
                  ))}
                </ol>
              </div>
            </article>
          )}
        </div>
      </div>

      {below && (
        <button type="button" className="tg-below" onClick={scrollDown}>
          <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
          {below === "reply" ? "This reply continues below — scroll to read the rest" : "Newer messages below"}
        </button>
      )}
    </div>
  );
}
