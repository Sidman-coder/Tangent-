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
import { addDaysYMD } from "@/lib/time";
import { commitmentOf } from "@/lib/task-kind";
import type { Task } from "@/lib/types";

const SUGGESTIONS = ["When am I free this week?", "What could I move to make room?", "Is this week too much?"];

function dayName(ymd: string, today: string): string {
  if (ymd === today) return "today";
  if (ymd === addDaysYMD(today, 1)) return "tomorrow";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
}

export function weekLines(tasks: Task[], today: string): string[] {
  const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(today, i));
  const inWeek = tasks.filter((t) => t.date >= days[0] && t.date <= days[6]);
  if (inWeek.length === 0) return ["Nothing on your calendar for the next 7 days."];
  const open = inWeek.filter((t) => !t.completed);
  const perDay = days.map((d) => ({ d, n: open.filter((t) => t.date === d).length }));
  const busiest = [...perDay].sort((a, b) => b.n - a.n)[0];
  const free = perDay.filter((p) => p.n === 0).map((p) => dayName(p.d, today));
  const mustDo = open.filter((t) => commitmentOf(t) === "fixed" || t.source === "canvas").length;
  const lines = [`${open.length} thing${open.length === 1 ? "" : "s"} to do in the next 7 days${mustDo ? `, ${mustDo} at a set time or date` : ""}.`];
  if (busiest.n > 1) lines.push(`Busiest: ${dayName(busiest.d, today)}, with ${busiest.n}.`);
  if (free.length > 0) lines.push(free.length === 1 ? `Open: ${free[0]}.` : `Open: ${free.slice(0, 3).join(", ")}${free.length > 3 ? " and more" : ""}.`);
  return lines;
}

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
          placeholder="“Can I fit a run in on Thursday?”"
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
