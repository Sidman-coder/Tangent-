"use client";

// "When are you already busy?": the one editor for commitments, used by the
// onboarding question and by Settings → Schedule (Round 4 Phase 6). Controlled:
// the caller owns the list and decides when to save it. The shape and its
// rules live in lib/commitments.ts.

import "./commitments.css";

import { Plus, X } from "lucide-react";
import {
  COMMITMENT_KINDS,
  COMMITMENT_KIND_LABELS,
  MAX_BLOCKS,
  MAX_COMMITMENTS,
  MONTH_WEEK_OPTIONS,
  REPEAT_OPTIONS,
  WEEKDAYS,
  commitmentProblem,
  newCommitment,
  nextBlock,
  type Commitment,
  type CommitmentKind,
  type MonthWeek,
  type Repeat,
  type RepeatKind,
  type TimeBlock,
} from "@/lib/commitments";

// Monday first, matching the rest of the app.
const DAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];

const EVERY_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

function repeatFor(kind: RepeatKind, current: Repeat): Repeat {
  if (kind === "monthly") return { kind, week: current.kind === "monthly" ? current.week : 1 };
  if (kind === "custom") return { kind, everyWeeks: current.kind === "custom" ? current.everyWeeks : 3 };
  return { kind };
}

/** Whether every commitment in the list can be saved. */
export function commitmentsReady(list: Commitment[]): boolean {
  return list.every((c) => commitmentProblem(c) === null);
}

export default function CommitmentsList({
  value,
  onChange,
  idPrefix,
}: {
  value: Commitment[];
  onChange: (next: Commitment[]) => void;
  /** Keeps label ids unique when two editors could be on a page. */
  idPrefix: string;
}) {
  const set = (i: number, patch: Partial<Commitment>) => onChange(value.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const setBlock = (i: number, b: number, patch: Partial<TimeBlock>) =>
    set(i, { blocks: value[i].blocks.map((x, k) => (k === b ? { ...x, ...patch } : x)) });
  const add = (kind: CommitmentKind) => onChange([...value, newCommitment(kind)]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));

  return (
    <div className="cmt">
      {value.length > 0 && (
        <ul className="cmt-list">
          {value.map((c, i) => {
            const id = `${idPrefix}-${i}`;
            const problem = commitmentProblem(c);
            const weekdaysOnly = c.repeat.kind === "weekdays";
            const label = c.name.trim() || COMMITMENT_KIND_LABELS[c.kind];
            return (
              <li key={i} className="cmt-card">
                <div className="cmt-card-top">
                  <span className="cmt-kind">{COMMITMENT_KIND_LABELS[c.kind]}</span>
                  <button type="button" className="cmt-icon" aria-label={`Remove ${label}`} onClick={() => remove(i)}>
                    <X size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                </div>

                <div className="cmt-fields">
                  <label className="cmt-field" htmlFor={`${id}-name`}>
                    <span className="cmt-label">Name</span>
                    <input
                      id={`${id}-name`}
                      className="cmt-input"
                      type="text"
                      maxLength={40}
                      autoComplete="off"
                      placeholder={c.kind === "other" ? "e.g. Youth group" : COMMITMENT_KIND_LABELS[c.kind]}
                      value={c.name}
                      onChange={(e) => set(i, { name: e.target.value })}
                    />
                  </label>
                  <label className="cmt-field" htmlFor={`${id}-repeat`}>
                    <span className="cmt-label">Repeats</span>
                    <select
                      id={`${id}-repeat`}
                      className="cmt-input"
                      value={c.repeat.kind}
                      onChange={(e) => {
                        const repeat = repeatFor(e.target.value as RepeatKind, c.repeat);
                        // Every weekday can't include a weekend day.
                        const blocks =
                          repeat.kind === "weekdays"
                            ? c.blocks.map((b) => {
                                const days = b.days.filter((d) => WEEKDAYS.includes(d));
                                return { ...b, days: days.length ? days : [...WEEKDAYS] };
                              })
                            : c.blocks;
                        set(i, { repeat, blocks });
                      }}
                    >
                      {REPEAT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {c.repeat.kind === "monthly" && (
                    <label className="cmt-field" htmlFor={`${id}-week`}>
                      <span className="cmt-label">Which week</span>
                      <select
                        id={`${id}-week`}
                        className="cmt-input"
                        value={String(c.repeat.week)}
                        onChange={(e) => set(i, { repeat: { kind: "monthly", week: Number(e.target.value) as MonthWeek } })}
                      >
                        {MONTH_WEEK_OPTIONS.map((o) => (
                          <option key={o.id} value={String(o.id)}>
                            {o.label} of the month
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {c.repeat.kind === "custom" && (
                    <label className="cmt-field" htmlFor={`${id}-every`}>
                      <span className="cmt-label">How often</span>
                      <select
                        id={`${id}-every`}
                        className="cmt-input"
                        value={String(c.repeat.everyWeeks)}
                        onChange={(e) => set(i, { repeat: { kind: "custom", everyWeeks: Number(e.target.value) } })}
                      >
                        {EVERY_WEEKS.map((n) => (
                          <option key={n} value={String(n)}>
                            {n === 1 ? "Every week" : `Every ${n} weeks`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="cmt-blocks">
                  {c.blocks.map((b, k) => (
                    <fieldset key={k} className="cmt-block">
                      <legend className="cmt-sr">
                        {label}, time {k + 1}
                      </legend>
                      <div className="cmt-days" role="group" aria-label="Days">
                        {DAYS.map((d) => {
                          const on = b.days.includes(d.value);
                          const off = weekdaysOnly && !WEEKDAYS.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              className={`cmt-day${on ? " is-on" : ""}`}
                              aria-pressed={on}
                              aria-label={d.label}
                              disabled={off}
                              onClick={() =>
                                setBlock(i, k, {
                                  days: on ? b.days.filter((x) => x !== d.value) : [...b.days, d.value].sort((x, y) => x - y),
                                })
                              }
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                      <div className="cmt-times">
                        <label className="cmt-sr" htmlFor={`${id}-${k}-start`}>
                          Starts
                        </label>
                        <input id={`${id}-${k}-start`} className="cmt-input cmt-time" type="time" value={b.start} onChange={(e) => setBlock(i, k, { start: e.target.value })} />
                        <span aria-hidden="true">to</span>
                        <label className="cmt-sr" htmlFor={`${id}-${k}-end`}>
                          Ends
                        </label>
                        <input id={`${id}-${k}-end`} className="cmt-input cmt-time" type="time" value={b.end} onChange={(e) => setBlock(i, k, { end: e.target.value })} />
                        {c.blocks.length > 1 && (
                          <button type="button" className="cmt-icon" aria-label={`Remove time ${k + 1}`} onClick={() => set(i, { blocks: c.blocks.filter((_, x) => x !== k) })}>
                            <X size={15} strokeWidth={1.9} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </fieldset>
                  ))}
                  {c.blocks.length < MAX_BLOCKS && (
                    <button type="button" className="cmt-link" onClick={() => set(i, { blocks: [...c.blocks, nextBlock(c)] })}>
                      <Plus size={14} strokeWidth={2} aria-hidden="true" /> Add another time
                    </button>
                  )}
                </div>
                <p className="cmt-problem" role="status">
                  {problem ?? ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {value.length < MAX_COMMITMENTS && (
        <div className="cmt-add" role="group" aria-label="Add something you're busy with">
          {COMMITMENT_KINDS.map((kind) => (
            <button key={kind} type="button" className="cmt-chip" onClick={() => add(kind)}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              {COMMITMENT_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
