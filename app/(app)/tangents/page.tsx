"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useAppState } from "@/components/AppStateProvider";
import { NewTangentLayer, TangentCards, TangentsEmpty, useCreateTangent, useTangentSuggestions } from "@/components/tangents/TangentCards";
import { useTangents } from "@/components/tangents/useTangents";
import { takeNewPathTitle } from "@/lib/path-handoff";
import { initialPathKind, pathsEmptyCopy, prefsOf } from "@/lib/personalize";
import "./tangents.css";

// The Tangents gallery. Its cards also show on the Projects page; this route
// stays for old links and for /tangents?new=1 from Home.
export default function TangentsPage() {
  const router = useRouter();
  const { paths, error: loadError } = useTangents();
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seedTitle, setSeedTitle] = useState<string | null>(null);
  const { state } = useAppState();
  const prefs = prefsOf(state?.user);

  // /tangents?new=1 comes from Home: open the dialog, with the student's
  // starting point if they chose "Make it a Tangent", then drop the flag so a
  // reload doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    setSeedTitle(takeNewPathTitle());
    setCreating(true);
    router.replace("/tangents");
  }, [router]);

  const suggestions = useTangentSuggestions((state?.plans ?? []).filter((p) => !p.kind).map((p) => p.title)); // School & Work area projects aren't Tangent ideas
  const create = useCreateTangent(useCallback((message: string) => setCreateError(message), []));
  const start = (title: string | null) => {
    setSeedTitle(title);
    setCreating(true);
  };

  return (
    <div className="tangents-gallery tangents-light">
      <PageHeader
        title="Tangents"
        description="Where you want to be in a year or more. Tangent maps the moves from what you already do."
        actions={
          paths && paths.length > 0 ? (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
              New Tangent
            </Button>
          ) : undefined
        }
      />

      {paths === null ? (
        <p className="pplan-loading">Loading your Tangents…</p>
      ) : paths.length === 0 ? (
        <TangentsEmpty copy={pathsEmptyCopy(prefs)} suggestions={suggestions} large onStart={start} />
      ) : (
        <TangentCards paths={paths} />
      )}

      <NewTangentLayer
        error={createError ?? loadError}
        creating={creating}
        seedTitle={seedTitle}
        initialKind={initialPathKind(prefs)}
        onCancel={() => {
          setCreating(false);
          setSeedTitle(null);
        }}
        onCreate={create}
      />
    </div>
  );
}
