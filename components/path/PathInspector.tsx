"use client";

import { AnimatePresence, m } from "motion/react";
import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Path, PathNode } from "@/lib/types";

// The panel beside the drawing.
//
// The drawing carries the shape of things; sentences on it were the first thing
// that made the old version unreadable. So a node on the canvas shows its title
// and nothing else, and everything you might want to read or do about it lives
// here, one node at a time.

type Props = {
  path: Path;
  node: PathNode | null;
  ancestry: PathNode[];
  childCount: number;
  busy: boolean;
  onClose: () => void;
  onGenerate: (id: string) => void;
  onStatus: (id: string, status: PathNode["status"]) => void;
  onAddWork: (parentId: string | null) => void;
  onRemove: (id: string) => void;
  onSelectAncestor: (id: string | null) => void;
};

const CATEGORY_LABEL: Record<string, string> = {
  ec: "Activity",
  award: "Award",
  course: "Course",
  project: "Project",
};

export default function PathInspector({
  path,
  node,
  ancestry,
  childCount,
  busy,
  onClose,
  onGenerate,
  onStatus,
  onAddWork,
  onRemove,
  onSelectAncestor,
}: Props) {
  return (
    <AnimatePresence>
      {node && (
        <m.aside
          // AnimatePresence tracks its children by key. A stable one rather than
          // the node id, so moving between nodes updates the panel in place
          // instead of tearing it down and rebuilding it.
          key="path-inspector"
          className="path-inspector"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", visualDuration: 0.34, bounce: 0.12 }}
          aria-label="Selected node"
        >
          <header className="path-inspector-head">
            <nav className="path-crumbs" aria-label="Where this sits">
              <button type="button" onClick={() => onSelectAncestor(null)}>
                {path.title}
              </button>
              {ancestry.slice(0, -1).map((a) => (
                <button key={a.id} type="button" onClick={() => onSelectAncestor(a.id)}>
                  {a.title}
                </button>
              ))}
            </nav>
            <button type="button" className="path-inspector-close" onClick={onClose} aria-label="Close">
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <p className="path-inspector-kind">
            {node.kind === "idea"
              ? node.origin === "tangent"
                ? "Branch Tangent drafted"
                : "Branch you wrote"
              : CATEGORY_LABEL[node.category ?? "ec"]}
          </p>
          <h2 className="path-inspector-title">{node.title}</h2>

          {node.detail && <p className="path-inspector-body">{node.detail}</p>}
          {node.rationale && <p className="path-inspector-body">{node.rationale}</p>}

          {(node.effort || node.hoursPerWeek || node.years) && (
            <dl className="path-facts">
              {node.effort && (
                <div>
                  <dt>Commitment</dt>
                  <dd>{node.effort}</dd>
                </div>
              )}
              {node.hoursPerWeek && (
                <div>
                  <dt>Hours a week</dt>
                  <dd>{node.hoursPerWeek}</dd>
                </div>
              )}
              {node.years && (
                <div>
                  <dt>Years</dt>
                  <dd>{node.years}</dd>
                </div>
              )}
            </dl>
          )}

          <div className="path-inspector-actions">
            {node.kind === "idea" && node.status === "suggested" && (
              <>
                <button type="button" className="path-btn is-primary" onClick={() => onStatus(node.id, "accepted")}>
                  <Check size={15} aria-hidden="true" />
                  Keep this
                </button>
                <button type="button" className="path-btn" onClick={() => onStatus(node.id, "dismissed")}>
                  Not for me
                </button>
              </>
            )}

            {node.kind === "idea" && node.status === "accepted" && (
              <button type="button" className="path-btn" onClick={() => onStatus(node.id, "done")}>
                <Check size={15} aria-hidden="true" />
                Mark done
              </button>
            )}

            <button
              type="button"
              className="path-btn is-accent"
              onClick={() => onGenerate(node.id)}
              disabled={busy}
            >
              <Sparkles size={15} aria-hidden="true" />
              {busy ? "Thinking" : childCount > 0 ? "Draft three more" : "Branch from here"}
            </button>

            {node.kind === "idea" && (
              <button type="button" className="path-btn" onClick={() => onAddWork(node.id)}>
                <Plus size={15} aria-hidden="true" />
                Add your own
              </button>
            )}

            <button type="button" className="path-btn is-quiet" onClick={() => onRemove(node.id)}>
              <Trash2 size={15} aria-hidden="true" />
              Remove
            </button>
          </div>

          {childCount > 0 && (
            <p className="path-inspector-note">
              {childCount} {childCount === 1 ? "branch grows" : "branches grow"} from here. Open the circle on the
              drawing to walk into them.
            </p>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  );
}
