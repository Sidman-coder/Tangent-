"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import PathGallery from "@/components/tangents/PathGallery";
import type { PathWithCounts } from "@/components/tangents/PathGallery";
import NewPathDialog from "@/components/tangents/NewPathDialog";
import type { PathDraft } from "@/components/tangents/NewPathDialog";
import { useAppState } from "@/components/AppStateProvider";
import { takeNewPathTitle } from "@/lib/path-handoff";
import { initialPathKind, pathsEmptyCopy, prefsOf } from "@/lib/personalize";
import "./tangents.css";

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
    <div className="tangents-root is-gallery">
      <header className="tangents-bar">
        <Link href="/" className="tangents-back" aria-label="Back to Tangent">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="tangents-back-label">Back to Tangent</span>
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
          <PathGallery paths={paths} onNew={() => setCreating(true)} empty={pathsEmptyCopy(prefs)} />
        )}
      </div>

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
    </div>
  );
}
