"use client";

// One capture from the home screen: save first, ask after. Unlike AddFlow
// (which shows clarify questions before saving), a clarify reply here is
// saved straight away the way "Skip for now" saves it, and the questions
// come back through /api/questions so the Sorted card, Today and the bell all
// read the same set. Same /api/chat, /api/confirm and /api/questions routes.

import { useCallback, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import { routeAsk } from "@/lib/ask-route";
import { generateQuestions, type QuestionSet } from "@/lib/questions-client";
import { outcomeFromError, outcomeFromReply, type CaptureOutcome, type ChatReply } from "@/lib/capture-outcome";

function dayLabel(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function chat(said: string, toProject: boolean, firstPass: boolean): Promise<ChatReply> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: said }],
      mode: "calendar",
      stream: false,
      // First pass: a plain to-do saves instantly, anything bigger may ask.
      // Second pass (after a clarify): save as-is, exactly like "Skip for now".
      capture: firstPass && !toProject,
      clarify: firstPass,
      ...(toProject ? { newProject: true } : {}),
    }),
  });
  const data = (await res.json()) as ChatReply;
  if (!res.ok || !data.ok) throw new Error(data.error || "That didn't go through.");
  return data;
}

export function useCapture() {
  const { refresh } = useAppState();
  const [freshSet, setFreshSet] = useState<QuestionSet | null>(null);

  const capture = useCallback(
    async (said: string): Promise<CaptureOutcome> => {
      const words = said.trim();
      setFreshSet(null);
      const route = routeAsk(words);
      // A question goes to Tangent AI by choice (a chip), never by surprise.
      if (route === "question") return { kind: "question", said: words };
      // A long-range goal is a project now (Tangents visualises projects).
      const toProject = route === "project" || route === "goal";
      try {
        let reply = await chat(words, toProject, true);
        if (reply.action === "clarify") reply = await chat(words, toProject, false);
        void refresh();
        // Questions arrive after the card is up; it shows them when they land.
        if (reply.taskId) {
          void generateQuestions(reply.taskId, words, reply.quick === true).then((set) => {
            if (set?.questions.length) setFreshSet(set);
            void refresh();
          });
        }
        return outcomeFromReply(reply, words, dayLabel);
      } catch {
        return outcomeFromError(words);
      }
    },
    [refresh]
  );

  const confirm = useCallback(
    async (id: string, yes: boolean): Promise<CaptureOutcome | null> => {
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confirm: yes }),
        });
        const data = (await res.json()) as ChatReply;
        if (!res.ok || !data.ok) throw new Error(data.error);
        if (!yes) return null;
        void refresh();
        return outcomeFromReply(data, "", dayLabel);
      } catch {
        return outcomeFromError("");
      }
    },
    [refresh]
  );

  return { capture, confirm, freshSet, clearFreshSet: useCallback(() => setFreshSet(null), []) };
}
