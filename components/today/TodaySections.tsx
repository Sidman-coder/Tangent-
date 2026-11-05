"use client";

// The day, in three parts: what has to happen, what Tangent planned, and what's
// next. Each has a header, a count and an empty state.

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { formatTaskDay } from "@/lib/task-when";
import type { TodayGroups } from "@/lib/today-sections";
import type { Plan, Task } from "@/lib/types";
import TodayRow, { type TodayRowActions } from "./TodayRow";

type Props = TodayRowActions & {
  groups: TodayGroups;
  plans: readonly Plan[];
  now: Date;
  today: string;
  timezone: string;
  busyTaskId: string | null;
  questionTaskIds: ReadonlySet<string>;
  /** Fresh start, under Today's plan when it applies. */
  planFooter?: React.ReactNode;
};

export default function TodaySections({ groups, plans, now, today, timezone, busyTaskId, questionTaskIds, planFooter, ...actions }: Props) {
  const [comingOpen, setComingOpen] = useState(false);
  const comingCount = groups.comingUp.reduce((n, day) => n + day.tasks.length, 0);

  const row = (task: Task) => (
    <TodayRow
      key={task.id}
      task={task}
      plans={plans}
      now={now}
      today={today}
      timezone={timezone}
      busy={busyTaskId === task.id}
      hasQuestions={questionTaskIds.has(task.id)}
      {...actions}
    />
  );

  return (
    <div className="today-sections">
      <section id="must-do" className="today-section" aria-labelledby="must-do-title" tabIndex={-1}>
        <h2 id="must-do-title" className="today-section-head">
          Must do <span className="today-section-count">{groups.mustDo.length}</span>
        </h2>
        {groups.mustDo.length === 0 ? (
          <p className="today-section-empty">Nothing you have to do today.</p>
        ) : (
          <div className="today-rows">
            <AnimatePresence initial={false}>{groups.mustDo.map(row)}</AnimatePresence>
          </div>
        )}
        {groups.olderOverdueCount > 0 && (
          <Link href="/calendar" className="today-section-more">+{groups.olderOverdueCount} older on your calendar</Link>
        )}
      </section>

      <section className="today-section is-plan" aria-labelledby="todays-plan-title">
        <h2 id="todays-plan-title" className="today-section-head">
          Today&apos;s plan <span className="today-section-count">{groups.todaysPlan.length}</span>
        </h2>
        {groups.todaysPlan.length === 0 ? (
          <p className="today-section-empty">No plan steps today. Add a goal above and Tangent will plan it.</p>
        ) : (
          <div className="today-rows">
            <AnimatePresence initial={false}>{groups.todaysPlan.map(row)}</AnimatePresence>
          </div>
        )}
        {planFooter}
      </section>

      <section className="today-section" aria-labelledby="coming-up-title">
        <h2 id="coming-up-title" className="today-section-head">
          <button type="button" className="today-section-toggle" aria-expanded={comingOpen} onClick={() => setComingOpen((o) => !o)}>
            Coming up <span className="today-section-count">{comingCount}</span>
            <ChevronRight size={15} aria-hidden="true" className={comingOpen ? "is-open" : undefined} />
          </button>
        </h2>
        {comingOpen &&
          (comingCount === 0 ? (
            <p className="today-section-empty">Nothing in the next 3 days.</p>
          ) : (
            groups.comingUp.map((day) => (
              <div key={day.date} className="today-day">
                <h3 className="today-day-head">{formatTaskDay(day.date, now, timezone)}</h3>
                <div className="today-rows">{day.tasks.map(row)}</div>
              </div>
            ))
          ))}
      </section>
    </div>
  );
}
