"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import type { Path } from "@/lib/types";
import { formatDeadline } from "@/lib/path-format";
import { prefetchPath } from "@/lib/path-prefetch";
import NewPathDialog from "@/components/tangents/NewPathDialog";
import type { PathDraft } from "@/components/tangents/NewPathDialog";
import { useAppState } from "@/components/AppStateProvider";
import { takeNewPathTitle } from "@/lib/path-handoff";
import { initialPathKind, pathsEmptyCopy, prefsOf } from "@/lib/personalize";
import "./tangents.css";

type PathWithCounts = Path & {
  counts: { work: number; ideas: number; kept: number; done: number };
};

export default function TangentsPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<PathWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seedTitle, setSeedTitle] = useState<string | null>(null);
  const { state } = useAppState();
  const prefs = prefsOf(state?.user);

  // /tangents?new=1 comes from Home: open the dialog, with the student's
  // starting point if they chose "Make it a Path", then drop the flag so a
  // reload doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    setSeedTitle(takeNewPathTitle());
    setCreating(true);
    router.replace("/tangents");
  }, [router]);

  // Seeds for an empty orbit: goals Tangent has learned and the student's
  // projects, so someone with history starts from it, not from nothing.
  const [knownGoals, setKnownGoals] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { context?: { entries?: { category: string; fact: string }[] } }) =>
        setKnownGoals((d.context?.entries ?? []).filter((e) => e.category === "goal").map((e) => e.fact))
      )
      .catch(() => {});
  }, []);
  const suggestions = Array.from(
    new Set([...knownGoals, ...(state?.plans ?? []).map((p) => p.title)].map((t) => t.replace(/^(?:wants|aims|plans|hopes) to /i, "").replace(/\.$/, "").trim()))
  )
    .filter((t) => t.length > 2 && t.length < 70)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .slice(0, 4);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/path", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load your paths (${res.status})`);
      const data = (await res.json()) as { paths: PathWithCounts[] };
      setPaths(data.paths ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your paths.");
      setPaths([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: PathDraft): Promise<boolean> => {
    try {
      const res = await fetch("/api/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createPath", ...draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { path?: { id: string }; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Couldn't create the path.");
      // Straight into it: the reward for answering six questions is the tree.
      router.push(`/tangents/${data.path.id}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the path.");
      return false;
    }
  };

  const empty = pathsEmptyCopy(prefs);

  return (
    <div className="tangents-gallery tangents-light">
      <PageHeader
        title="Tangents"
        description="Where you want to be in a year or more. Tangent maps the moves from what you already do."
        actions={
          paths && paths.length > 0 ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
              New path
            </Button>
          ) : undefined
        }
      />

      {paths === null ? (
        <p className="pplan-loading">Loading your paths…</p>
      ) : paths.length === 0 ? (
        <section className="pplan-empty is-large">
          <strong>{empty.title}</strong>
          <span>{empty.body}</span>
          {suggestions.length > 0 && (
            <div className="tg-paths-suggest">
              <span>From what Tangent knows about you</span>
              <div>
                {suggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    className="tg-chip"
                    onClick={() => {
                      setSeedTitle(title);
                      setCreating(true);
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> {empty.cta}
          </Button>
        </section>
      ) : (
        <div className="tg-paths">
          {paths.map((p) => {
            const when = formatDeadline(p.deadline);
            // The API's "kept" also counts the activities themselves (stored as
            // accepted), so moves kept = kept minus the work on the circle.
            const moves = Math.max(0, p.counts.kept - p.counts.work);
            const progress = p.counts.ideas ? Math.min(1, (moves + p.counts.done) / (p.counts.ideas + p.counts.done)) : 0;
            return (
              <Link
                key={p.id}
                href={`/tangents/${p.id}`}
                className="tg-path-card"
                onMouseEnter={() => void prefetchPath(p.id)}
                onFocus={() => void prefetchPath(p.id)}
              >
                <div className="tg-path-top">
                  <h2>{p.title}</h2>
                  {when && <span className="tg-path-when">{when}</span>}
                </div>
                {p.target && p.target !== p.title && <p className="tg-path-target">{p.target}</p>}
                <div className="tg-path-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${progress})` }} />
                </div>
                <div className="tg-path-foot">
                  <span>
                    {p.counts.work} you already do · {moves} move{moves === 1 ? "" : "s"} kept
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <div className="tangents-light tangents-layer">
            {error && (
              <p className="path-error is-floating" role="status">
                {error}
              </p>
            )}
            {creating && (
              <NewPathDialog
                onCancel={() => {
                  setCreating(false);
                  setSeedTitle(null);
                }}
                onCreate={create}
                initialTitle={seedTitle}
                initialKind={initialPathKind(prefs)}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
