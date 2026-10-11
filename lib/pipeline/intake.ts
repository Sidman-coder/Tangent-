// Pipeline V2 intake: the one handler for every typed or browser-voice message
// while TANGENT_PIPELINE_V2 is on (app/api/chat, app/api/voice-browser). It
// replaces the Plan/Calendar switch:
//
//   - "add this plan" right after a shown schedule saves that schedule as a
//     draft, read from the reply text (no AI, nothing regenerated);
//   - a clear question or brainstorm gets a chat reply and no ChangeSet;
//   - everything else goes through the voice handler with preview on, so
//     anything the AI wrote is a preview card first.
//
// The pen (/api/voice) has no screen and still calls handleVoiceText directly.

import "server-only";
import type { NextResponse } from "next/server";
import { calendarReply, lastUserMessage, planReply, type ChatMessage } from "../chat-reply";
import type { PlanProgress } from "../voice-handler";
import { getUserTimezone } from "../store";
import { localNow } from "../time";
import { resolvePlanTitle } from "../plan-title";
import { planOps } from "./draft";
import { respondWithDraft } from "./drafting";
import { logEvent } from "./events";
import { countScheduleLines, isAddShownPlan, isCompleteSchedule, parsePlanText, skippedNotes, stripModeSwitchLine } from "./plan-text";
import { routeRequest } from "./route-request";

export type IntakeOptions = {
  onProgress?: (event: PlanProgress) => void;
  source?: "typed" | "voice";
  /** "chat": answer conversationally, draft nothing ("Just talking, don't add"). */
  route?: "chat";
};

/**
 * A draft ChangeSet holding exactly the schedule lines in `text`, the reply the
 * student saw. Lines that can't be read are listed on the card ("Read X of Y
 * lines"), never dropped. With no readable line, an error and no draft.
 */
export async function draftFromPlanText(text: string, request: string, source: "typed" | "voice" = "typed"): Promise<NextResponse | { error: string }> {
  const today = localNow(await getUserTimezone()).date;
  const read = parsePlanText(text, today);
  logEvent("request_received", { route: "plan_text", fast: false, source });
  if (read.tasks.length === 0) {
    return { error: read.total ? `Couldn't read any of the ${read.total} schedule lines. Nothing was added.` : "There's no schedule in that reply to add." };
  }
  return respondWithDraft(
    {
      source,
      requestText: request.slice(0, 2000) || "Add this plan",
      summary: "New plan",
      intent: "new_plan",
      ops: planOps(resolvePlanTitle(undefined, request), read.tasks),
      assumptions: skippedNotes(read),
    },
    { text: request, today, route: "plan_text" }
  );
}

/** The chat-route result object ({ message, action, ... }) for one request. */
export async function handleRequest(messages: ChatMessage[], opts: IntakeOptions = {}): Promise<Record<string, unknown>> {
  const userText = lastUserMessage(messages);
  const source = opts.source ?? "typed";

  // "Add this plan" after a schedule: reuse the plan the student saw.
  const shownAt = findLastIndex(messages, (m) => m.role === "assistant");
  const shown = shownAt >= 0 ? messages[shownAt].content : "";
  if (opts.route !== "chat" && isAddShownPlan(userText) && countScheduleLines(shown) > 0) {
    const asked = findLastIndex(messages.slice(0, shownAt), (m) => m.role === "user");
    const res = await draftFromPlanText(shown, asked >= 0 ? messages[asked].content : userText, source);
    if ("error" in res) return { message: res.error, action: "error", ok: true };
    const data = (await res.json()) as Record<string, unknown>;
    if (data.ok !== true) return { message: String(data.response ?? "Sorry, I couldn't prepare that."), action: "error", ok: true };
    return { message: String(data.response ?? ""), action: "preview", changeSet: data.changeSet, preview: data.preview, ok: true };
  }

  const route = opts.route === "chat" ? "chat" : routeRequest(userText, await getUserTimezone());
  if (route === "chat") {
    logEvent("request_received", { route: "chat", fast: false, source });
    // The Plan prompt plus the one-question-at-a-time rules; its "Switch to
    // Calendar…" line is cut here. Only a complete schedule offers adding it.
    const reply = stripModeSwitchLine(await planReply(messages, { followUp: true }));
    return { message: reply, action: isCompleteSchedule(reply) ? "plan_reply" : "chat_reply", ok: true };
  }
  return calendarReply(messages, userText, opts.onProgress, source);
}

function findLastIndex<T>(list: T[], pred: (x: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) if (pred(list[i])) return i;
  return -1;
}
