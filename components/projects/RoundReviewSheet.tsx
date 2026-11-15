"use client";

// Round 5A Phase 5: the end-of-round review. 3 to 5 questions written from
// what happened in the round (dates, moves, check-in codes), answered with a
// chip or a few words. The last one is always "When should round N start?",
// with the next round on a calendar: the old round's steps in their colour
// with an X, other projects grey, the new steps in colour. Start now / Push 1
// week / Pick a date move the new round live. Confirm goes through the usual
// changeset confirm; the round line is in the same changeset, so Undo takes
// the steps out and puts the round number back.

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Sheet from "@/components/ui/Sheet";
import PreviewWeek from "@/components/PreviewWeek";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import { previewWeeks } from "@/lib/preview-week";
import { roundOf, roundSteps } from "@/lib/rounds";
import { shiftRound, startDate, START_QUESTION_ID, type ReviewAnswer, type ReviewQuestion, type StartChoice } from "@/lib/round-review";
import { getUserToday } from "@/lib/time";
import { planSeriesColor } from "@/lib/task-colors";

type Phase = "loading" | "asking" | "drafting" | "start" | "confirming" | "done" | "error";

/** /dev/app preview: questions and a drafted round, with no network. */
export type RoundReviewSample = { questions: ReviewQuestion[]; ops: ChangeSet["ops"]; next: number; at?: number; oldIds?: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onChanged: () => void;
  sample?: RoundReviewSample;
};

const ANSWER_MAX = 200;

async function post(url: string, body?: unknown): Promise<Record<string, unknown> & { ok?: boolean }> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean };
  return res.ok ? data : { ...data, ok: false };
}

const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

export default function RoundReviewSheet({ open, onClose, projectId, onChanged, sample }: Props) {
  const { state } = useAppState();
  const today = getUserToday(useUserTimezone());
  const plan = state?.plans.find((p) => p.id === projectId) ?? null;
  const round = roundOf(plan?.description);

  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { chip?: string; text?: string }>>({});
  const [next, setNext] = useState((round?.n ?? 1) + 1);
  const [draft, setDraft] = useState<ChangeSet | null>(null);
  const [choice, setChoice] = useState<StartChoice>({ kind: "now" });
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);

  // Open: fresh questions each time.
  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setDraft(null);
    setChoice({ kind: "now" });
    setPicked("");
    setError(null);
    setUndone(false);
    if (sample) {
      setQuestions(sample.questions);
      setNext(sample.next);
      const at = Math.min(sample.at ?? 0, sample.questions.length - 1);
      setIndex(at);
      if (sample.questions[at]?.kind === "start") {
        setDraft({ id: "sample", ops: sample.ops, status: "draft" } as ChangeSet);
        setPhase("start");
      } else setPhase("asking");
      return;
    }
    let live = true;
    setPhase("loading");
    setIndex(0);
    fetch(`/api/rounds/review?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; questions?: ReviewQuestion[]; next?: number } | null) => {
        if (!live) return;
        if (!d?.ok || !d.questions?.length) return setPhase("error");
        setQuestions(d.questions);
        if (typeof d.next === "number") setNext(d.next);
        setPhase("asking");
      })
      .catch(() => live && setPhase("error"));
    return () => {
      live = false;
    };
  }, [open, projectId, sample]);

  const question = questions[index];
  const answerList = useCallback(
    (): ReviewAnswer[] =>
      questions
        .filter((q) => q.kind === "answer" && (answers[q.id]?.chip || answers[q.id]?.text?.trim()))
        .map((q) => ({ questionId: q.id, question: q.text, chip: answers[q.id]?.chip, text: answers[q.id]?.text?.trim() || undefined })),
    [questions, answers]
  );

  /** Reaching the last question: keep the answers, then draft the next round with them. */
  const draftNext = async () => {
    if (sample) {
      setDraft({ id: "sample", ops: sample.ops, status: "draft" } as ChangeSet);
      setPhase("start");
      return;
    }
    setPhase("drafting");
    const said = answerList();
    if (said.length) void post("/api/rounds/review", { projectId, answers: said }).catch(() => undefined);
    try {
      const data = await post("/api/rounds", { action: "propose", projectId, answers: said });
      const cs = data.changeSet as ChangeSet | undefined;
      if (data.action === "preview" && cs) {
        setDraft(cs);
        setPhase("start");
      } else setPhase("error");
    } catch {
      setPhase("error");
    }
  };

  const goNext = () => {
    const after = index + 1;
    if (questions[after]?.kind === "start") {
      setIndex(after);
      void draftNext();
    } else if (after < questions.length) setIndex(after);
  };

  const start = startDate(choice.kind === "date" ? { kind: "date", date: picked || today } : choice, today);
  const shifted = useMemo(() => (draft ? shiftRound(draft.ops, start) : []), [draft, start]);
  // The round being replaced: this project's steps since its round started.
  const oldIds = useMemo(() => {
    if (sample?.oldIds) return new Set(sample.oldIds);
    const mine = (state?.tasks ?? []).filter((t) => t.planId === projectId);
    return new Set(roundSteps(mine, round).map((t) => t.id));
  }, [state?.tasks, projectId, round, sample?.oldIds]);
  const weeks = useMemo(
    () => (shifted.length ? previewWeeks(shifted, state?.tasks ?? [], state?.plans ?? [], undefined, oldIds) : []),
    [shifted, state?.tasks, state?.plans, oldIds]
  );
  const stepCount = shifted.filter((o) => o.op === "add_task").length;

  const confirm = async () => {
    if (!draft) return;
    if (sample) return setPhase("done");
    setPhase("confirming");
    setError(null);
    try {
      const moved = await post("/api/rounds", { action: "schedule", projectId, changeSetId: draft.id, startDate: start });
      if (!moved.ok) throw new Error(typeof moved.error === "string" ? moved.error : "Couldn't move the round.");
      const done = await post(`/api/changesets/${encodeURIComponent(draft.id)}/confirm`);
      if (!done.ok) throw new Error(typeof done.message === "string" ? done.message : "Couldn't add the round.");
      // A description too long for the op: move the round line on directly.
      if (moved.hasRoundOp === false) await post("/api/rounds", { action: "advance", projectId });
      setPhase("done");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("start");
    }
  };

  const undo = async () => {
    if (!draft || sample) return setUndone(true);
    const data = await post(`/api/changesets/${encodeURIComponent(draft.id)}/undo`).catch(() => ({ ok: false }));
    if (data.ok) {
      setUndone(true);
      onChanged();
    } else setError("Couldn't undo that just now.");
  };

  const discardAndClose = () => {
    if (draft && !sample && (phase === "start" || phase === "drafting")) void post(`/api/changesets/${encodeURIComponent(draft.id)}/discard`).catch(() => undefined);
    onClose();
  };

  const current = question ? answers[question.id] ?? {} : {};
  const setAnswer = (patch: { chip?: string; text?: string }) => question && setAnswers((a) => ({ ...a, [question.id]: { ...a[question.id], ...patch } }));
  const asked = questions.filter((q) => q.kind === "answer").length;

  const footer =
    phase === "asking" ? (
      <div className="round-sheet-actions">
        <button type="button" className="round-review-quiet" onClick={discardAndClose}>Stop</button>
        <span className="round-sheet-spacer" />
        <Button size="sm" variant="ghost" onClick={goNext}>Skip</Button>
        <Button size="sm" variant="primary" onClick={goNext} disabled={!current.chip && !current.text?.trim()}>Next</Button>
      </div>
    ) : phase === "start" || phase === "confirming" ? (
      <div className="round-sheet-actions">
        <button type="button" className="round-review-quiet" onClick={discardAndClose}>Not now</button>
        <span className="round-sheet-spacer" />
        <Button size="sm" variant="primary" onClick={() => void confirm()} loading={phase === "confirming"} disabled={!draft || stepCount === 0}>
          Start round {next} {start === today ? "today" : `on ${dayLabel(start)}`}
        </Button>
      </div>
    ) : phase === "done" ? (
      <div className="round-sheet-actions">
        {!undone && <Button size="sm" variant="ghost" onClick={() => void undo()}>Undo</Button>}
        <span className="round-sheet-spacer" />
        <Button size="sm" variant="primary" onClick={onClose}>Done</Button>
      </div>
    ) : null;

  return (
    <Sheet open={open} onClose={discardAndClose} variant="modal" title={`Round ${next - 1} review`} footer={footer} className="round-sheet">
      {phase === "loading" && <p className="round-sheet-status" role="status">Looking at how the round went…</p>}
      {phase === "error" && (
        <div className="round-sheet-status" role="alert">
          <p>Couldn&apos;t load the review just now.</p>
          <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      )}

      {phase === "asking" && question && (
        <div className="round-sheet-question" key={question.id}>
          <p className="round-sheet-count">Question {index + 1} of {asked + 1}</p>
          <h3>{question.text}</h3>
          <div className="round-sheet-chips" role="group" aria-label="Answers">
            {question.chips.map((c) => (
              <Chip key={c} variant="filter" selected={current.chip === c} onClick={() => setAnswer({ chip: current.chip === c ? undefined : c })}>
                {c}
              </Chip>
            ))}
          </div>
          <label className="round-sheet-text">
            <span>Or in a few words</span>
            <input
              type="text"
              maxLength={ANSWER_MAX}
              value={current.text ?? ""}
              onChange={(e) => setAnswer({ text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (current.chip || current.text?.trim())) goNext();
              }}
              placeholder="Optional"
            />
          </label>
        </div>
      )}

      {phase === "drafting" && (
        <div className="round-sheet-question">
          <p className="round-sheet-count">Last question</p>
          <h3>{question?.text ?? `When should round ${next} start?`}</h3>
          <p className="round-sheet-status" role="status">Planning round {next} from your answers…</p>
        </div>
      )}

      {(phase === "start" || phase === "confirming") && (
        <div className="round-sheet-question">
          <p className="round-sheet-count">Last question</p>
          <h3>{questions.find((q) => q.id === START_QUESTION_ID)?.text ?? `When should round ${next} start?`}</h3>
          <div className="round-sheet-chips" role="group" aria-label="Start">
            <Chip variant="filter" selected={choice.kind === "now"} onClick={() => setChoice({ kind: "now" })}>Start now</Chip>
            <Chip variant="filter" selected={choice.kind === "push"} onClick={() => setChoice({ kind: "push" })}>Push 1 week</Chip>
            <Chip variant="filter" selected={choice.kind === "date"} onClick={() => setChoice({ kind: "date", date: picked || today })}>Pick a date</Chip>
          </div>
          {choice.kind === "date" && (
            <label className="round-sheet-text round-sheet-date">
              <span>Start on</span>
              <input type="date" min={today} value={picked || today} onChange={(e) => setPicked(e.target.value)} />
            </label>
          )}
          <p className="round-sheet-summary">
            {stepCount} step{stepCount === 1 ? "" : "s"} from {dayLabel(start)}.
          </p>
          {weeks.length > 0 && <PreviewWeek key={`${start}-${weeks.length}`} weeks={weeks} />}
          <ul className="round-sheet-legend" aria-label="Key" style={plan ? ({ "--project-color": planSeriesColor(plan) } as React.CSSProperties) : undefined}>
            <li><i className="is-new" aria-hidden="true" />Round {next}</li>
            <li><i className="is-removed" aria-hidden="true" />Round {next - 1}</li>
            <li><i className="is-existing" aria-hidden="true" />Everything else</li>
          </ul>
          {error && <p className="round-review-error" role="alert">{error}</p>}
        </div>
      )}

      {phase === "done" && (
        <div className="round-sheet-question" role="status">
          <h3>{undone ? `Round ${next} is off your calendar` : `Round ${next} starts ${start === today ? "today" : dayLabel(start)}`}</h3>
          <p className="round-sheet-summary">
            {undone ? `You're still on round ${next - 1}.` : `${stepCount} step${stepCount === 1 ? "" : "s"} are on your calendar.`}
          </p>
          {error && <p className="round-review-error" role="alert">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
