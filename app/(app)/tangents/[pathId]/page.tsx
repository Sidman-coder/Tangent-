"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PathScene from "@/components/path/PathScene";
import PathInspector from "@/components/path/PathInspector";
import PathWorkForm from "@/components/path/PathWorkForm";
import type { Path, PathNode } from "@/lib/types";
import { pathMeta } from "@/lib/path-format";
import "../tangents.css";

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

export default function PathDeepView() {
  const params = useParams<{ pathId: string }>();
  const pathId = params?.pathId;

  const [path, setPath] = useState<Path | null>(null);
  const [nodes, setNodes] = useState<PathNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formParent, setFormParent] = useState<{ parentId: string | null } | null>(null);

  const fitRef = useRef<(() => void) | null>(null);
  const registerFit = useCallback((fn: () => void) => {
    fitRef.current = fn;
  }, []);

  const load = useCallback(async () => {
    if (!pathId) return;
    try {
      const res = await fetch(`/api/path?pathId=${encodeURIComponent(pathId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load this path (${res.status})`);
      const data = (await res.json()) as { path: Path; nodes: PathNode[] };
      setPath(data.path);
      setNodes(data.nodes ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this path.");
    } finally {
      setLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    async (parentId: string) => {
      const data = await run({ action: "generate", parentId }, parentId);
      // Opening the circle straight away is the whole reward for asking.
      if (data) setExpanded((prev) => new Set(prev).add(parentId));
    },
    [run]
  );

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

  const childCount = useMemo(
    () => (focused ? nodes.filter((n) => n.parentId === focused.id && n.status !== "dismissed").length : 0),
    [focused, nodes]
  );

  if (loading) {
    return (
      <div className="tangents-root is-centred">
        <div className="path-skeleton" aria-hidden="true">
          <span className="path-skeleton-ring" />
          <span className="path-skeleton-ring is-outer" />
        </div>
        <p className="path-loading-note">Drawing this path…</p>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="tangents-root is-centred">
        <div className="tangents-empty">
          <h2>That path isn&apos;t here</h2>
          <p>It may have been removed, or the link is from another workspace.</p>
          <Link href="/tangents" className="path-btn is-primary">
            Back to your paths
          </Link>
        </div>
      </div>
    );
  }

  const hasWork = nodes.some((n) => n.parentId === null && n.status !== "dismissed");

  return (
    <div className="tangents-root path-page">
      <header className="tangents-bar is-over">
        <Link href="/tangents" className="tangents-back" aria-label="All paths">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="tangents-back-label">All paths</span>
        </Link>
        {/* The deadline sits under the title: on the right it collided with
            the inspector, and repeating the title there said nothing. */}
        <div className="tangents-bar-title">
          <h1>{path.title}</h1>
          {pathMeta(path) && <span className="tangents-bar-meta">{pathMeta(path)}</span>}
        </div>
      </header>

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

      {!hasWork && (
        <div className="path-empty">
          <h2>Put one real thing on the circle</h2>
          <p>
            Something you already do toward this. Tangent branches off what is already there, so it needs one
            thing to branch from.
          </p>
          <button type="button" className="path-btn is-primary" onClick={() => setFormParent({ parentId: null })}>
            Add the first
          </button>
        </div>
      )}

      <PathInspector
        path={path}
        node={focused}
        ancestry={ancestry}
        childCount={childCount}
        busy={busyId === focusedId}
        onClose={() => setFocusedId(null)}
        onGenerate={(id) => void generate(id)}
        onStatus={(id, status) => void run({ action: "setStatus", id, status }, id)}
        onAddWork={(parentId) => setFormParent({ parentId })}
        onRemove={(id) => {
          setFocusedId(null);
          void run({ action: "removeNode", id }, id);
        }}
        onSelectAncestor={setFocusedId}
      />

      {formParent && (
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
      )}

      {error && (
        <p className="path-error is-floating" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
