// What one capture on the capture home came to, read from /api/chat's reply.
// Pure, so every outcome the Sorted card can show is tested here. Clarify
// replies never reach this: the capture home saves first and asks after
// (components/capture/useCapture.ts), so a clarify is resolved before mapping.

import type { ChangeSet } from "./pipeline/changeset";
import type { PreviewPayload } from "./pipeline/draft";

/** The non-streaming /api/chat reply, as AddFlow reads it (components/add/AddFlow.tsx). */
export type ChatReply = {
  ok?: boolean;
  error?: string;
  action?: string | null;
  message?: string;
  response?: string;
  actionId?: string;
  taskId?: string;
  taskDate?: string;
  projectId?: string;
  quick?: boolean;
  plan?: { id: string; title: string } | null;
  questions?: unknown[];
  pending?: { id: string; message: string };
  changeSet?: ChangeSet;
  preview?: PreviewPayload;
};

export type CaptureOutcome =
  | { kind: "saved"; summary: string; actionId: string | null; taskId: string | null; planId: string | null; where: string }
  | { kind: "duplicate"; summary: string }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "preview"; changeSet: ChangeSet; preview: PreviewPayload }
  | { kind: "question"; said: string }
  | { kind: "error"; said: string };

const DUPLICATE = /^Skipped \d+ duplicate/;

function clean(text: string | undefined, fallback: string): string {
  const t = (text ?? "").replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
  return !t || t.startsWith("{") ? fallback : t;
}

export function outcomeFromReply(reply: ChatReply, said: string, dayLabel: (ymd: string) => string): CaptureOutcome {
  if (reply.action === "confirm_required" && reply.pending) return { kind: "confirm", id: reply.pending.id, message: reply.pending.message };
  if (reply.action === "preview" && reply.changeSet && reply.preview) return { kind: "preview", changeSet: reply.changeSet, preview: reply.preview };
  const summary = clean(reply.message ?? reply.response, "Added.");
  if (DUPLICATE.test(summary)) return { kind: "duplicate", summary: "Already on your list" };
  const planId = reply.plan?.id ?? reply.projectId ?? null;
  return {
    kind: "saved",
    summary,
    actionId: reply.actionId ?? null,
    taskId: reply.taskId ?? null,
    planId,
    where: reply.taskDate ? dayLabel(reply.taskDate) : reply.plan?.title ?? (planId ? "Your project" : "Your list"),
  };
}

export function outcomeFromError(said: string): CaptureOutcome {
  return { kind: "error", said };
}
