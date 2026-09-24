// Thin wrapper around the Anthropic Message Batches API (raw fetch, matching the
// rest of this codebase's style — there is no @anthropic-ai/sdk dependency here).
// Used only by cron-triggered, non-interactive generation (see
// app/api/cron/daily-brief/route.ts): batches cost ~50% less on input tokens and
// ~25% less on output tokens than the synchronous Messages API, and typically
// finish well within an hour, which is fine for a scheduled job but not for a
// button a student is actively waiting on.

const ANTHROPIC_VERSION = "2023-06-01";

export type BatchRequestItem = {
  custom_id: string;
  params: Record<string, unknown>;
};

type BatchStatus = {
  id: string;
  processing_status: "in_progress" | "canceling" | "ended";
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  results_url: string | null;
};

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

export async function submitMessageBatch(requests: BatchRequestItem[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch("https://api.anthropic.com/v1/messages/batches", {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic batch submit error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function getBatchStatus(batchId: string): Promise<BatchStatus> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
    headers: authHeaders(apiKey),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic batch status error ${res.status}: ${err}`);
  }
  return (await res.json()) as BatchStatus;
}

type BatchResultLine = {
  custom_id: string;
  result:
    | { type: "succeeded"; message: { content?: { type: string; text?: string }[]; stop_reason?: string } }
    | { type: "errored"; error: unknown }
    | { type: "canceled" }
    | { type: "expired" };
};

export async function fetchBatchResults(resultsUrl: string): Promise<BatchResultLine[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch(resultsUrl, { headers: authHeaders(apiKey) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic batch results error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as BatchResultLine);
}
