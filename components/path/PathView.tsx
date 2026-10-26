"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ListChecks, Orbit, Trash2, X } from "lucide-react";
import PathScene from "@/components/path/PathScene";
import PathInspector from "@/components/path/PathInspector";
import PathWorkForm from "@/components/path/PathWorkForm";
import PathPlan from "@/components/path/PathPlan";
import DeletePathDialog from "@/components/tangents/DeletePathDialog";
import type { Path, PathNode, PathNodeSchedule } from "@/lib/types";
import { pathMeta } from "@/lib/path-format";
import { takePrefetchedPath } from "@/lib/path-prefetch";
import "../../app/(app)/tangents/tangents.css";

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? `Request failed (${res.status})`));
  return data;
}

// One Path's Plan | Map. A page of its own (/tangents/[pathId], for links
// from tasks and the calendar), or a sheet over a project (Projects → View
// path), where `onClose` replaces the back link.
type Props = {
  pathId: string;
  /** Where "back" goes, and where a deleted path sends you, as a page. */
  backHref?: string;
  backLabel?: string;
  /** Shown as a sheet: a close button instead of the back link. */
  onClose?: () => void;
  onDeleted?: () => void;
};

export default function PathView({ pathId, backHref = "/projects", backLabel = "Projects", onClose, onDeleted }: Props) {
  const router = useRouter();

  // Opened from the gallery, the data is usually already here: draw at once.
  const [prefetched] = useState(() => (pathId ? takePrefetchedPath(pathId) : null));
  const [path, setPath] = useState<Path | null>(prefetched?.path ?? null);
  const [nodes, setNodes] = useState<PathNode[]>(prefetched?.nodes ?? []);
  const [scheduled, setScheduled] = useState<Record<string, PathNodeSchedule>>(prefetched?.scheduled ?? {});
  const [justKept, setJustKept] = useState<string | null>(null);
  const [loading, setLoading] = useState(!prefetched);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formParent, setFormParent] = useState<{ parentId: string | null } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Plan is the readable default; the circle map is a toggle.
  const [view, setView] = useState<"plan" | "map">("plan");
  const [deleting, setDeleting] = useState(false);

  const fitRef = useRef<(() => void) | null>(null);
  const registerFit = useCallback((fn: () => void) => {
    fitRef.current = fn;
  }, []);

  const load = useCallback(async () => {
    if (!pathId) return;
    try {
      const res = await fetch(`/api/path?pathId=${encodeURIComponent(pathId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load this path (${res.status})`);
      const data = (await res.json()) as {
        path: Path;
        nodes: PathNode[];
        scheduled?: Record<string, PathNodeSchedule>;
      };
      setPath(data.path);
      setNodes(data.nodes ?? []);
      setScheduled(data.scheduled ?? {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this path.");
    } finally {
      setLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    // Prefetched: it's fresh enough to draw, and nothing reloads under the entrance.
    if (prefetched) return;
    void load();
  }, [load, prefetched]);

  const run = useCallback(
    async (body: Record<string, unknown>, busyKey?: string) => {
      setBusyId(busyKey ?? "*");
      setError(null);
      try {
        const data = await post(body);
        await load();
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const generate = useCallback(
    async (parentId: string, answers?: { question: string; answer: string }[]) => {
      const data = await run({ action: "generate", parentId, ...(answers?.length ? { answers } : {}) }, parentId);
      // Opening the circle straight away is the whole reward for asking.
      if (data) setExpanded((prev) => new Set(prev).add(parentId));
    },
    [run]
  );

  // Its own handler rather than run(): run() reloads the path afterwards, and
  // after a delete there is nothing left to load. Straight back to the field.
  const remove = useCallback(async () => {
    if (!path) return;
    setDeleting(true);
    setError(null);
    try {
      await post({ action: "deletePath", id: path.id });
      if (onDeleted) onDeleted();
      else router.replace(backHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this path.");
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }, [path, router, onDeleted, backHref]);

  const toggleExpand = useCallback(
    (id: string) => {
      const opening = !expanded.has(id);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (opening) next.add(id);
        else next.delete(id);
        return next;
      });
      if (opening) setFocusedId(id);
    },
    [expanded]
  );

  const focused = useMemo(() => nodes.find((n) => n.id === focusedId) ?? null, [focusedId, nodes]);

  // The time picker opens by itself only right after "Keep this", not every
  // time you come back to that branch.
  useEffect(() => {
    setJustKept(null);
  }, [focusedId]);

  // Tidy: keep open only the circles on the way to what you are looking at,
  // then frame what is left. The clutter control for a tree that has grown.
  const tidy = useCallback(() => {
    const keep = new Set<string>();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let cursor = focusedId ? byId.get(focusedId) : undefined;
    let guard = 0;
    while (cursor && guard++ < 32) {
      keep.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    setExpanded((prev) => new Set(Array.from(prev).filter((id) => keep.has(id))));
    // After the collapse has laid out.
    setTimeout(() => fitRef.current?.(), 60);
  }, [focusedId, nodes]);

  const ancestry = useMemo(() => {
    if (!focused) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const chain: PathNode[] = [];
    let cursor: PathNode | undefined = focused;
    let guard = 0;
    while (cursor && guard++ < 32) {
      chain.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [focused, nodes]);

  // What the confirm dialog names as the loss. Dismissed branches are left out:
  // they go too, but nobody counts something they already said no to.
  const counts = useMemo(() => {
    const live = nodes.filter((n) => n.status !== "dismissed");
    return {
      work: live.filter((n) => n.kind === "work").length,
      ideas: live.filter((n) => n.kind === "idea").length,
    };
  }, [nodes]);

  const childCount = useMemo(
    () => (focused ? nodes.filter((n) => n.parentId === focused.id && n.status !== "dismissed").length : 0),
    [focused, nodes]
  );

  if (loading) {
    return (
      <div className="pplan-page tangents-light" aria-busy="true">
        <p className="pplan-loading">Loading this path…</p>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="pplan-page tangents-light">
        <div className="pplan-empty">
          <strong>That path isn&apos;t here</strong>
          <span>It may have been removed, or the link is from another account.</span>
          {onClose ? (
            <button type="button" className="pplan-back" onClick={onClose}>Close</button>
          ) : (
            <Link href={backHref} className="pplan-back">Back to {backLabel}</Link>
          )}
        </div>
      </div>
    );
  }


  const alive = nodes.filter((n) => n.status !== "dismissed");
  const counts2 = {
    doing: alive.filter((n) => n.parentId === null).length,
    kept: alive.filter((n) => n.kind === "idea" && n.status === "accepted").length,
    done: alive.filter((n) => n.kind === "idea" && n.status === "done").length,
  };

  return (
    <div className="pplan-page tangents-light">
      <header className="pplan-header">
        {onClose ? (
          <button type="button" className="pplan-back" onClick={onClose}>
            <X size={15} aria-hidden="true" /> Close
          </button>
        ) : (
          <Link href={backHref} className="pplan-back">
            <ArrowLeft size={15} aria-hidden="true" /> {backLabel}
          </Link>
        )}
        <div className="pplan-title-row">
          <div>
            <h1>{path.title}</h1>
            <p className="pplan-meta">
              {[path.target && path.target !== path.title ? path.target : null, pathMeta(path)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="pplan-header-actions">
            <div className="pplan-seg" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked={view === "plan"} className={view === "plan" ? "is-on" : ""} onClick={() => setView("plan")}>
                <ListChecks size={14} aria-hidden="true" /> Plan
              </button>
              <button type="button" role="radio" aria-checked={view === "map"} className={view === "map" ? "is-on" : ""} onClick={() => setView("map")}>
                <Orbit size={14} aria-hidden="true" /> Map
              </button>
            </div>
            <button type="button" className="pplan-icon" onClick={() => setConfirmingDelete(true)} aria-label="Delete this path" title="Delete this path">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="pplan-progress" aria-label="Progress">
          <span><strong>{counts2.doing}</strong> you already do</span>
          <span><strong>{counts2.kept}</strong> kept</span>
          <span><strong>{counts2.done}</strong> done</span>
        </div>
      </header>

      {view === "plan" ? (
        <PathPlan
          path={path}
          nodes={nodes}
          scheduled={scheduled}
          busyId={busyId}
          justKept={justKept}
          onGenerate={(id, answers) => void generate(id, answers)}
          onStatus={async (id, status) => {
            const data = await run({ action: "setStatus", id, status }, id);
            setJustKept(data && status === "accepted" ? id : null);
          }}
          onAddWork={(parentId) => setFormParent({ parentId })}
          onRemove={(id) => void run({ action: "removeNode", id }, id)}
          onScheduleChanged={load}
        />
      ) : (
        <div className="tangents-root path-page pplan-map">
          <PathScene
            path={path}
            nodes={nodes}
            focusedId={focusedId}
            expanded={expanded}
            onFocus={setFocusedId}
            onToggleExpand={toggleExpand}
            onAddWork={(parentId) => setFormParent({ parentId })}
            onTidy={tidy}
            registerFit={registerFit}
          />
          <PathInspector
            path={path}
            node={focused}
            ancestry={ancestry}
            childCount={childCount}
            busy={busyId === focusedId}
            schedule={focused ? scheduled[focused.id] : undefined}
            justKept={!!focused && justKept === focused.id}
            onScheduleChanged={load}
            onClose={() => setFocusedId(null)}
            onGenerate={(id, answers) => void generate(id, answers)}
            onStatus={async (id, status) => {
              const data = await run({ action: "setStatus", id, status }, id);
              // Keeping a branch is its own step; the time picker follows it.
              setJustKept(data && status === "accepted" ? id : null);
            }}
            onAddWork={(parentId) => setFormParent({ parentId })}
            onRemove={(id) => {
              setFocusedId(null);
              void run({ action: "removeNode", id }, id);
            }}
            onSelectAncestor={setFocusedId}
          />

        </div>
      )}

      {/* Dialogs and messages sit above the page, attached to the body: the
          page's entrance transform would otherwise trap fixed elements. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="tangents-light tangents-layer">
            {formParent && (
              <>
                <div className="tangents-layer-scrim" onClick={() => setFormParent(null)} aria-hidden="true" />
                <PathWorkForm
                  parentId={formParent.parentId}
                  onCancel={() => setFormParent(null)}
                  onSubmit={async (payload) => {
                    const data = await run({
                      action: "addNode",
                      ...payload,
                      pathId: path.id,
                      parentId: formParent.parentId,
                    });
                    if (data) {
                      setFormParent(null);
                      if (formParent.parentId) setExpanded((prev) => new Set(prev).add(formParent.parentId!));
                    }
                    return Boolean(data);
                  }}
                />
              </>
            )}
            {confirmingDelete && (
              <DeletePathDialog
                path={path}
                counts={counts}
                busy={deleting}
                onCancel={() => setConfirmingDelete(false)}
                onConfirm={() => void remove()}
              />
            )}
            {error && (
              <p className="path-error is-floating" role="status">
                {error}
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
