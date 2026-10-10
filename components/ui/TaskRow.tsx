import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, Repeat2 } from "lucide-react";
import { press, spring } from "@/lib/motion";
import type { Task } from "@/lib/types";
import { formatTime12 } from "@/lib/dates";
import TaskTitle from "@/components/ui/TaskTitle";

const KIND_LABEL: Record<string, string> = {
  school: "School",
  "academic-ec": "Academics",
  "side-ec": "Activities",
  commitment: "Commitment",
  personal: "Personal",
};

type TaskRowProps = {
  task: Task;
  kindColor?: string;
  selected?: boolean;
  expanded?: boolean;
  onComplete?: () => void;
  onOpen?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  /** Tangent has open questions about this task (lib/questions-client.ts). */
  hasQuestions?: boolean;
  /** Lists that span days (a project's steps) show the day, not just the time. */
  showDate?: boolean;
};

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TaskRow({
  task,
  kindColor = "var(--kind-default)",
  selected = false,
  expanded = false,
  onComplete,
  onOpen,
  actions,
  children,
  hasQuestions = false,
  showDate = false,
}: TaskRowProps) {
  const questionDot = hasQuestions ? <span className="task-question-dot" title="Tangent has a question about this" /> : null;
  return (
    <article
      className={`ui-task-row${task.completed ? " is-complete" : ""}${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="ui-task-row-main">
        {onComplete ? (
          <m.button
            type="button"
            className="ui-task-check"
            onClick={onComplete}
            aria-label={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`}
            aria-pressed={task.completed}
            {...press}
          >
            <AnimatePresence initial={false}>
              {task.completed && (
                <m.span
                  key="check"
                  className="ui-task-check-mark"
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, transition: { ...spring.snappy, bounce: 0.2 } }}
                  exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.1 } }}
                >
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                </m.span>
              )}
            </AnimatePresence>
          </m.button>
        ) : (
          <span className="ui-task-check" aria-hidden="true" />
        )}
        <span className="ui-task-kind" style={{ background: kindColor }} aria-hidden="true" />
        <div className="ui-task-copy">
          {onOpen ? (
            <button type="button" className="ui-task-title-button" onClick={onOpen}>
              <TaskTitle task={task} />
              {questionDot}
            </button>
          ) : (
            <span className="ui-task-title"><TaskTitle task={task} />{questionDot}</span>
          )}
          <div className="ui-task-meta">
            <time dateTime={`${task.date}T${task.time}`}>
              {showDate ? `${shortDate(task.date)} · ` : ""}
              {formatTime12(task.time)}
            </time>
            {task.kind && <span className="ui-task-kind-label">{KIND_LABEL[task.kind] ?? task.kind.replaceAll("-", " ")}</span>}
            {task.recurring?.enabled && (
              <span className="ui-task-recurring"><Repeat2 size={12} aria-hidden="true" /> Recurring</span>
            )}
            {task.pathOrigin && (
              <Link href={`/tangents/${task.pathOrigin.pathId}`} className="path-origin-link" title={task.pathOrigin.nodeTitle}>
                From your {task.pathOrigin.pathTitle} path
              </Link>
            )}
          </div>
        </div>
        {actions && <div className="ui-task-actions">{actions}</div>}
      </div>
      {expanded && children && <div className="ui-task-details">{children}</div>}
    </article>
  );
}
