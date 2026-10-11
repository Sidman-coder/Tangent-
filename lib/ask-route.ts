// One input, routed: where something typed into "Tell Tangent" should go.
// Deterministic and instant (no model), and deliberately conservative — when
// it isn't sure, it says "do", which is the full pipeline that can still add,
// move, plan and answer. Used by Cmd-K and the Tangent AI composer.
//
//   question → talked through on the AI page, with the student's context
//   project  → a multi-week effort: grilled, then built as a Project
//   goal     → a long-range goal: a Tangent (Path)
//   do       → saved or acted on (capture, move, complete, plan sessions…)

export type AskRoute = "question" | "project" | "goal" | "do";

const QUESTION_START =
  /^(?:what|when|where|why|how|who|which|should|could|would|can|do|does|did|is|are|am|will|any(?:thing|one)?|help me (?:understand|decide|think|figure)|explain|tell me|summari[sz]e|compare|give me (?:advice|ideas|tips))\b/i;
/** Questions that are really commands to the calendar. */
const CALENDAR_QUESTION =
  /^(?:what(?:'s|’s| is)?\s+(?:due|on|left|next)|what do i have|what have i got|anything due|can you (?:add|move|schedule|put|delete|remove|clear|mark|reschedule)|could you (?:add|move|schedule|put))/i;

const PROJECT_CUE =
  /\b(?:project|prep(?:are)? for|study for|get ready for|final(?:s)? (?:exam|prep)|science fair|portfolio|application|essay for|over the next \d+ (?:weeks|months)|for the next \d+ (?:weeks|months)|\d+[- ]week|by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|before (?:the )?(?:end of|winter|spring|summer)|launch|build (?:a|an|my)|start (?:a|an|my)\b[\w\s'-]{0,30}?\b(?:club|team|business|nonprofit|podcast|channel|company|organization)|make (?:me )?a plan)\b/i;

const GOAL_CUE =
  /\b(?:get into|get admitted|admission to|become (?:a|an)|land (?:a|an)|win (?:a|an|the)|qualify for|reach (?:a )?\d{3,4}|\d{3,4} (?:rating|elo|sat|act)|(?:sat|act) score|long[- ]term|in (?:\d+|a few|two|three) years|by (?:junior|senior) year|by (?:20\d\d)|someday|dream (?:school|job))\b/i;

export function routeAsk(text: string): AskRoute {
  const s = text.trim().replace(/\s+/g, " ");
  if (!s) return "do";
  if (CALENDAR_QUESTION.test(s)) return "do";
  // A question about a goal or project ("how should I study for…") is still
  // a question: talk it through first.
  if (s.endsWith("?") || QUESTION_START.test(s)) return "question";
  if (GOAL_CUE.test(s)) return "goal";
  if (PROJECT_CUE.test(s)) return "project";
  return "do";
}

/** Human words for where it went, for the input's hint line. */
export const ROUTE_HINT: Record<AskRoute, string> = {
  question: "Tangent will talk it through",
  project: "Tangent will start a project — a few questions first",
  goal: "Tangent will start a Tangent for this goal",
  do: "Tangent will save it and place it on your calendar",
};
