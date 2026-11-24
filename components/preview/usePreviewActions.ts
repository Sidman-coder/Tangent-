"use client";

// Round 5A 2.3: the Confirm / Edit / Discard / Undo calls for one drafted
// ChangeSet, shared by PreviewCard (⌘K, InlineAsk, the console) and Home's
// plan brief (components/plan/PlanBrief.tsx). The routes are unchanged:
// /api/changesets/[id]/{shown,confirm,discard,undo} and PATCH for an edit.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { DraftEdit, PreviewPayload } from "@/lib/pipeline/draft";
import { findDraft, forgetDraft, keepDraft, markOpen, settleDraft } from "@/lib/drafts/draft-store";

export type PreviewPhase = "draft" | "confirmed" | "discarded" | "undone";

export type ConfirmResult = { created: number; skipped: string[]; planId: string | null };

async function post(url: string, body?: unknown, method = "POST"): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export const phaseOf = (status: unknown): PreviewPhase | null =>
  status === "confirmed" || status === "discarded" || status === "undone" || status === "draft" ? status : null;

export function usePreviewActions({
  changeSet,
  preview,
  onChanged,
  onConfirmed,
  onJustChatting,
  onOps,
}: {
  changeSet: ChangeSet;
  preview: PreviewPayload;
  onChanged?: () => void;
  onConfirmed?: (actionId: string, info?: { planId: string | null }) => void;
  onJustChatting?: () => void;
  onOps?: (ops: ChangeSet["ops"]) => void;
}) {
  const [cs, setCs] = useState(changeSet);
  const [view, setView] = useState(preview);
  const [phase, setPhase] = useState<PreviewPhase>(phaseOf(changeSet.status) ?? "draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [expired, setExpired] = useState(false);
  const [chatting, setChatting] = useState(false);
  const base = `/api/changesets/${encodeURIComponent(cs.id)}`;
  const shownRef = useRef(false);
  const opsRef = useRef(onOps);
  opsRef.current = onOps;
  useEffect(() => opsRef.current?.(cs.ops), [cs.ops]);

  // Round 5A 4.2: an unconfirmed plan is kept as a draft
  // (lib/drafts/draft-store.ts) from the moment it shows, so it survives
  // navigating away, Clear, or a reload. While it's on screen the pill hides
  // it. Confirmed or discarded: forgotten.
  const originRef = useRef<string | null>(null);
  useEffect(() => markOpen(cs.id), [cs.id]);
  useEffect(() => {
    const kept = findDraft(cs.id);
    originRef.current ??= kept?.origin ?? window.location.pathname;
    // Round 6 item 3: Confirm clears this pill and its older versions.
    if (phase === "confirmed") return settleDraft(cs, originRef.current);
    if (phase !== "draft" || expired) return forgetDraft(cs.id);
    keepDraft(cs, view, originRef.current);
  }, [phase, expired, cs, view]);

  // preview_shown, once per draft.
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    void fetch(`${base}/shown`, { method: "POST" }).catch(() => {});
  }, [base]);

  const busyRef = useRef(false);
  const act = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  /** A refused action (409) means another tab or click already moved it on. */
  const settle = (status: number, data: Record<string, unknown>) => {
    const p = phaseOf(data.status);
    if (data.reason === "expired") setExpired(true);
    if (status === 409 && p && p !== "draft") setPhase(p);
    throw new Error(typeof data.message === "string" ? data.message : "Something went wrong.");
  };

  // Overnight 2 (Maya sim): an edited time saves on blur. That blur fires on
  // the Confirm tap's mousedown; when edits shared `busy`, Confirm was disabled
  // before its click landed, and the tap did nothing. Edits now queue on their
  // own, and Confirm waits for them, so it saves what's on screen.
  const editsRef = useRef<Promise<void>>(Promise.resolve());
  const [saving, setSaving] = useState(0);

  const confirm = async () => {
    await editsRef.current;
    return act(async () => {
      const { status, data } = await post(`${base}/confirm`);
      if (!data.ok) return settle(status, data);
      const skipped = (data.skipped_duplicates as { titles?: string[] } | undefined)?.titles ?? [];
      const created = typeof data.createdTaskCount === "number" ? data.createdTaskCount : -1;
      const planId = typeof data.planId === "string" ? data.planId : null;
      setResult({ created, skipped, planId });
      setPhase("confirmed");
      onChanged?.();
      if (typeof data.actionId === "string") onConfirmed?.(data.actionId, { planId });
    });
  };

  const discard = () =>
    act(async () => {
      const { status, data } = await post(`${base}/discard`);
      if (!data.ok) return settle(status, data);
      setPhase("discarded");
    });

  const justChatting = () =>
    act(async () => {
      const { status, data } = await post(`${base}/discard`, { reason: "just_chatting" });
      if (!data.ok) return settle(status, data);
      setChatting(true);
      setPhase("discarded");
      onJustChatting?.();
    });

  const undo = () =>
    act(async () => {
      const { status, data } = await post(`${base}/undo`);
      if (!data.ok) return settle(status, data);
      setPhase("undone");
      onChanged?.();
    });

  const edit = (body: DraftEdit): Promise<void> => {
    if (busyRef.current) return Promise.resolve();
    const run = async () => {
      setSaving((n) => n + 1);
      setError(null);
      try {
        const { status, data } = await post(base, body, "PATCH");
        if (!data.ok) return settle(status, data);
        setCs(data.changeSet as ChangeSet);
        setView((prev) => ({ ...(data.preview as PreviewPayload), factsUsed: (data.preview as PreviewPayload).factsUsed ?? prev.factsUsed }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setSaving((n) => n - 1);
      }
    };
    const next = editsRef.current.then(run);
    editsRef.current = next;
    return next;
  };

  return { cs, view, phase, busy, saving: saving > 0, error, result, expired, chatting, confirm, discard, justChatting, undo, edit };
}
