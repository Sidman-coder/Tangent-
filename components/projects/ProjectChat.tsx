"use client";

// Tangent AI inside a project: one ongoing conversation per project, like a
// Claude Project. It knows the project (goal, steps) and the student, answers
// questions about it, and can add or change steps — which join the project
// and are spaced on the calendar. Big asks get questions first. The chat is a
// normal saved chat linked to the project's plan, so it also shows in the
// Tangent AI chat list.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import "@/components/console/clarify-card.css";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import PenMark from "@/components/console/PenMark";
import SuggestionCard, { type Suggestion } from "@/components/console/SuggestionCard";
import { applyPlanProgress, readChatReply, type PlanProgressView } from "@/components/console/turns";
import InlinePreview from "@/components/projects/InlinePreview";
import { routeAsk } from "@/lib/ask-route";
import type { PendingQuestion } from "@/lib/pending-question";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import type { ChatSession } from "@/lib/types";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionId?: string;
  questions?: ClarifyQuestion[] | null;
  /** The ask the questions are about, re-run with the answers. */
  request?: string;
  suggestion?: Suggestion | null;
  /** Pipeline V2 (A6): a drafted change, saved only on Confirm. */
  draft?: { changeSet: ChangeSet; preview: PreviewPayload } | null;
  /** "Which one should I delete?" (A1): sent back with the next message. */
  pendingQuestion?: PendingQuestion | null;
};

type Reply = {
  ok?: boolean;
  error?: string;
  action?: string;
  message?: string;
  response?: string;
  actionId?: string;
  questions?: ClarifyQuestion[];
  suggestion?: Suggestion | null;
  changeSet?: ChangeSet;
  preview?: PreviewPayload;
  pendingQuestion?: PendingQuestion | null;
};

const STARTERS = ["What should I do next?", "Break the next step down", "Add a review session before the deadline", "Am I on track?"];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as T;
}

export default function ProjectChat({ projectId, projectTitle, onChanged }: { projectId: string; projectTitle: string; onChanged: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PlanProgressView | null>(null);
  const sessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load this project's conversation (the latest chat linked to its plan).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = (await (await fetch("/api/sessions", { cache: "no-store" })).json()) as { sessions?: ChatSession[] };
        const mine = (list.sessions ?? []).filter((s) => s.planId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (!mine || cancelled) return;
        sessionRef.current = mine.id;
        const full = (await (await fetch(`/api/sessions?sessionId=${encodeURIComponent(mine.id)}`, { cache: "no-store" })).json()) as { session?: ChatSession };
        if (cancelled) return;
        setMsgs((full.session?.messages ?? []).map((m, i) => ({ id: `h${i}`, role: m.role, content: m.content })));
      } catch {
        /* a fresh conversation, then */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, busy]);

  const save = useCallback(
    async (role: "user" | "assistant", content: string) => {
      try {
        if (!sessionRef.current) {
          const created = await postJson<{ ok?: boolean; session?: { id: string } }>("/api/sessions", { action: "create", title: projectTitle });
          if (!created.session) return;
          sessionRef.current = created.session.id;
          await postJson("/api/sessions", { action: "link", sessionId: created.session.id, planId: projectId });
        }
        await postJson("/api/sessions", { action: "add_message", sessionId: sessionRef.current, role, content });
      } catch {
        /* the reply still shows; it just isn't saved */
      }
    },
    [projectId, projectTitle]
  );

  const send = useCallback(
    async (text: string, followUp?: { request: string; answers: ClarifyAnswer[] | null }) => {
      const shown = text.trim();
      if (!shown || busy) return;
      const request = followUp?.request ?? shown;
      setBusy(true);
      setInput("");
      setProgress(null);
      // A question Tangent is waiting on (the last reply, until it expires).
      const last = msgs[msgs.length - 1];
      const waiting =
        last?.pendingQuestion && Date.parse(last.pendingQuestion.expiresAt) > Date.now() ? last.pendingQuestion : null;
      setMsgs((m) => [
        ...m.map((x) => ({ ...x, questions: null, pendingQuestion: null })),
        { id: crypto.randomUUID(), role: "user", content: shown },
      ]);
      void save("user", shown);

      // A question is talked through; anything else can change the project.
      const mode = !followUp && !waiting && routeAsk(request) === "question" ? "plan" : "calendar";
      const history = msgs.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: request }],
            mode,
            stream: mode === "calendar",
            projectId,
            clarify: !followUp,
            answers: followUp?.answers ?? undefined,
            pendingQuestion: waiting ?? undefined,
          }),
        });
        const data = (await readChatReply(res, (line) => setProgress((v) => applyPlanProgress(v, line)))) as Reply;
        if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");
        if (data.action === "clarify" && (data.questions?.length || data.pendingQuestion)) {
          const ask = data.message ?? "A few quick questions first.";
          setMsgs((m) => [
            ...m,
            { id: crypto.randomUUID(), role: "assistant", content: ask, questions: data.questions ?? null, request, pendingQuestion: data.pendingQuestion ?? null },
          ]);
          void save("assistant", ask);
          return;
        }
        const reply = (data.message ?? data.response ?? "Done.").replace(/\*\*(.+?)\*\*/g, "$1");
        const draft = data.action === "preview" && data.changeSet && data.preview ? { changeSet: data.changeSet, preview: data.preview } : null;
        setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply, actionId: data.actionId, suggestion: data.suggestion, draft }]);
        void save("assistant", reply);
        if (data.actionId) onChanged();
      } catch (e) {
        setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [busy, msgs, onChanged, projectId, save]
  );

  const built = progress?.tasks.filter(Boolean).length ?? 0;

  return (
    <section className="pchat" aria-label={`Tangent AI for ${projectTitle}`}>
      <header className="pchat-head">
        <PenMark className="pchat-mark" />
        <div>
          <h2>Tangent AI</h2>
          <p>Knows this project and your week.</p>
        </div>
      </header>

      <div className="pchat-thread" ref={scrollRef} aria-live="polite">
        {msgs.length === 0 && !busy && (
          <div className="pchat-empty">
            <p>Ask anything about this project, or have Tangent add and change steps.</p>
            <div className="pchat-starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="tg-chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="pchat-user">
              {m.content}
            </p>
          ) : (
            <div key={m.id} className="pchat-assistant">
              <p>{m.content}</p>
              {m.questions && m.questions.length > 0 && m.request && (
                <ClarifyCard
                  questions={m.questions}
                  disabled={busy}
                  skipLabel={m.pendingQuestion ? "Cancel" : undefined}
                  onSubmit={(answers) =>
                    m.pendingQuestion
                      ? void send(answers?.[0]?.answer ?? "Cancel")
                      : void send(answers && answers.length ? answers.map((a) => a.answer).join(" · ") : "Just do it", { request: m.request!, answers })
                  }
                />
              )}
              {m.draft && <InlinePreview changeSet={m.draft.changeSet} preview={m.draft.preview} onChanged={onChanged} />}
              {m.actionId && <ActionReceipt actionId={m.actionId} label="Changed your project." onUndone={onChanged} />}
              {m.suggestion && <SuggestionCard suggestion={m.suggestion} onMoved={onChanged} />}
            </div>
          )
        )}
        {busy && (
          <p className="pchat-working" role="status">
            {progress?.title ? `Adding steps — ${built} of ${progress.taskCount}` : "Thinking…"}
          </p>
        )}
      </div>

      <form
        className="pchat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          value={input}
          rows={1}
          placeholder="Ask about this project…"
          aria-label="Ask Tangent about this project"
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" className="pchat-send" disabled={busy || !input.trim()} aria-label="Send">
          <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
