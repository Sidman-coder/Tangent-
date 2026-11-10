"use client";

// The day in the order it happens: Past due (with Fresh start), then Morning,
// Afternoon, Evening and Late night on a timeline rail (Round 4 §5.1), then
// Anytime. Every part shows, an empty one as a faint row; each is grouped by
// project, School or Personal, and the Now line sits in the part the clock is
// in. Coming up stays folded away.

import { Fragment, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { ChevronRight, Infinity as AnytimeIcon, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import GroupHeader from "@/components/ui/GroupHeader";
import { seriesColor, taskSeries } from "@/lib/task-colors";
import { formatTaskDay } from "@/lib/task-when";
import { DAY_PARTS, nothingOnDay, nowLine, type DayPart, type TaskBlock, type TodayGroups } from "@/lib/today-sections";
import type { Plan, Task } from "@/lib/types";
import TodayRow, { type TodayRowActions } from "./TodayRow";

const PART_ICONS: Record<DayPart, typeof Sun> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
  anytime: AnytimeIcon,
};

type Props = TodayRowActions & {
  groups: TodayGroups;
  plans: readonly Plan[];
  now: Date;
  today: string;
  timezone: string;
  busyTaskId: string | null;
  questionTaskIds: ReadonlySet<string>;
  /** Fresh start, in the Past due header when it applies. */
  freshStart?: React.ReactNode;
};

function NowRule({ now, timezone }: { now: Date; timezone: string }) {
  const label = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: timezone });
  return (
    <div className="today-now" role="separator" aria-label={`Now, ${label}`}>
      <span className="today-now-dot" aria-hidden="true" />
      <span className="today-now-time">{label}</span>
    </div>
  );
}

export default function TodaySections({ groups, plans, now, today, timezone, busyTaskId, questionTaskIds, freshStart, ...actions }: Props) {
  const [comingOpen, setComingOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(true);
  const [toggled, setToggled] = useState<Partial<Record<DayPart, boolean>>>({});
  const comingCount = groups.comingUp.reduce((n, day) => n + day.tasks.length, 0);
  const line = nowLine(groups, now, timezone);
  const nowBefore = line.before;

  const row = (task: Task) => (
    <Fragment key={task.id}>
      {nowBefore === task.id && <NowRule now={now} timezone={timezone} />}
      <TodayRow
        task={task}
        plans={plans}
        now={now}
        today={today}
        timezone={timezone}
        busy={busyTaskId === task.id}
        hasQuestions={questionTaskIds.has(task.id)}
        {...actions}
      />
    </Fragment>
  );

  const blockView = (block: TaskBlock) => (
    <div key={block.key} className="today-block">
      <GroupHeader
        variant="project"
        as="h3"
        title={blockTitle(block)}
        color={seriesColor(taskSeries(block.tasks[0], plans))}
        href={block.planId ? `/projects/${block.planId}` : undefined}
      />
      <div className="today-rows">
        <AnimatePresence initial={false}>{block.tasks.map(row)}</AnimatePresence>
      </div>
    </div>
  );

  const blockTitle = (block: TaskBlock) => {
    if (block.kind === "school") return "School";
    if (block.kind === "personal") return "Personal";
    return plans.find((p) => p.id === block.planId)?.title ?? block.title ?? "Project";
  };

  const nothingToday = nothingOnDay(groups) && groups.pastDue.length === 0;
  const timed = groups.parts.filter((g) => g.part !== "anytime");
  const anytime = groups.parts.find((g) => g.part === "anytime");

  return (
    <div className="today-sections">
      {groups.counts.pastDue === 0 && freshStart && <div className="today-section-bar is-fresh-only">{freshStart}</div>}
      {groups.counts.pastDue > 0 && (
        <section id="past-due" className="today-section is-past-due" aria-labelledby="past-due-title" tabIndex={-1}>
          <div className="today-section-bar">
            <h2 id="past-due-title" className="today-section-head">
              <button type="button" className="today-section-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen((o) => !o)}>
                Past due <span className="today-section-count">{groups.counts.pastDue}</span>
                <ChevronRight size={15} aria-hidden="true" className={pastOpen ? "is-open" : undefined} />
              </button>
            </h2>
            {freshStart}
          </div>
          {pastOpen && groups.pastDue.length > 0 && (
            <div className="today-rows">
              <AnimatePresence initial={false}>{groups.pastDue.map(row)}</AnimatePresence>
            </div>
          )}
          {groups.olderPastDueCount > 0 && (
            <Link href="/calendar" className="today-section-more">
              +{groups.olderPastDueCount} older on your calendar
            </Link>
          )}
        </section>
      )}

      {nothingToday ? (
        <EmptyState icon={<Sun size={20} strokeWidth={1.75} aria-hidden="true" />} title="You&apos;re all caught up.">Anything on your mind? Say it above.</EmptyState>
      ) : (
        <>
          <div className="today-timeline">
            {timed.map((group) => {
              const meta = DAY_PARTS.find((p) => p.id === group.part)!;
              const icon = (() => { const Icon = PART_ICONS[group.part]; return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />; })();
              const current = line.part === group.part;
              const nowHere = current && line.before === null;
              const empty = group.tasks.length === 0;
              const collapsed = toggled[group.part] ?? group.open === 0;
              return (
                <section
                  key={group.part}
                  className={`today-section today-part${empty ? " is-empty" : ""}${current ? " is-current" : ""}`}
                  aria-label={empty ? `${meta.label}: ${meta.empty.toLowerCase()}` : meta.label}
                >
                  <span className="today-rail-mark" aria-hidden="true">
                    <span className="today-rail-time">{meta.start}</span>
                  </span>
                  {empty ? (
                    <GroupHeader
                      variant="time"
                      as="h2"
                      title={meta.label}
                      icon={icon}
                      range={meta.range}
                      action={<span className="today-part-empty">{meta.empty}</span>}
                    />
                  ) : (
                    <GroupHeader
                      variant="time"
                      as="h2"
                      title={meta.label}
                      icon={icon}
                      range={meta.range}
                      count={group.open}
                      collapsed={collapsed}
                      onToggle={() => setToggled((t) => ({ ...t, [group.part]: !collapsed }))}
                    />
                  )}
                  {!collapsed && group.blocks.map(blockView)}
                  {nowHere && <NowRule now={now} timezone={timezone} />}
                </section>
              );
            })}
          </div>
          {anytime && (
            <section className="today-section today-part is-anytime" aria-label="Anytime today">
              <GroupHeader
                variant="time"
                as="h2"
                title="Anytime today"
                icon={<AnytimeIcon size={16} strokeWidth={1.75} aria-hidden="true" />}
                count={anytime.open}
                collapsed={toggled.anytime ?? anytime.open === 0}
                onToggle={() => setToggled((t) => ({ ...t, anytime: !(t.anytime ?? anytime.open === 0) }))}
              />
              {!(toggled.anytime ?? anytime.open === 0) && anytime.blocks.map(blockView)}
            </section>
          )}
        </>
      )}

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
