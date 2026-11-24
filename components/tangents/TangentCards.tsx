"use client";

// The Tangents gallery pieces, shared by the Projects page (its Tangents
// section) and /tangents: the cards, the empty state, and the layer that holds
// the New path dialog. Styles live in app/(app)/tangents/tangents.css and need
// a .tangents-light ancestor for the path tokens.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import NewPathDialog, { type PathDraft } from "@/components/tangents/NewPathDialog";
import type { PathWithCounts } from "@/components/tangents/useTangents";
import type { PathGoalKind } from "@/lib/types";
import { formatDeadline } from "@/lib/path-format";
import { prefetchPath } from "@/lib/path-prefetch";
import { friendlyError } from "@/lib/friendly-error";

export function TangentCards({ paths }: { paths: PathWithCounts[] }) {
  return (
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
  );
}

export function TangentsEmpty({
  copy,
  suggestions,
  large = false,
  onStart,
}: {
  copy: { title: string; body: string; cta: string };
  suggestions: string[];
  large?: boolean;
  onStart: (title: string | null) => void;
}) {
  return (
    <section className={`pplan-empty${large ? " is-large" : ""}`}>
      <strong>{copy.title}</strong>
      <span>{copy.body}</span>
      {suggestions.length > 0 && (
        <div className="tg-paths-suggest">
          <span>From what Tangent knows about you</span>
          <div>
            {suggestions.map((title) => (
              <button key={title} type="button" className="tg-chip" onClick={() => onStart(title)}>
                {title}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button variant="primary" onClick={() => onStart(null)}>
        <Plus size={16} aria-hidden="true" /> {copy.cta}
      </Button>
    </section>
  );
}

/** Seeds for an empty gallery: goals Tangent has learned and the student's
 *  projects, so someone with history starts from it, not from nothing. */
export function useTangentSuggestions(planTitles: string[]): string[] {
  const [knownGoals, setKnownGoals] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { context?: { entries?: { category: string; fact: string }[] } }) =>
        setKnownGoals((d.context?.entries ?? []).filter((e) => e.category === "goal").map((e) => e.fact))
      )
      .catch(() => {});
  }, []);
  return Array.from(
    new Set([...knownGoals, ...planTitles].map((t) => t.replace(/^(?:wants|aims|plans|hopes) to /i, "").replace(/\.$/, "").trim()))
  )
    .filter((t) => t.length > 2 && t.length < 70)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .slice(0, 4);
}

/** Creating a Tangent: POST, then straight into it (the reward for answering
 *  six questions is the tree). */
export function useCreateTangent(onError: (message: string) => void) {
  const router = useRouter();
  return useCallback(
    async (draft: PathDraft): Promise<boolean> => {
      try {
        const res = await fetch("/api/path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createPath", ...draft }),
        });
        const data = (await res.json().catch(() => ({}))) as { path?: { id: string }; error?: string };
        if (!res.ok || !data.path) throw new Error(data.error ?? "Couldn't create the Tangent.");
        router.push(`/tangents/${data.path.id}`);
        return true;
      } catch (e) {
        onError(friendlyError(e, "Couldn't create the Tangent."));
        return false;
      }
    },
    [router, onError]
  );
}

/** The body-level light layer for the error line and the New path dialog. */
export function NewTangentLayer({
  error,
  creating,
  seedTitle,
  initialKind,
  onCancel,
  onCreate,
}: {
  error: string | null;
  creating: boolean;
  seedTitle: string | null;
  initialKind: PathGoalKind | null;
  onCancel: () => void;
  onCreate: (draft: PathDraft) => Promise<boolean>;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="tangents-light tangents-layer">
      {error && (
        <p className="path-error is-floating" role="status">
          {error}
        </p>
      )}
      {creating && <NewPathDialog onCancel={onCancel} onCreate={onCreate} initialTitle={seedTitle} initialKind={initialKind} />}
    </div>,
    document.body
  );
}
