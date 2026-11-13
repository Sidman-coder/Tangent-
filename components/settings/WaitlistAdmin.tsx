"use client";

// The owner's waitlist (Round 5A, 1.5): who is waiting, who is in, and Approve.
// Approving flags the account, which lets them in, and emails them a sign-in
// link. The server checks OWNER_EMAIL again on every Approve.

import { useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import SettingRow from "@/components/ui/SettingRow";
import SettingsSection from "@/components/ui/SettingsSection";
import type { WaitlistRow } from "@/lib/auth/waitlist";

type Msg = { tone: "success" | "error"; text: string } | null;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WaitlistAdmin({ initial }: { initial: { waiting: WaitlistRow[]; approved: WaitlistRow[] } }) {
  const [waiting, setWaiting] = useState(initial.waiting);
  const [approved, setApproved] = useState(initial.approved);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Msg>(null);

  const approve = async (row: WaitlistRow) => {
    setBusy(row.email);
    setNote(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; emailed?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "approve failed");
      setWaiting((w) => w.filter((r) => r.email !== row.email));
      setApproved((a) => [{ ...row, status: "approved", approved_at: new Date().toISOString() }, ...a]);
      setNote({
        tone: data.emailed ? "success" : "error",
        text: data.emailed ? `${row.email} is in. We emailed them a sign-in link.` : `${row.email} is in, but the email didn't send. They can sign in with their address.`,
      });
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error && e.message !== "approve failed" ? e.message : "Couldn't approve that one. Try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
      <SettingsSection title={`Waiting (${waiting.length})`}>
        {waiting.length === 0 && <SettingRow label="No one is waiting" help="New sign-ups who aren't on the invite list show up here." />}
        {waiting.map((row) => (
          <SettingRow key={row.email} label={row.email} help={`Joined ${when(row.created_at)}`}>
            <Button variant="primary" onClick={() => approve(row)} disabled={busy !== null} aria-label={`Approve ${row.email}`}>
              {busy === row.email ? "Approving…" : "Approve"}
            </Button>
          </SettingRow>
        ))}
      </SettingsSection>
      <SettingsSection title={`Approved (${approved.length})`}>
        {approved.length === 0 && <SettingRow label="No one approved yet" />}
        {approved.map((row) => (
          <SettingRow key={row.email} label={row.email} help={row.approved_at ? `Approved ${when(row.approved_at)}` : undefined} />
        ))}
      </SettingsSection>
    </>
  );
}
