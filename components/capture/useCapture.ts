"use client";

// One capture from the home screen: save first, ask after. Unlike AddFlow
// (which shows clarify questions before saving), a clarify reply here is
// saved straight away the way "Skip for now" saves it, and the questions
// come back through /api/questions so the Sorted card, Today and the bell all
// read the same set. Same /api/chat, /api/confirm and /api/questions routes.

import { useCallback, useRef, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import { routeAsk } from "@/lib/ask-route";
import { routeMessage } from "@/lib/pipeline/talk-route";
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
      source: "voice",
      // Round 5A 2.5: the same talk-first router as Home
      // (lib/pipeline/talk-route.ts). A goal or a question is answered.
      home: true,
      scope: "capture",
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
  // True while this capture's own questions are still being written, so the
  // card waits before offering an older parked question instead.
  const [questionsPending, setQuestionsPending] = useState(false);
  // Questions written for an earlier capture must not land on a newer card.
  const latest = useRef(0);

  const capture = useCallback(
    async (said: string): Promise<CaptureOutcome> => {
      const words = said.trim();
      const id = ++latest.current;
      setFreshSet(null);
      setQuestionsPending(false);
      // Round 5A 2.5: talk first. A plan asked for in words goes to Home's
      // planning view; a goal or a question is answered here, under the mic.
      const talk = routeMessage(words, { scope: "capture" });
      if (talk.kind === "plan") return { kind: "plan", said: words };
      // Only "new project: …" makes a project from here; a goal is talk.
      const toProject = talk.kind === "add" && routeAsk(words) === "project";
      try {
        let reply = await chat(words, toProject, true);
        if (reply.action === "clarify") reply = await chat(words, toProject, false);
        void refresh();
        // Questions arrive after the card is up; it shows them when they land.
        if (reply.taskId) {
          setQuestionsPending(true);
          void generateQuestions(reply.taskId, words, reply.quick === true).then((set) => {
            void refresh();
            if (id !== latest.current) return;
            if (set?.questions.length) setFreshSet(set);
            setQuestionsPending(false);
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

  return { capture, confirm, freshSet, questionsPending, clearFreshSet: useCallback(() => setFreshSet(null), []) };
}
