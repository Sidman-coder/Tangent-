import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatTime12 } from "@/lib/dates";
import Button from "./Button";

const KIND_LABEL: Record<string, string> = {
  school: "School",
  "academic-ec": "Academics",
  "side-ec": "Activities",
  commitment: "Commitment",
  personal: "Personal",
};

type FocusPanelProps = {
  task: Task | null;
  kindColor?: string;
  relativeLabel?: string;
  nextStep?: string;
  onComplete?: () => void;
  onOpen?: () => void;
  completing?: boolean;
};

export default function FocusPanel({
  task,
  kindColor = "var(--accent)",
  relativeLabel = "Up next",
  nextStep,
  onComplete,
  onOpen,
  completing = false,
}: FocusPanelProps) {
  return (
    <section className="focus-panel" aria-labelledby="focus-panel-title">
      <span className="focus-panel-rail" style={{ background: kindColor }} aria-hidden="true" />
      <div className="focus-panel-copy">
        <span className="focus-panel-label">{task ? relativeLabel : "Schedule clear"}</span>
        <h2 id="focus-panel-title" className="focus-panel-title">
          {task?.title ?? "You’re clear for today."}
        </h2>
        <div className="focus-panel-meta">
          {task ? (
            <>
              <span>{formatTime12(task.time)}</span>
              {task.kind && <span className="focus-panel-kind">{KIND_LABEL[task.kind] ?? task.kind.replaceAll("-", " ")}</span>}
            </>
          ) : (
            <span>Nothing else needs your attention right now.</span>
          )}
        </div>
        {task && nextStep && (
          <div className="focus-panel-nextstep">
            <span className="focus-panel-nextstep-arrow"><ArrowRight size={14} aria-hidden="true" /></span>
            <span>{nextStep}</span>
          </div>
        )}
      </div>
      {task && (
        <div className="focus-panel-actions">
          {onOpen && (
            <Button variant="quiet" size="sm" onClick={onOpen} icon={<ArrowUpRight size={15} aria-hidden="true" />}>
              Open
            </Button>
          )}
          {onComplete && (
            <Button
              variant="primary"
              onClick={onComplete}
              loading={completing}
              loadingLabel="Completing…"
              icon={<Check size={16} aria-hidden="true" />}
            >
              Mark complete
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
