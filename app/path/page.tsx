"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Check, X, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import TangentDiagram from "@/components/path/TangentDiagram";
import type { Anchor, AnchorKind, Goal, TangentIdea } from "@/lib/types";

const KIND_LABEL: Record<AnchorKind, string> = {
  ec: "Activity",
  award: "Award",
  course: "Course",
  project: "Project",
};

const KINDS = Object.keys(KIND_LABEL) as AnchorKind[];

type Space = { goal: Goal | null; anchors: Anchor[]; tangents: TangentIdea[] };

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/tangents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? "Something went wrong."));
  return data;
}

export default function PathPage() {
  const [space, setSpace] = useState<Space>({ goal: null, anchors: [], tangents: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [college, setCollege] = useState("");
  const [focus, setFocus] = useState("");
  const [showAnchorForm, setShowAnchorForm] = useState(false);
  const [draft, setDraft] = useState({ title: "", kind: "ec" as AnchorKind, detail: "", hoursPerWeek: "", years: "" });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/tangents");
    const data = (await res.json()) as Space;
    setSpace(data);
    setSelectedId((current) => current ?? data.anchors[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => space.anchors.find((a) => a.id === selectedId) ?? null,
    [space.anchors, selectedId]
  );

  const branches = useMemo(
    () => space.tangents.filter((t) => t.anchorId === selectedId && t.status !== "dismissed"),
    [space.tangents, selectedId]
  );

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = async () => {
    if (!college.trim()) return;
    await run({ action: "setGoal", college: college.trim(), focus: focus.trim() });
  };

  const saveAnchor = async () => {
    if (!draft.title.trim()) return;
    await run({
      action: "addAnchor",
      title: draft.title.trim(),
      kind: draft.kind,
      detail: draft.detail.trim(),
      hoursPerWeek: draft.hoursPerWeek,
      years: draft.years,
    });
    setDraft({ title: "", kind: "ec", detail: "", hoursPerWeek: "", years: "" });
    setShowAnchorForm(false);
  };

  if (loading) {
    return (
      <div className="path-page">
        <PageHeader title="Path" description="Loading your work…" />
      </div>
    );
  }

  // Nothing to branch from until there's a goal to aim at.
  if (!space.goal) {
    return (
      <div className="path-page">
        <PageHeader
          title="Path"
          description="Tangent branches off what you already do, toward where you want to land."
        />
        <section className="path-setup">
          <h2>Where are you aiming?</h2>
          <p>Tangent uses this to judge which branches are worth your hours. You can change it whenever.</p>
          <div className="path-setup-fields">
            <label>
              <span>College</span>
              <input
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="Georgia Tech"
                onKeyDown={(e) => { if (e.key === "Enter") void saveGoal(); }}
                autoFocus
              />
            </label>
            <label>
              <span>Intended focus (optional)</span>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Electrical engineering"
                onKeyDown={(e) => { if (e.key === "Enter") void saveGoal(); }}
              />
            </label>
          </div>
          <Button variant="primary" onClick={() => void saveGoal()} loading={busy} disabled={!college.trim()}>
            Set the goal
          </Button>
          {error && <p className="path-error" role="status">{error}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="path-page">
      <PageHeader
        title="Path"
        description={
          <span>
            Branching toward <strong>{space.goal.college}</strong>
            {space.goal.focus ? ` · ${space.goal.focus}` : ""}
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => setShowAnchorForm((v) => !v)} icon={<Plus size={16} aria-hidden="true" />}>
            Add to the circle
          </Button>
        }
      />

      {error && <p className="path-error" role="status">{error}</p>}

      {showAnchorForm && (
        <section className="path-anchor-form">
          <div className="path-anchor-grid">
            <label className="path-field-wide">
              <span>What is it?</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Robotics team"
                autoFocus
              />
            </label>
            <label>
              <span>Kind</span>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as AnchorKind })}>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="path-field-wide">
              <span>Your role or result</span>
              <input
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                placeholder="Build crew, ran CAD for two seasons"
              />
            </label>
            <label>
              <span>Hours a week</span>
              <input inputMode="numeric" value={draft.hoursPerWeek} onChange={(e) => setDraft({ ...draft, hoursPerWeek: e.target.value })} placeholder="6" />
            </label>
            <label>
              <span>Years</span>
              <input inputMode="numeric" value={draft.years} onChange={(e) => setDraft({ ...draft, years: e.target.value })} placeholder="2" />
            </label>
          </div>
          <div className="path-anchor-actions">
            <Button variant="quiet" onClick={() => setShowAnchorForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void saveAnchor()} loading={busy} disabled={!draft.title.trim()}>Add</Button>
          </div>
        </section>
      )}

      {space.anchors.length === 0 ? (
        <section className="path-empty">
          <p>Your circle is empty. Add a club, an award, a course, or a project — Tangent branches off what is already there.</p>
        </section>
      ) : (
        <section className="path-canvas">
          <TangentDiagram
            anchors={space.anchors}
            tangents={space.tangents}
            selectedId={selectedId}
            goalLabel={space.goal.college}
            onSelect={setSelectedId}
          />
        </section>
      )}

      {selected && (
        <section className="path-detail" aria-labelledby="path-detail-title">
          <div className="path-detail-head">
            <div>
              <h2 id="path-detail-title">{selected.title}</h2>
              <p>
                {KIND_LABEL[selected.kind]}
                {selected.detail ? ` · ${selected.detail}` : ""}
                {selected.hoursPerWeek ? ` · ${selected.hoursPerWeek} hrs/wk` : ""}
                {selected.years ? ` · ${selected.years} yr${selected.years === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <div className="path-detail-actions">
              <Button
                variant="secondary"
                onClick={() => void run({ action: "generate", anchorId: selected.id })}
                loading={busy}
                loadingLabel="Drawing branches…"
                icon={<Sparkles size={15} aria-hidden="true" />}
              >
                {branches.length ? "Draw new branches" : "Draw branches"}
              </Button>
              <Button
                variant="quiet"
                onClick={() => void run({ action: "removeAnchor", id: selected.id })}
                aria-label={`Remove ${selected.title}`}
                icon={<Trash2 size={15} aria-hidden="true" />}
              >
                Remove
              </Button>
            </div>
          </div>

          {branches.length === 0 ? (
            <p className="path-detail-empty">
              No branches yet. Tangent reads this against {space.goal.college} and proposes three angles you could take it.
            </p>
          ) : (
            <ul className="path-branches">
              {branches.map((b) => (
                <li key={b.id} className={`path-branch is-${b.status}`}>
                  <div className="path-branch-copy">
                    <h3>{b.title}</h3>
                    <p>{b.rationale}</p>
                    <span className="path-branch-effort">{b.effort}</span>
                  </div>
                  <div className="path-branch-actions">
                    {b.status === "suggested" && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => void run({ action: "setStatus", id: b.id, status: "accepted" })} icon={<Check size={14} aria-hidden="true" />}>
                          Take it
                        </Button>
                        <Button variant="quiet" size="sm" onClick={() => void run({ action: "setStatus", id: b.id, status: "dismissed" })} aria-label="Dismiss this branch" icon={<X size={14} aria-hidden="true" />}>
                          Not this
                        </Button>
                      </>
                    )}
                    {b.status === "accepted" && (
                      <Button variant="quiet" size="sm" onClick={() => void run({ action: "setStatus", id: b.id, status: "done" })} icon={<Check size={14} aria-hidden="true" />}>
                        Mark done
                      </Button>
                    )}
                    {b.status === "done" && <span className="path-branch-done">Done</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
