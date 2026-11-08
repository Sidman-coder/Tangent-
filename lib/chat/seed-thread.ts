// Round 4 §3.2: planning that started on Home (the composer or the onboarding
// goal) carries on in the project it made. Once the plan is confirmed, the
// talk that led to it (the request, Tangent's questions and the answers, what
// the student told it in the "Tell me anything" box) is written into that
// project's one thread, so its Chat opens where planning left off.
// Client-side, best effort: a failure only means the thread starts empty.

export type ThreadLine = { role: "user" | "assistant"; text: string };

export async function seedProjectThread(projectId: string, lines: readonly ThreadLine[], title?: string): Promise<void> {
  const kept = lines.map((l) => ({ ...l, text: l.text.trim().slice(0, 4000) })).filter((l) => l.text);
  if (!projectId || kept.length === 0) return;
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", scope: { type: "project", projectId }, title }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; session?: { id: string; messages: unknown[] } };
    const sessionId = data.ok ? data.session?.id : null;
    // A thread that already has talk in it is left as it is.
    if (!sessionId || (data.session?.messages.length ?? 0) > 0) return;
    // Turns pair a request with the replies after it, so the thread starts on the student.
    const start = kept.findIndex((l) => l.role === "user");
    for (const line of kept.slice(Math.max(0, start))) {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", sessionId, role: line.role, content: line.text }),
      });
    }
  } catch {
    /* the plan is saved either way */
  }
}
