"use client";

// The day in the order it happens: Past due (with Fresh start), then Morning,
// Afternoon, Evening and Late night on a timeline rail (Round 4 §5.1), then
// Anytime. Only parts with something in them show; if the whole day is empty
// it is one calm line with an action (overnight C10). Past due is "Catch up", folded; each is grouped by
// project, School or Personal, and the Now line sits in the part the clock is
// in. When nothing is left today, the next step is a Next up card (overnight 2,
// N06) and Coming up starts folded, so the step isn't shown twice. The
// question strip sits below the first day section (N16).

import { Fragment, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { ChevronRight, Infinity as AnytimeIcon, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import GroupHeader from "@/components/ui/GroupHeader";
import { seriesColor, taskSeries } from "@/lib/task-colors";
import { formatTaskDay } from "@/lib/task-when";
import { DAY_PARTS, nextAhead, nothingOnDay, nowLine, type DayPart, type TaskBlock, type TodayGroups } from "@/lib/today-sections";
import type { Plan, Task } from "@/lib/types";
import TodayRow, { type TodayRowActions } from "./TodayRow";
import NextUpCard from "./NextUpCard";

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
  /** The row whose split preview should open (the "Too big" answer to "why not today?"). */
  splitTaskId?: string | null;
  onSplitAsked?: () => void;
  /** Fresh start, in the Past due header when it applies. */
  freshStart?: React.ReactNode;
  /** The question strip: shown under the first day section, never above the day. */
  afterFirst?: React.ReactNode;
};

/** Put the cursor in the main composer so "Tell me what's due" is one tap. */
function focusComposer() {
  const el = document.querySelector<HTMLElement>("[data-primary-composer] textarea, [data-primary-composer] input");
  el?.focus();
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function NowRule({ now, timezone }: { now: Date; timezone: string }) {
  const label = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: timezone });
  return (
    <div className="today-now" role="separator" aria-label={`Now, ${label}`} suppressHydrationWarning>
      <span className="today-now-dot" aria-hidden="true" />
      <span className="today-now-time" suppressHydrationWarning>{label}</span>
    </div>
  );
}

export default function TodaySections({ groups, plans, now, today, timezone, busyTaskId, questionTaskIds, splitTaskId, onSplitAsked, freshStart, afterFirst, ...actions }: Props) {
  const [comingOpen, setComingOpen] = useState(() => !(nothingOnDay(groups) && groups.pastDue.length === 0 && nextAhead(groups)));
  const [pastOpen, setPastOpen] = useState(false);
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
        askSplit={splitTaskId === task.id}
        onSplitAsked={onSplitAsked}
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
  const nextStep = nextAhead(groups);
  const timed = groups.parts.filter((g) => g.part !== "anytime");
  const anytime = groups.parts.find((g) => g.part === "anytime");
  const firstPart = timed.find((g) => g.tasks.length > 0)?.part ?? null;

  return (
    <div className="today-sections">
      {groups.counts.pastDue === 0 && freshStart && <div className="today-section-bar is-fresh-only">{freshStart}</div>}
      {groups.counts.pastDue > 0 && (
        <section id="past-due" className="today-section is-past-due" aria-labelledby="past-due-title" tabIndex={-1}>
          <div className="today-section-bar">
            <h2 id="past-due-title" className="today-section-head">
              <button type="button" className="today-section-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen((o) => !o)}>
                Catch up <span className="today-section-count">{groups.counts.pastDue}</span>
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
        <>
          {nextStep ? (
            <NextUpCard
              task={nextStep}
              plans={plans}
              now={now}
              today={today}
              timezone={timezone}
              busy={busyTaskId === nextStep.id}
              onDone={actions.onDone}
              onNotToday={actions.onNotToday}
            />
          ) : (
            <EmptyState icon={<Sun size={20} strokeWidth={1.75} aria-hidden="true" />} title="Nothing planned today.">Say what&apos;s coming up above and I&apos;ll plan it.</EmptyState>
          )}
          {afterFirst}
        </>
      ) : (
        <>
          {timed.every((g) => g.tasks.length === 0) && (!anytime || anytime.tasks.length === 0) && (
            <p className="today-calm">
              <span>Nothing planned for the rest of today.</span>
              <button type="button" className="today-calm-action" onClick={focusComposer}>
                Tell me what&apos;s due this week
              </button>
            </p>
          )}
          {firstPart === null && !(anytime && anytime.tasks.length > 0) && afterFirst}
          <div className="today-timeline">
            {timed.map((group) => {
              const meta = DAY_PARTS.find((p) => p.id === group.part)!;
              const icon = (() => { const Icon = PART_ICONS[group.part]; return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />; })();
              const current = line.part === group.part;
              const nowHere = current && line.before === null;
              const empty = group.tasks.length === 0;
              if (empty) return current && line.before === null ? <NowRule key={group.part} now={now} timezone={timezone} /> : null;
              const collapsed = toggled[group.part] ?? group.open === 0;
              return (
                <Fragment key={group.part}>
                <section
                  className={`today-section today-part${current ? " is-current" : ""}`}
                  aria-label={meta.label}
                >
                  <span className="today-rail-mark" aria-hidden="true">
                    <span className="today-rail-time">{meta.start}</span>
                  </span>
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
                  {!collapsed && group.blocks.map(blockView)}
                  {nowHere && <NowRule now={now} timezone={timezone} />}
                </section>
                {group.part === firstPart && afterFirst ? <div className="today-after-first">{afterFirst}</div> : null}
                </Fragment>
              );
            })}
          </div>
          {anytime && anytime.tasks.length > 0 && (
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
          {firstPart === null && anytime && anytime.tasks.length > 0 && afterFirst}
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
            <p className="today-section-empty">Nothing in the next 7 days.</p>
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
