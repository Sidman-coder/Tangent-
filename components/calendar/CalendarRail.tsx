"use client";

// Beside the calendar on a wide screen (Round 4 widths): a few plain lines
// about the next seven days, and a box to ask Tangent about them.
//
// Round 5A 4.1: the answer stays here, in the rail, as a small talk-first
// conversation (InlineAsk, scope "rail"); Home's box is never touched. A plan
// drafted here shows on the main calendar through onDraftOps, with Confirm /
// Edit / Discard kept in the rail. Leaving Calendar ends the talk; an
// unconfirmed plan is kept as a draft (lib/drafts/draft-store.ts).

import { useMemo, useRef } from "react";
import InlineAsk, { type InlineAskHandle } from "@/components/chat/InlineAsk";
import type { ChangeOp } from "@/lib/pipeline/changeset";
import { weekLines } from "@/lib/week-lines";
import type { Task } from "@/lib/types";

const SUGGESTIONS = ["When am I free this week?", "What could I move to make room?", "Is this week too much?"];

export default function CalendarRail({
  tasks,
  today,
  onDraftOps,
}: {
  tasks: Task[];
  today: string;
  onDraftOps?: (ops: ChangeOp[] | null) => void;
}) {
  const talk = useRef<InlineAskHandle>(null);
  const lines = useMemo(() => weekLines(tasks, today), [tasks, today]);

  return (
    <aside className="cal-rail" aria-labelledby="cal-rail-title">
      <h2 id="cal-rail-title">Your next 7 days</h2>
      <ul className="cal-rail-lines">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="cal-rail-ask">
        <p className="cal-rail-ask-label">Ask about your week</p>
        <InlineAsk
          ref={talk}
          scope={{ rail: true }}
          label="Ask about your week"
          placeholder="Can I fit a run in?"
          className="cal-rail-talk"
          onOps={onDraftOps}
        />
        <div className="cal-rail-chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="tg-chip" onClick={() => talk.current?.ask(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
