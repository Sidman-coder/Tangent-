"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import PathGallery from "@/components/tangents/PathGallery";
import type { PathWithCounts } from "@/components/tangents/PathGallery";
import NewPathDialog from "@/components/tangents/NewPathDialog";
import type { PathDraft } from "@/components/tangents/NewPathDialog";
import "./tangents.css";

export default function TangentsPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<PathWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="tangents-root">
      <header className="tangents-bar">
        <Link href="/" className="tangents-back">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Tangent
        </Link>
        <h1>Tangents</h1>
        <button type="button" className="path-chip" onClick={() => setCreating(true)}>
          <Plus size={15} aria-hidden="true" />
          New path
        </button>
      </header>

      <div className="tangents-space">
        {paths === null ? (
          <div className="path-skeleton" aria-label="Loading your paths">
            <span className="path-skeleton-ring" />
            <span className="path-skeleton-ring is-outer" />
          </div>
        ) : (
          <PathGallery paths={paths} onNew={() => setCreating(true)} />
        )}
      </div>

      {error && (
        <p className="path-error is-floating" role="status">
          {error}
        </p>
      )}

      {creating && <NewPathDialog onCancel={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}
