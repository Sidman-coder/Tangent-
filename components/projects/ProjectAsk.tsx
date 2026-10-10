"use client";

// One ask to Tangent, start to finish, in place: type → Tangent's questions
// (answer or "Just do it") → it builds → the result with Undo. Used to start a
// project on /projects and to add to one on /projects/[id]. Big asks always
// get questions first; small ones get them afterwards (lib/questions-client.ts).

import { useCallback, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import SuggestionCard, { type Suggestion } from "@/components/console/SuggestionCard";
import { applyPlanProgress, readChatReply, type PlanProgressView } from "@/components/console/turns";
import { generateQuestions } from "@/lib/questions-client";

type Reply = {
  ok?: boolean;
  error?: string;
  action?: string;
  message?: string;
  actionId?: string;
  taskId?: string;
  projectId?: string;
  questions?: ClarifyQuestion[];
  suggestion?: Suggestion | null;
};

type Phase =
  | { kind: "idle" }
  | { kind: "working"; request: string }
  | { kind: "questions"; request: string; questions: ClarifyQuestion[] }
  | { kind: "done"; message: string; actionId?: string; suggestion?: Suggestion | null }
  | { kind: "error"; message: string };

type Props = {
  placeholder: string;
  /** Sent with every request: { newProject: true } or { projectId }. */
  context: Record<string, unknown>;
  submitLabel?: string;
  autoFocus?: boolean;
  /** After Tangent acted; projectId is set when a project was created or changed. */
  onDone?: (reply: { projectId?: string }) => void;
  onChanged?: () => void;
};

export default function ProjectAsk({ placeholder, context, submitLabel = "Ask", autoFocus, onDone, onChanged }: Props) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [progress, setProgress] = useState<PlanProgressView | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(
    async (request: string, answers?: ClarifyAnswer[] | null) => {
      setPhase({ kind: "working", request });
      setProgress(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: request }],
            stream: true,
            // First pass may be grilled; a follow-up (answers or Just do it) acts.
            clarify: answers === undefined,
            answers: answers ?? undefined,
            ...context,
          }),
        });
        const data = (await readChatReply(res, (line) => setProgress((v) => applyPlanProgress(v, line)))) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");
        if (data.action === "clarify" && data.questions?.length) {
          setPhase({ kind: "questions", request, questions: data.questions });
          return;
        }
        setPhase({ kind: "done", message: data.message ?? "Done.", actionId: data.actionId, suggestion: data.suggestion });
        setText("");
        onChanged?.();
        if (data.taskId && answers === undefined) void generateQuestions(data.taskId, request);
        onDone?.({ projectId: data.projectId });
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      } finally {
        setProgress(null);
      }
    },
    [context, onChanged, onDone]
  );

  const submit = () => {
    const request = text.trim();
    if (!request || phase.kind === "working") return;
    void run(request);
  };

  const working = phase.kind === "working";
  const built = progress?.tasks.filter(Boolean).length ?? 0;

  return (
    <div className="project-ask">
      {phase.kind !== "questions" && (
        <div className={`project-ask-box${working ? " is-working" : ""}`}>
          <textarea
            ref={inputRef}
            className="project-ask-input"
            value={working ? phase.request : text}
            placeholder={placeholder}
            rows={2}
            autoFocus={autoFocus}
            disabled={working}
            aria-label={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            className="project-ask-send"
            onClick={submit}
            disabled={working || !text.trim()}
            aria-label={submitLabel}
          >
            {working ? <span className="project-ask-spinner" aria-hidden="true" /> : <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />}
          </button>
        </div>
      )}

      {working && (
        <p className="project-ask-status" role="status">
          {progress?.title
            ? `Building "${progress.title}" — ${built} of ${progress.taskCount} steps`
            : "Thinking it through…"}
        </p>
      )}

      {phase.kind === "questions" && (
        <div className="project-ask-questions">
          <p className="project-ask-request">{phase.request}</p>
          <ClarifyCard
            questions={phase.questions}
            onSubmit={(answers) => void run(phase.request, answers ?? null)}
          />
        </div>
      )}

      {phase.kind === "done" && (
        <div className="project-ask-result" role="status">
          {phase.actionId ? (
            <ActionReceipt actionId={phase.actionId} label={phase.message} onUndone={onChanged} />
          ) : (
            <p>{phase.message}</p>
          )}
          {phase.suggestion && <SuggestionCard suggestion={phase.suggestion} onMoved={() => onChanged?.()} />}
        </div>
      )}

      {phase.kind === "error" && <p className="project-ask-error" role="alert">{phase.message}</p>}
    </div>
  );
}
