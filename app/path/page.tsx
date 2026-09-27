"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PathScene from "@/components/path/PathScene";
import PathInspector from "@/components/path/PathInspector";
import PathWorkForm from "@/components/path/PathWorkForm";
import Button from "@/components/ui/Button";
import type { Goal, PathNode } from "@/lib/types";
import "./path.css";

type Space = { goal: Goal | null; nodes: PathNode[] };

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

export default function PathPage() {
  const [space, setSpace] = useState<Space>({ goal: null, nodes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formParent, setFormParent] = useState<{ parentId: string | null } | null>(null);

  const [college, setCollege] = useState("");
  const [focus, setFocus] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const fitRef = useRef<(() => void) | null>(null);
  const registerFit = useCallback((fn: () => void) => {
    fitRef.current = fn;
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/path", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load your path (${res.status})`);
      setSpace((await res.json()) as Space);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your path.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const saveGoal = async () => {
    if (!college.trim()) return;
    setSavingGoal(true);
    await run({ action: "setGoal", college: college.trim(), focus: focus.trim() || undefined });
    setSavingGoal(false);
  };

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
      // Decide outside the updater. A state updater has to be pure: setting other
      // state inside one runs twice under StrictMode and interrupts the panel's
      // entrance animation partway, leaving it stuck half-transparent.
      const opening = !expanded.has(id);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (opening) next.add(id);
        else next.delete(id);
        return next;
      });
      // Walking into a circle should take you there: focusing it moves the camera
      // and opens the panel for the branch you just entered.
      if (opening) setFocusedId(id);
    },
    [expanded]
  );

  const focused = useMemo(
    () => space.nodes.find((n) => n.id === focusedId) ?? null,
    [focusedId, space.nodes]
  );

  const ancestry = useMemo(() => {
    if (!focused) return [];
    const byId = new Map(space.nodes.map((n) => [n.id, n]));
    const chain: PathNode[] = [];
    let cursor: PathNode | undefined = focused;
    let guard = 0;
    while (cursor && guard++ < 32) {
      chain.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [focused, space.nodes]);

  const childCount = useMemo(
    () => (focused ? space.nodes.filter((n) => n.parentId === focused.id && n.status !== "dismissed").length : 0),
    [focused, space.nodes]
  );

  if (loading) {
    return (
      <div className="path-page is-loading">
        <div className="path-skeleton" aria-hidden="true">
          <span className="path-skeleton-ring" />
          <span className="path-skeleton-ring is-outer" />
        </div>
        <p className="path-loading-note">Drawing your path…</p>
      </div>
    );
  }

  if (!space.goal) {
    return (
      <div className="path-page is-setup">
        <section className="path-setup">
          <h1>Where are you aiming?</h1>
          <p>
            Everything on this page orbits one college. Tangent uses it to judge which branches are worth your
            hours, and you can change it whenever.
          </p>
          <label>
            <span>College</span>
            <input
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="Georgia Tech"
              onKeyDown={(e) => e.key === "Enter" && void saveGoal()}
              autoFocus
            />
          </label>
          <label>
            <span>Intended focus (optional)</span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Electrical engineering"
              onKeyDown={(e) => e.key === "Enter" && void saveGoal()}
            />
          </label>
          <Button variant="primary" onClick={() => void saveGoal()} loading={savingGoal} disabled={!college.trim()}>
            Set the goal
          </Button>
          {error && <p className="path-error" role="status">{error}</p>}
        </section>
      </div>
    );
  }

  const hasWork = space.nodes.some((n) => n.parentId === null && n.status !== "dismissed");

  return (
    <div className="path-page">
      <PathScene
        goal={space.goal}
        nodes={space.nodes}
        focusedId={focusedId}
        expanded={expanded}
        busyId={busyId}
        onFocus={setFocusedId}
        onToggleExpand={toggleExpand}
        onGenerate={(id) => void generate(id)}
        onAddWork={(parentId) => setFormParent({ parentId })}
        registerFit={registerFit}
      />

      {!hasWork && (
        <div className="path-empty">
          <h2>Put one real thing on the circle</h2>
          <p>
            A club, a course, an award, a project. Tangent branches off what is already there, so it needs one
            thing to branch from.
          </p>
          <Button variant="primary" onClick={() => setFormParent({ parentId: null })}>
            Add your first
          </Button>
        </div>
      )}

      <PathInspector
        goal={space.goal}
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
            const data = await run({ action: "addNode", ...payload, parentId: formParent.parentId });
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
