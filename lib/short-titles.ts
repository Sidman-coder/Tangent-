"use client";

// Short calendar labels (app/api/short-titles), cached in this browser by
// task id and title, so each title is shortened once and a renamed task gets a
// new label. Titles that are already short are used as they are.

import { useEffect, useState } from "react";
import { splitCourse } from "./course";
import type { Task } from "./types";

const KEY = "tangent-short-titles-v1";
const SHORT_ENOUGH = 26;
const MAX_CACHE = 1500;
const BATCH = 30;

type Cache = Record<string, string>;

function readCache(): Cache {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Cache;
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  try {
    const entries = Object.entries(cache);
    const trimmed = entries.length > MAX_CACHE ? Object.fromEntries(entries.slice(-MAX_CACHE)) : cache;
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}

/** The title calendars show before (or without) a label: course stripped. */
export function baseTitle(task: Pick<Task, "title" | "source">): string {
  return splitCourse(task).title;
}

function cacheKey(task: Pick<Task, "id" | "title">): string {
  return `${task.id}:${task.title}`;
}

let inflight: Promise<void> | null = null;

/** Short labels for the given tasks: { taskId: label }. Fetches what's
 *  missing in the background; until then the course-stripped title shows. */
export function useShortTitles(tasks: Pick<Task, "id" | "title" | "source">[]): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const signature = tasks.map((t) => cacheKey(t)).join("|");

  useEffect(() => {
    const cache = readCache();
    const known: Record<string, string> = {};
    const missing: { id: string; title: string }[] = [];
    for (const t of tasks) {
      const base = baseTitle(t);
      if (base.length <= SHORT_ENOUGH) continue;
      const hit = cache[cacheKey(t)];
      if (hit) known[t.id] = hit;
      else missing.push({ id: t.id, title: t.title });
    }
    setLabels(known);
    if (missing.length === 0 || inflight) return;

    let cancelled = false;
    inflight = (async () => {
      // Short keys ("0", "1", …), not task ids: the model echoes every key
      // back, and 36-character ids made a full batch overflow its reply.
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        try {
          const res = await fetch("/api/short-titles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: batch.map((b, k) => ({ id: String(k), title: b.title })) }),
          });
          const data = (await res.json()) as { ok?: boolean; labels?: Record<string, string> };
          if (!data.ok || !data.labels) continue;
          const next = readCache();
          const fresh: Record<string, string> = {};
          batch.forEach((item, k) => {
            const label = data.labels![String(k)];
            if (!label) return;
            next[`${item.id}:${item.title}`] = label;
            fresh[item.id] = label;
          });
          writeCache(next);
          if (!cancelled) setLabels((prev) => ({ ...prev, ...fresh }));
        } catch {
          continue;
        }
      }
    })().finally(() => {
      inflight = null;
    });
    return () => {
      cancelled = true;
    };
    // The signature covers every id and title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return labels;
}
