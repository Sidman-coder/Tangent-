import type { ReactNode } from "react";
import { Check, Repeat2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatTime12 } from "@/lib/dates";

type TaskRowProps = {
  task: Task;
  kindColor?: string;
  selected?: boolean;
  expanded?: boolean;
  onComplete?: () => void;
  onOpen?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function TaskRow({
  task,
  kindColor = "var(--kind-default)",
  selected = false,
  expanded = false,
  onComplete,
  onOpen,
  actions,
  children,
}: TaskRowProps) {
  return (
    <article
      className={`ui-task-row${task.completed ? " is-complete" : ""}${selected ? " is-selected" : ""}${expanded ? " is-expanded" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="ui-task-row-main">
        {onComplete ? (
          <button
            type="button"
            className="ui-task-check"
            onClick={onComplete}
            aria-label={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`}
            aria-pressed={task.completed}
          >
            {task.completed && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        ) : (
          <span className="ui-task-check" aria-hidden="true" />
        )}
        <span className="ui-task-kind" style={{ background: kindColor }} aria-hidden="true" />
        <div className="ui-task-copy">
          {onOpen ? (
            <button type="button" className="ui-task-title-button" onClick={onOpen}>
              {task.title}
            </button>
          ) : (
            <span className="ui-task-title">{task.title}</span>
          )}
          <div className="ui-task-meta">
            <time dateTime={`${task.date}T${task.time}`}>{formatTime12(task.time)}</time>
            {task.kind && <span className="ui-task-kind-label">{task.kind.replace("-", " ")}</span>}
            {task.recurring?.enabled && (
              <span className="ui-task-recurring"><Repeat2 size={12} aria-hidden="true" /> Recurring</span>
            )}
          </div>
        </div>
        {actions && <div className="ui-task-actions">{actions}</div>}
      </div>
      {expanded && children && <div className="ui-task-details">{children}</div>}
    </article>
  );
}
