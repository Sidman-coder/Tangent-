"use client";

// Open "Tangent has a question" sets, kept fresh by QUESTIONS_EVENT so a
// capture on Today shows its questions as soon as they're generated.

import { useCallback, useEffect, useState } from "react";
import { QUESTIONS_EVENT, fetchQuestionSets, type QuestionSet } from "@/lib/questions-client";

export function useQuestionSets() {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const reload = useCallback(async () => setSets(await fetchQuestionSets()), []);
  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener(QUESTIONS_EVENT, on);
    return () => window.removeEventListener(QUESTIONS_EVENT, on);
  }, [reload]);
  return { sets, reload };
}
