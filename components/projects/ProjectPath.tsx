"use client";

// Tangents, as a way to see a project: "View path" opens this project's own
// Path (Plan | Map) in a sheet. The first time, it's grown from the project:
// its name, its goal, and the steps already done as the first circle.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Orbit } from "lucide-react";
import PathView from "@/components/path/PathView";
import type { Path, Plan, Task } from "@/lib/types";

async function findOrCreatePath(plan: Plan, steps: Task[]): Promise<string> {
  const res = await fetch("/api/path", { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't load paths.");
  const { paths } = (await res.json()) as { paths: Path[] };
  const existing = paths.find((p) => p.planId === plan.id);
  if (existing) return existing.id;

  const done = steps.filter((t) => t.completed);
  const created = await fetch("/api/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createPath",
      planId: plan.id,
      title: plan.title,
      kind: "other",
      target: plan.description.trim() || plan.title,
      current: `${done.length} of ${steps.length} steps done`,
      // One per line, so a step title with a comma stays one circle.
      standing: done.slice(0, 8).map((t) => t.title).join("\n"),
    }),
  });
  const data = (await created.json().catch(() => ({}))) as { path?: Path; error?: string };
  if (!created.ok || !data.path) throw new Error(data.error ?? "Couldn't make this project's path.");
  return data.path.id;
}

export default function ProjectPath({ plan, steps }: { plan: Plan; steps: Task[] }) {
  const reduced = useReducedMotion();
  const [pathId, setPathId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      setPathId(await findOrCreatePath(plan, steps));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the path.");
    } finally {
      setOpening(false);
    }
  }, [plan, steps]);

  const close = useCallback(() => setPathId(null), []);
  useEffect(() => {
    if (!pathId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathId, close]);

  return (
    <>
      <button type="button" className="ui-button ui-button--secondary project-path-btn" onClick={() => void open()} disabled={opening}>
        <span><Orbit size={15} aria-hidden="true" /> {opening ? "Opening…" : "View path"}</span>
      </button>
      {error && <p className="project-path-error" role="status">{error}</p>}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {pathId && (
              <m.div
                key="sheet"
                className="project-path-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.16 } }}
              >
                <div className="project-path-scrim" onClick={close} aria-hidden="true" />
                <m.div
                  className="project-path-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${plan.title}: path`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", visualDuration: 0.42, bounce: 0.18 } }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20, transition: { duration: 0.18 } }}
                >
                  <PathView pathId={pathId} onClose={close} onDeleted={close} />
                </m.div>
              </m.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
