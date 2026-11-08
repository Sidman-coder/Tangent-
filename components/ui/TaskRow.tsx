import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, Repeat2 } from "lucide-react";
import { press, spring } from "@/lib/motion";
import type { Task } from "@/lib/types";
import { formatTime12, isDueOnly } from "@/lib/dates";
import TaskTitle from "@/components/ui/TaskTitle";
import { categoryLabel } from "@/lib/task-colors";


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
  /** A short status chip in the meta line ("2 days overdue", "Due in 5 hr"). */
  flag?: ReactNode;
  /** A 3px stripe and a heavier title: a hard deadline, or a must-do. */
  emphasis?: "deadline" | "must";
  /** Desktop: hide the actions until the row is hovered or focused. */
  revealActions?: boolean;
  /** The project this row is listed under: its name is dropped from the title,
   *  and the project dot and category tag go (every row here shares them). */
  projectName?: string | null;
};

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TaskRow({
  task,
  kindColor = "var(--series-neutral)",
  selected = false,
  expanded = false,
  onComplete,
  onOpen,
  actions,
  children,
  hasQuestions = false,
  showDate = false,
  flag,
  emphasis,
  revealActions = false,
  projectName,
}: TaskRowProps) {
  const questionDot = hasQuestions ? <span className="task-question-dot" title="Tangent has a question about this" /> : null;
  return (
    <article
      className={`ui-task-row${task.completed ? " is-complete" : ""}${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
      aria-current={selected ? "true" : undefined}
      data-emphasis={emphasis}
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
        {!projectName && <span className="ui-task-kind" style={{ background: kindColor }} aria-hidden="true" />}
        <div className="ui-task-copy">
          {onOpen ? (
            <button type="button" className="ui-task-title-button" onClick={onOpen}>
              <TaskTitle task={task} projectName={projectName} />
              {questionDot}
            </button>
          ) : (
            <span className="ui-task-title"><TaskTitle task={task} projectName={projectName} />{questionDot}</span>
          )}
          <div className="ui-task-meta">
            <time dateTime={`${task.date}T${task.time}`}>
              {showDate ? `${shortDate(task.date)} · ` : ""}
              {/* A due date isn't a time anything happens: "Due", as on the calendar. */}
              {isDueOnly(task) ? "Due" : formatTime12(task.time)}
            </time>
            {flag}
            {!projectName && categoryLabel(task) && <span className="ui-task-kind-label">{categoryLabel(task)}</span>}
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
        {actions && <div className="ui-task-actions" data-reveal={revealActions ? "hover" : undefined}>{actions}</div>}
      </div>
      {expanded && children && <div className="ui-task-details">{children}</div>}
    </article>
  );
}
