// Browser side of the Grill me queue (/api/grill-queue). Today and Settings pick
// changes up through GRILL_EVENT. A failure never blocks: the queue reads empty
// and a question stays where it was.

import type { GrillItem } from "./grill-queue";

export const GRILL_EVENT = "tangent:grill-changed";

async function post<T>(body: unknown): Promise<T | null> {
  try {
    const res = await fetch("/api/grill-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { ok?: boolean };
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function fetchGrill(): Promise<GrillItem[]> {
  try {
    const res = await fetch("/api/grill-queue", { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; items?: GrillItem[] };
    return data.ok ? data.items ?? [] : [];
  } catch {
    return [];
  }
}

/** Queues what a just-confirmed plan earns. `asked`: how many it was asked before its preview. */
export async function seedGrill(planId: string, said: string, asked: number): Promise<GrillItem[]> {
  const data = await post<{ items?: GrillItem[] }>({ action: "seed", planId, said, asked });
  return data?.items ?? [];
}

export type GrillAnswered = { replan: boolean; projectId: string | null; question: string };

export function answerGrill(id: string, answer: string): Promise<GrillAnswered | null> {
  return post<GrillAnswered>({ action: "answer", id, answer });
}

export async function skipGrill(id: string): Promise<void> {
  await post({ action: "skip", id });
}
