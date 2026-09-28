// FUTURE CONSIDERATION (not yet implemented):
// A semester/course data model and a historical-duration-based time
// estimator are being evaluated as deterministic/statistical alternatives
// to LLM-based date reasoning and time estimation. Do not build until
// a concrete data source (e.g. Canvas or manual course entry) exists.

// NOTE: Anthropic free tier has 8000 output tokens per minute limit
// To increase limits go to console.anthropic.com/settings/billing
// Add credits to advance to next tier with higher rate limits
// Current tier limits cause 429 errors on large plan generations
//
// This is the shared voice-command handler, factored out of app/api/voice/route.ts
// so both the pen/text pipeline and the browser hold-to-record endpoint
// (app/api/voice-browser/route.ts) call the exact same downstream logic —
// Next.js route files may only export HTTP method handlers, so this can't
// live in route.ts itself.
import { NextResponse } from "next/server";
import { addTask, addPlanWithTasks, addRecurringTask, completeTask, deleteTask, updateTask, addVoiceLog, getAppState, getAllTasks, getCalendars, moveTasksToCalendar, getTasksMatchingFilter, getContextAsString, recordAction, addPendingConfirmation, getUserTimezone } from "@/lib/store";
import { addDaysYMD, localNow, promptDateContext, singleRelativeDay, ymdFromParts } from "@/lib/time";
import type { TaskKind } from "@/lib/types";
import { needsAgentTools, runVoiceAgentToolLoop } from "@/lib/voice-agent-tools";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { generatePlan, isClearPlanRequest, planDates } from "@/lib/ai/plan";
import { resolvePlanTitle } from "@/lib/plan-title";
import { perfCount, perfSpan, withPerfTrace } from "@/lib/perf";
import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, recordUsage } from "@/lib/ai/call";
import { layeredSystem } from "@/lib/ai/cache";
import { matchTask, routeCommand, ROUTES, type FastRoute } from "@/lib/ai/router";
import { getRequestContext, setAiRoute } from "@/lib/request-context";
import { formatTime12 } from "@/lib/dates";

const RESOURCE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    url: { type: "string" },
  },
  required: ["label", "url"],
  additionalProperties: false,
} as const;

/** Shape returned by the standard single-task/command call (voiceSystemPrompt)
 *  and reused for the 429-retry call, which only ever populates a subset of it. */
const VOICE_COMMAND_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["add_task", "complete_task", "delete_task", "add_recurring_task", "create_plan", "delete_all_tasks", "get_calendars", "move_tasks"],
    },
    response: { type: "string" },
    title: { type: "string" },
    date: { type: "string" },
    time: { type: "string" },
    calendarId: { type: "string" },
    notes: { type: "string" },
    startAction: { type: "string" },
    resources: { type: "array", items: RESOURCE_ITEM_SCHEMA },
    frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
    startDate: { type: "string" },
    endDate: { type: ["string", "null"] },
    daysOfWeek: { type: ["array", "null"], items: { type: "integer" } },
    targetCalendarId: { type: "string" },
  },
  required: ["action", "response"],
  additionalProperties: false,
} as const;
// NOTE: intentionally has no "tasks" field and no dedicated move_tasks filter
// fields. The Anthropic API's undocumented schema-complexity ceiling ("Schema
// is too complex", 400) was empirically bisected against this exact schema:
// it is not tied to any one nested structure (a populated "tasks" array, a
// nested filter/dateRange object, and the flat "resources" array were each
// tested independently) but to the *total top-level property count* — 14
// properties (this schema, as written) succeeds; 16-17 fails regardless of
// which fields those are or how they're shaped. So move_tasks reuses the
// existing "title" field as the filter keyword and "startDate"/"endDate" as
// the filter date range instead of adding dedicated fields — see the
// move_tasks handling in handleVoiceText and the MOVE TASKS prompt section
// below. This schema also has no "tasks" field, so it can only signal plan
// intent (action: create_plan); handleVoiceText then re-enters with forcePlan to
// generate the tasks with the two-stage generator in lib/ai/plan.ts.

/** Clearing the whole schedule always requires confirmation — it's total and irreversible
 *  from the user's perspective without the undo system. Shared by all three call sites
 *  below (instant-detect, LLM-returned action, and the JSON-parse-failed fallback). */
async function requestClearConfirmation(text: string): Promise<NextResponse> {
  const existing = await getAllTasks();
  if (existing.length === 0) {
    await addVoiceLog({ text, response: "Nothing to clear — schedule is already empty", action: "delete_all_tasks", ok: true });
    return NextResponse.json({
      ok: true,
      action: "delete_all_tasks",
      response: "Your schedule is already empty.",
      state: await getAppState(),
    });
  }
  const pending = await addPendingConfirmation(
    "delete_all_tasks",
    `Clear all ${existing.length} tasks from your schedule?`,
    {}
  );
  await addVoiceLog({ text, response: "Awaiting confirmation to clear schedule", action: "confirm_required", ok: true });
  return NextResponse.json({
    ok: true,
    action: "confirm_required",
    pending: { id: pending.id, kind: pending.kind, message: pending.message },
    response: pending.message,
  });
}

function inferCalendarId(title: string, notes?: string): string {
  const text = (title + " " + (notes || "")).toLowerCase();
  if (text.match(/meeting|call|client|project|deadline|work|sales|email|report|presentation/)) {
    return "cal_work";
  }
  if (text.match(/gym|workout|health|family|errand|personal|hobby|friend/)) {
    return "cal_personal";
  }
  if (text.match(/study|homework|assignment|exam|test|course|class|lecture|quiz/)) {
    return "cal_study";
  }
  return "cal_all";
}

export async function resolveCalendarId(input: string | undefined): Promise<string> {
  if (!input) return 'cal_all'
  const calendars = await getCalendars()
  const exactMatch = calendars.find(c => c.id === input)
  if (exactMatch) return exactMatch.id
  const nameMatch = calendars.find(c =>
    c.name.toLowerCase() === input.toLowerCase() ||
    c.name.toLowerCase().includes(input.toLowerCase()) ||
    input.toLowerCase().includes(c.name.toLowerCase())
  )
  if (nameMatch) return nameMatch.id
  const lower = input.toLowerCase()
  if (lower.includes('work') || lower.includes('professional') || lower.includes('business')) {
    const workCal = calendars.find(c => c.name.toLowerCase().includes('work'))
    if (workCal) return workCal.id
  }
  if (lower.includes('personal') || lower.includes('private') || lower.includes('life')) {
    const personalCal = calendars.find(c => c.name.toLowerCase().includes('personal'))
    if (personalCal) return personalCal.id
  }
  if (lower.includes('study') || lower.includes('school') || lower.includes('learn')) {
    const studyCal = calendars.find(c => c.name.toLowerCase().includes('study'))
    if (studyCal) return studyCal.id
  }
  return inferCalendarId(input, '')
}

// ─── Deterministic intent pre-classifier ──────────────────────────────────────
// Runs before any LLM call so a recurring commitment (e.g. "soccer practice
// every Tuesday and Thursday") is never mistaken for a multi-day AI plan
// request just because it shares wording with plan-style phrasing.
function classifyIntent(text: string): 'recurring_commitment'
  | 'goal_plan' | 'single_task' | 'unclear' {
  const lower = text.toLowerCase()

  const hasDeadlineLanguage = /\bby\s+(next|this|\w+day|december|january|february|march|april|may|june|july|august|september|october|november)|\bdue\b|\bdeadline\b|\bin \d+ (days|weeks|months)\b/.test(lower)
  const hasGoalLanguage = /\bhelp me (build|learn|study|prepare|finish|write|create)\b|\bplan for\b|\bstudy plan\b|\bworkout plan\b|\bwant to (build|learn|master)\b/.test(lower)
  const hasRecurrencePattern = /\bevery (mon|tue|wed|thu|fri|sat|sun)\w*(\s+and\s+\w+)?\b|\brecurring\b|\bweekly\b(?!\s+plan)/.test(lower)
  const hasNoGoalVerb = !/\b(build|learn|study|master|write|create|finish|prepare for)\b/.test(lower)

  if (hasRecurrencePattern && hasNoGoalVerb && !hasDeadlineLanguage) {
    return 'recurring_commitment'
  }
  if (hasGoalLanguage || hasDeadlineLanguage) {
    return 'goal_plan'
  }
  if (hasRecurrencePattern) {
    return 'goal_plan' // recurring but with a goal verb, e.g. "study every day for finals"
  }
  return 'unclear'
}

/** Days of week (0=Sun … 6=Sat) mentioned by name in free text, e.g. "Tuesday and Thursday". */
function extractDaysOfWeek(text: string): number[] {
  const DAY_NAME_TO_NUM: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3,
    thu: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
  const lower = text.toLowerCase();
  const found = new Set<number>();
  const dayPattern = /\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = dayPattern.exec(lower)) !== null) {
    const num = DAY_NAME_TO_NUM[match[1]];
    if (num !== undefined) found.add(num);
  }
  return Array.from(found).sort((a, b) => a - b);
}

/** Deterministic (non-AI) time extraction — handles "6pm", "6:30 pm", and 24-hour "18:30". */
function extractTime(text: string): string | undefined {
  const lower = text.toLowerCase();
  const ampm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const military = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (military) {
    return `${military[1].padStart(2, "0")}:${military[2]}`;
  }
  return undefined;
}

/** The activity name is whatever precedes "every" — e.g. "soccer practice" from
 *  "soccer practice every Tuesday and Thursday". */
function extractActivityName(text: string): string {
  const idx = text.search(/\bevery\b/i);
  const raw = idx !== -1 ? text.slice(0, idx) : text;
  return raw.trim().replace(/^(add|schedule|create)\s+/i, "").trim() || "Activity";
}

const SIDE_EC_KEYWORDS = /\b(sport|sports|soccer|basketball|football|baseball|tennis|swim|swimming|track|volleyball|hockey|golf|wrestling|gym|workout|fitness|hobby|hobbies|art|drawing|painting|music|guitar|piano|photograph(?:y)?|cooking|baking|gaming|dance|dancing|yoga|climbing|skiing|surfing|hiking)\b/i;

/** Keyword-based (non-AI) kind default for AI-generated plans — academic-ec unless
 *  the topic clearly matches a side-EC pattern (sports, hobby keywords). */
function inferPlanKind(topic: string): TaskKind {
  return SIDE_EC_KEYWORDS.test(topic) ? "side-ec" : "academic-ec";
}

/** Voice command prompt in cache order (lib/ai/cache.ts): the playbook is the
 *  same for every student; their memory and calendars follow; the date is last. */
async function voiceSystemPrompt(tz: string, userContext?: string): Promise<Anthropic.TextBlockParam[]> {
  const calendars = await getCalendars();
  const calendarList = calendars.map((c) => `${c.id} (${c.name})`).join(", ");
  const context = `${userContext ? `USER CONTEXT (what you know about this user from past interactions):
${userContext}

Use this context to:
- Schedule tasks at times that match their preferences
- Reference their goals and commitments when relevant
- Personalize suggestions based on their patterns
- Never ask for information you already know from context

` : ""}Current calendars: ${calendarList}`;
  return layeredSystem({ playbook: VOICE_PLAYBOOK, context, volatile: promptDateContext(tz) });
}

const VOICE_PLAYBOOK = `TONE AND VOICE RULES — follow these exactly:
- Write like a smart focused personal assistant, not like an AI chatbot
- Never use filler phrases like "Certainly!", "Of course!", "Great question!", "Sure!", "Absolutely!"
- Never start a response with "I"
- Be direct and specific — say exactly what was done or found, nothing more
- Use short sentences. No corporate speak.
- When confirming a task was added say exactly what was added and when, nothing else
- When summarizing information be precise and factual, not enthusiastic
- Responses should feel like a text from a competent friend, not a customer service bot

CALENDAR AWARENESS:
The user has multiple calendars (listed after these instructions). Before adding any task you must determine which calendar it belongs to.
Default rules for calendar assignment:
- Work related tasks (meetings, calls, projects, deadlines, client work) → use the work calendar
- Personal tasks (gym, health, hobbies, family, errands) → use the personal calendar
- Study and school tasks (assignments, studying, courses, homework) → use the study calendar if it exists, otherwise personal
- If the user explicitly names a calendar always use that one
- If completely unclear use the all calendars id which is cal_all

When adding a task always include the calendarId field in your JSON response.
When the user says "move tasks to X calendar" use the move_tasks action.
When the user says "add this to my work calendar" or any named calendar use that calendar's id.
When the user asks what calendars they have, use the get_calendars action.

The student's local date and time are given at the very end. Resolve every relative date against them.

--- RECURRING COMMAND (use this when user says "every", "each", "weekly", "daily", "monthly", "every Saturday", "every Monday", "every weekday", "every day", "every week", etc.) ---
Return this exact JSON:
{"action":"add_recurring_task","title":"task title","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","frequency":"daily|weekly|monthly|yearly","daysOfWeek":[0,1,2,3,4,5,6] or null,"time":"HH:MM","response":"confirmation mentioning how many instances will be created"}

Day numbers: 0=Sunday 1=Monday 2=Tuesday 3=Wednesday 4=Thursday 5=Friday 6=Saturday

Examples:
- "every Saturday" → frequency:"weekly", daysOfWeek:[6], startDate: next Saturday from today, endDate: end of current year
- "every Saturday for 2026" → frequency:"weekly", daysOfWeek:[6], startDate:"2026-01-03", endDate:"2026-12-31"
- "every weekday" → frequency:"weekly", daysOfWeek:[1,2,3,4,5], startDate: today
- "every day" → frequency:"daily", daysOfWeek:null
- "every Monday and Wednesday" → frequency:"weekly", daysOfWeek:[1,3]
- "every month on the 15th" → frequency:"monthly", daysOfWeek:null
- If no end date specified, default endDate to December 31 of the current year

--- PLAN REQUEST (use this when user asks for a study plan, workout plan, project plan, weekly schedule, exam prep, or any multi-step goal) ---
Return this exact JSON:
{"action":"create_plan","response":"one short sentence acknowledging the goal — do not state task or session counts"}

Do NOT list tasks here. The individual tasks are generated by a dedicated planner after you return create_plan.
Use create_plan for any open-ended goal or skill the user wants to improve at or make progress on (e.g. "help me get better at chess", "help me start my history essay").

--- SINGLE TASK COMMAND (add/complete/delete one task) ---
Return this exact JSON:
{"action":"add_task"|"complete_task"|"delete_task","title":"task title","date":"YYYY-MM-DD","time":"HH:MM","calendarId":"cal_work|cal_personal|cal_study|cal_all","notes":"structured notes following the NOTES FORMAT below","startAction":"one specific concrete action under 20 words, starting with a verb","resources":[{"label":"Site — exact page title","url":"https://exact/url"}],"response":"confirmation under 15 words"}

Example:
{"action":"add_task","title":"Sales call with client","date":"2026-07-20","time":"10:00","calendarId":"cal_work","notes":"GOAL: ...","startAction":"...","resources":[],"response":"Added sales call to your Work calendar."}

Another example:
{"action":"add_task","title":"Study derivatives","date":"2026-07-20","time":"10:00","calendarId":"cal_study","notes":"GOAL: ...\\nFOCUS: ...\\nTIME: ...","startAction":"Open the Khan Academy derivatives unit and complete the first 3 exercises","resources":[{"label":"Khan Academy — Derivatives Intro","url":"https://www.khanacademy.org/..."}],"response":"Added study session for July 20th."}

CALENDARID — always include a "calendarId" field, following the CALENDAR AWARENESS rules above.

NOTES FORMAT — the notes field must follow this exact structure:
GOAL: One sentence — what you will have achieved by the end of this session.
FOCUS: 2 to 3 sentences — exactly what to work on, in what order, and how to approach it. Be specific to the actual topic, not generic.
TIME: One sentence — realistic time estimate and how to split it (example: 45 mins total — 20 mins reading, 25 mins practice problems).
The notes field must contain only plain readable text with no links or URLs. Never include URLs inside the notes text itself.

RESOURCES — find 2 to 3 specific pages from this approved list that best match this exact topic. Choose only the most relevant sources — do not include all of them. Use web search to find exact URLs, not homepage links:
- Khan Academy: exact unit or exercise page
- YouTube: exact video title and channel
- Coursera: exact course page
- MIT OpenCourseWare: exact lecture or problem set
- Quizlet: exact study set if one exists for this topic
- Crash Course: exact episode if one exists
- Codecademy: exact lesson if topic is programming related
- Google Scholar: exact paper if topic is research based
- Desmos: only if topic involves math graphing
Return task resources as a separate JSON array field called "resources" alongside the notes field.
Each resource must be an object with these exact fields:
{"label": "Khan Academy — Derivatives Introduction", "url": "https://www.khanacademy.org/exact/path/here"}
Never include a site if you are not certain the specific page exists and is relevant.
The resources array contains all links separately — never embed them in notes.

STARTACTION — generate a "startAction" field for every task alongside title, date, time, notes, and resources.
The startAction must be one specific concrete thing the user can do in the first 2 minutes to begin this task.
It must reference something real — a specific resource linked in the resources array, a specific page number, a specific action, or a specific tool to open.
It must be under 20 words.
It must start with a verb — Watch, Read, Open, Write, Complete, Solve, Review, Draft.
Never say "Start by" or "Begin with" — just give the direct action.

--- CLEAR SCHEDULE COMMAND (use this when user says "clear my schedule", "clean my schedule", "delete all my tasks", "remove everything", "wipe my calendar", "start fresh", "clear everything", "empty my schedule") ---
Return this exact JSON:
{"action":"delete_all_tasks","response":"confirmation under 15 words"}

--- GET CALENDARS (use this when the user asks what calendars exist, e.g. "what calendars do I have", "list my calendars") ---
Return this exact JSON:
{"action":"get_calendars","response":"Here are your calendars."}
Use this when you are unsure what calendars exist before assigning a task.

--- MOVE TASKS (use this when the user says "move tasks to X calendar", "move my sales calls to work calendar", "move everything from last week to personal", etc.) ---
Return this exact JSON:
{"action":"move_tasks","targetCalendarId":"cal_work","title":"sales call","response":"Moving sales calls to Work calendar."}
Required fields: targetCalendarId (string — the id or exact name of the destination calendar). For move_tasks, reuse the "title" field as a keyword to match task titles, and "startDate"/"endDate" as an optional YYYY-MM-DD date range to filter by. Omit them entirely to match all tasks.

Rules:
- If no date mentioned use the student's local date (given at the end). Default time: 09:00.
- Choose recurring vs single based on whether the user says a repeating word like "every" or "each".
- Choose plan vs single based on whether the user wants a multi-step schedule (plan) or one specific task (single).
- Use delete_all_tasks ONLY for explicit clear/wipe/remove-all commands, never for deleting a single task.
- Use get_calendars when the user asks what calendars exist.
- Use move_tasks when the user asks to move, reassign, or transfer tasks to a different calendar.`;

async function findTaskByTitle(title: string) {
  const tasks = await getAllTasks();
  const n = title.trim().toLowerCase();
  if (!n) return undefined;
  return (
    tasks.find((t) => t.title.toLowerCase() === n) ??
    tasks.find((t) => t.title.toLowerCase().includes(n) || n.includes(t.title.toLowerCase()))
  );
}

const TITLED = ["add_task", "complete_task", "delete_task", "add_recurring_task"];
const TITLED_ACTIONS = new Set(TITLED);
const KNOWN_ACTIONS = new Set(TITLED.concat(["create_plan", "delete_all_tasks", "get_calendars", "move_tasks"]));

/** A FAST voiceCommand reply the handler can act on. Anything else is
 *  low-confidence and escalates to SMART once. Exported for tests. */
export function isUsableCommand(cmd: Record<string, unknown> | null): boolean {
  if (!cmd || typeof cmd.action !== "string" || !KNOWN_ACTIONS.has(cmd.action)) return false;
  if (TITLED_ACTIONS.has(cmd.action)) return typeof cmd.title === "string" && cmd.title.trim().length > 0;
  if (cmd.action === "move_tasks") return Boolean(cmd.targetCalendarId || cmd.calendarId);
  return true;
}

/** "today", "tomorrow" or "Fri, Oct 3", plus " at 4:00 PM" when a time is given. */
function friendlyWhen(date: string, time: string | undefined, today: string): string {
  const day =
    date === today ? "today"
    : date === addDaysYMD(today, 1) ? "tomorrow"
    : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return time ? `${day} at ${formatTime12(time)}` : day;
}

/** Runs a no-AI route from lib/ai/router.ts. Returns null when it can't be
 *  carried out (no task by that name, or several), so the model gets a turn. */
async function runFastRoute(route: FastRoute, text: string, today: string): Promise<NextResponse | null> {
  const done = async (body: Record<string, unknown>) => {
    // Zero-cost ai_usage row so routing distribution can be reported next to model calls.
    void recordUsage({ userId: getRequestContext().userId, feature: "router", model: "none", usage: {}, durationMs: 0, route: `fast:${route.op}` });
    await addVoiceLog({ text, response: String(body.response ?? ""), action: String(body.action), ok: true });
    console.log("[router] fast path:", route.op);
    return NextResponse.json({ ok: true, ...body });
  };
  const confirmBody = (pending: { id: string; kind: string; message: string }) => ({
    action: "confirm_required",
    pending: { id: pending.id, kind: pending.kind, message: pending.message },
    response: pending.message,
  });

  if (route.op === "due") {
    const due = (await getAllTasks())
      .filter((t) => !t.completed && t.date >= route.start && t.date <= route.end)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const label = route.range === "week" ? "this week" : route.range;
    const shown = due.slice(0, 8).map((t) => `${t.title} (${friendlyWhen(t.date, t.time || undefined, today)})`);
    const response =
      due.length === 0 ? `Nothing due ${label}.`
      : `${due.length} due ${label}: ${shown.join("; ")}${due.length > shown.length ? `; and ${due.length - shown.length} more` : ""}.`;
    return done({ action: "list_due", response, count: due.length });
  }

  if (route.op === "add") {
    const calendarId = await resolveCalendarId(inferCalendarId(route.title));
    // Same rule as the AI path below: task.time is rendered on its own.
    const task = await addTask({ title: route.title, date: route.date, time: route.time, completed: false, calendarId });
    if (task.wasDuplicate) {
      return done({ action: "add_task", task, response: `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).`, state: await getAppState() });
    }
    const record = await recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
    return done({ action: "add_task", task, response: `Added ${route.title} for ${friendlyWhen(route.date, route.time, today)}.`, actionId: record.id, state: await getAppState() });
  }

  const tasks = await getAllTasks();

  if (route.op === "complete" || route.op === "uncomplete") {
    const completing = route.op === "complete";
    const found = matchTask(tasks, route.title, { prefer: (t) => t.completed !== completing, today });
    if (!found) return null;
    if (found.completed === completing) {
      return done({ action: completing ? "complete_task" : "uncomplete_task", response: `"${found.title}" is already ${completing ? "done" : "not done"}.` });
    }
    if (!completing) {
      const task = await updateTask(found.id, { completed: false });
      return done({ action: "uncomplete_task", task, response: `Marked "${found.title}" not done.`, state: await getAppState() });
    }
    const task = await completeTask(found.id);
    const record = await recordAction("complete_task", `Completed "${found.title}"`, { completedTaskId: found.id });
    return done({ action: "complete_task", task, response: `Marked "${found.title}" done.`, actionId: record.id, state: await getAppState() });
  }

  if (route.op === "delete") {
    const found = matchTask(tasks, route.title, { date: route.date, time: route.time });
    if (!found) return null;
    // Same confirmation as the model's delete_task.
    const pending = await addPendingConfirmation("delete_task", `Delete "${found.title}" from your schedule?`, { taskId: found.id, title: found.title });
    return done(confirmBody(pending));
  }

  // reschedule: a change to something already on the calendar, so it's confirmed too.
  const found = matchTask(tasks, route.title, {
    date: route.fromDate,
    prefer: (t) => !t.completed && t.date >= today,
    today,
  });
  if (!found) return null;
  const date = route.date ?? found.date;
  const time = route.time ?? found.time;
  const pending = await addPendingConfirmation(
    "reschedule_task",
    `Move "${found.title}" to ${friendlyWhen(date, time || undefined, today)}?`,
    { taskId: found.id, title: found.title, date, time }
  );
  return done(confirmBody(pending));
}

/** Shared voice-command handler — used by both the pen/text pipeline (app/api/voice/route.ts)
 *  and the browser hold-to-record endpoint (app/api/voice-browser/route.ts), so the
 *  downstream Claude tool-use logic is only implemented once. */
/** Progress while a plan is generated, for callers that stream it (/api/chat). */
export type PlanProgress =
  | { type: "plan_outline"; title: string; taskCount: number }
  | { type: "plan_task"; index: number; task: { title: string; date: string; time: string } };

export type VoiceOptions = {
  forcePlan?: boolean;
  context?: string;
  /** Called as the plan outline and each task arrive. Nothing is saved until the end. */
  onProgress?: (event: PlanProgress) => void;
};

/**
 * `opts.context` is earlier conversation (e.g. a plan drafted in Plan mode) that
 * the model may draw on. It only reaches the LLM prompts — never the keyword
 * detectors, so words inside a drafted plan can't trigger a clear or a reroute.
 */
export async function handleVoiceText(
  text: string,
  opts: VoiceOptions = {}
): Promise<NextResponse> {
  // Dev-only timing (lib/perf.ts); the plan path re-enters here and joins the same trace.
  if (opts.forcePlan) perfCount("pipeline re-entries");
  return withPerfTrace(`voice pipeline "${text.slice(0, 40)}"`, () => handleVoiceTextInner(text, opts));
}

async function handleVoiceTextInner(
  text: string,
  opts: VoiceOptions
): Promise<NextResponse> {
  const withContext = (t: string) =>
    opts.context
      ? `${t}\n\nEarlier in this conversation (use it for what "it", "that", or "this plan" refers to):\n${opts.context}`
      : t;
  try {
    const tz = await getUserTimezone();
    const local = localNow(tz);
    console.log("[api/voice] POST received text:", text);

    // Detect clear-schedule commands instantly — no API call needed
    const lowerText = text.toLowerCase().trim();
    if (/clear|clean|wipe|empty|delete all|remove all|reset|start fresh|start over/.test(lowerText)) {
      console.log("[api/voice] Clear schedule detected — requesting confirmation");
      return await requestClearConfirmation(text);
    }

    // ── Deterministic intent classification — runs before any AI plan-generation path ──
    const classifiedIntent = classifyIntent(text);
    console.log("[intent] classified as:", classifiedIntent, "for:", text);

    if (classifiedIntent === "recurring_commitment") {
      const activityName = extractActivityName(text);
      const extractedDays = extractDaysOfWeek(text);
      const daysOfWeek = extractedDays.length > 0 ? extractedDays : [1, 2, 3, 4, 5];
      const time = extractTime(text) ?? "";
      const calendarId = inferCalendarId(activityName);

      const recurringTasks = await addRecurringTask(
        {
          title: activityName,
          date: local.date,
          time,
          kind: "commitment",
          completed: false,
          calendarId,
          notes: `Recurring commitment added by voice: "${text}"`,
        },
        { frequency: "weekly", daysOfWeek }
      );

      const record = await recordAction("add_recurring_task", `Added ${recurringTasks.length} recurring "${activityName}" instances`, {
        addedTaskIds: recurringTasks.map((t) => t.id),
      });

      const response = `Added "${activityName}" as a recurring commitment. Created ${recurringTasks.length} instances.`;
      await addVoiceLog({ text, response, action: "add_recurring_task", ok: true });
      console.log("[api/voice] recurring_commitment handled deterministically — instances:", recurringTasks.length);

      return NextResponse.json({
        ok: true,
        action: "add_recurring_task",
        count: recurringTasks.length,
        response,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    // ── No-AI fast paths (lib/ai/router.ts) ──
    // Before the agent check: "what's due today" would otherwise start the Canvas tool loop.
    if (!opts.forcePlan) {
      const fast = routeCommand(text, tz);
      if (fast) {
        const handled = await perfSpan(`router: ${fast.op}`, () => runFastRoute(fast, text, local.date));
        if (handled) return handled;
        console.log("[router] fast path missed:", fast.op, "— asking the model");
        setAiRoute(ROUTES.fastMiss);
      }
    }
    const routeAs = (route: string) => {
      if (!getRequestContext().aiRoute) setAiRoute(route);
    };

    // Gmail / Canvas commands — routed through a genuine multi-turn Claude tool-use loop
    // so Claude can read real inbox/assignment data, then act using add_task / create_plan.
    if (needsAgentTools(text)) {
      routeAs(ROUTES.smart);
      console.log("[api/voice] Detected Gmail/Canvas/Calendar command — running agent tool loop");
      try {
        const result = await runVoiceAgentToolLoop(withContext(text), text);
        await addVoiceLog({ text, response: result.response, action: result.action, ok: true });
        console.log("[api/voice] Agent tool loop finished — action:", result.action);
        if (result.action === "confirm_required" && result.pending) {
          return NextResponse.json({
            ok: true,
            action: "confirm_required",
            pending: result.pending,
            response: result.response,
          });
        }
        return NextResponse.json({
          ok: true,
          action: result.action,
          response: result.response,
          task: result.task,
          plan: result.plan,
          count: result.count,
          actionId: result.actionId,
          sourcesChecked: result.sourcesChecked,
          state: await getAppState(),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Agent tool loop failed";
        console.error("[api/voice] Agent tool loop error:", message);
        await addVoiceLog({ text, response: message, action: "error", ok: false });
        return NextResponse.json({ ok: false, error: message }, { status: 502 });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[api/voice] Missing ANTHROPIC_API_KEY");
      await addVoiceLog({ text, response: "Missing ANTHROPIC_API_KEY", action: "error", ok: false });
      return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 401 });
    }

    const today = local.date;

    // ── Two-step plan approach (FIX 1 + FIX 2) ───────────────────────────────
    const isPlanRequest = opts.forcePlan || classifiedIntent === "goal_plan" || isClearPlanRequest(text) || /plan|study|workout|routine|schedule|prepare|curriculum|course|week|month|learn|guide/i.test(text);

    if (isPlanRequest) {
      routeAs(ROUTES.smart);
      console.log("[api/voice] Detected plan request — using two-step approach");

      // FIX 2 — Extract date range from user text
      let startDate = today;
      let endDate = addDaysYMD(today, 7);

      const monthMap: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      };
      const ordinalMap: Record<string, number> = {
        first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
        sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
        eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
        sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
        "twenty first": 21, "twenty second": 22, "twenty third": 23, "twenty fourth": 24,
        "twenty fifth": 25, "twenty sixth": 26, "twenty seventh": 27, "twenty eighth": 28,
        "twenty ninth": 29, thirtieth: 30, "thirty first": 31,
      };
      const numberWordMap: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
        eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
        fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
        nineteen: 19, twenty: 20, thirty: 30,
      };

      const lowerForDate = text.toLowerCase();
      const foundDates: { month: number; day: number; position: number }[] = [];

      // BUGFIX: the previous version used lowerForDate.indexOf(monthName) which only
      // finds the FIRST occurrence of each month name. For "from july 20 to july 27"
      // both dates share the month "july", so only one mention was ever captured and
      // the code fell into the single-date branch (startDate defaulted to today instead
      // of july 20). Search ALL occurrences of each month name instead.
      for (const [monthName, monthIdx] of Object.entries(monthMap)) {
        let searchStart = 0;
        while (true) {
          const monthPos = lowerForDate.indexOf(monthName, searchStart);
          if (monthPos === -1) break;
          searchStart = monthPos + 1;

          let foundDay = 1;
          const surroundingText = lowerForDate.slice(Math.max(0, monthPos - 20), monthPos + monthName.length + 20);

          const numericAfter = surroundingText.match(new RegExp(monthName + "\\s+(\\d{1,2})"));
          const numericBefore = surroundingText.match(new RegExp("(\\d{1,2})\\s+" + monthName));

          if (numericAfter) {
            foundDay = parseInt(numericAfter[1]);
          } else if (numericBefore) {
            foundDay = parseInt(numericBefore[1]);
          } else {
            for (const [ordinal, day] of Object.entries(ordinalMap)) {
              if (surroundingText.includes(ordinal)) {
                foundDay = day;
                break;
              }
            }
            for (const [numWord, day] of Object.entries(numberWordMap)) {
              if (surroundingText.includes(numWord)) {
                foundDay = day;
                break;
              }
            }
          }

          foundDates.push({ month: monthIdx, day: foundDay, position: monthPos });
        }
      }

      foundDates.sort((a, b) => a.position - b.position);

      if (foundDates.length >= 2) {
        startDate = ymdFromParts(local.year, foundDates[0].month, foundDates[0].day);
        endDate = ymdFromParts(local.year, foundDates[1].month, foundDates[1].day);
        console.log("[api/voice] Extracted date range from text:", startDate, "to", endDate);
      } else if (foundDates.length === 1) {
        startDate = today;
        endDate = ymdFromParts(local.year, foundDates[0].month, foundDates[0].day);
        console.log("[api/voice] Extracted end date only:", endDate);
      }

      // Duration word detection — overrides date extraction when explicit duration is mentioned
      // Singular and hyphenated forms count too: "2 week plan", "3-month plan".
      const durationPatterns: [RegExp, number][] = [
        [/\b((one|1|a)[- ]year|yearly|365 days)\b/i, 365],
        [/\b(half[- ]year|(6|six)[- ]months?|180 days)\b/i, 180],
        [/\b((3|three)[- ]months?|90 days|quarter)\b/i, 90],
        [/\b((2|two)[- ]months?|60 days)\b/i, 60],
        [/\b((one|1|a)[- ]month|monthly|30 days)\b/i, 30],
        [/\b((4|four)[- ]weeks?|28 days)\b/i, 28],
        [/\b((3|three)[- ]weeks?|21 days)\b/i, 21],
        [/\b((2|two)[- ]weeks?|fortnight|14 days)\b/i, 14],
        [/\b((one|1|a)[- ]week|weekly|7 days)\b/i, 7],
      ];

      for (const [pattern, days] of durationPatterns) {
        if (pattern.test(lowerForDate)) {
          endDate = addDaysYMD(today, days - 1);
          startDate = today;
          console.log("[api/voice] Duration word matched — days:", days, "| endDate:", endDate);
          break;
        }
      }
      console.log("[api/voice] Final date range:", startDate, "to", endDate);

      // Session dates are fixed here (lib/ai/plan.ts sessionInterval), not by the model.
      const dates = planDates(startDate, endDate);
      console.log("[api/voice] Plan sessions:", dates.length, "from", startDate, "to", endDate);

      const generated = await perfSpan("plan: generate", () =>
        generatePlan({
          request: withContext(text),
          dateContext: promptDateContext(tz),
          dates,
          onOutline: (o) => opts.onProgress?.({ type: "plan_outline", title: resolvePlanTitle(o.title, text), taskCount: o.taskCount }),
          onTask: (index, t) => opts.onProgress?.({ type: "plan_task", index, task: { title: t.title, date: t.date, time: t.time } }),
        })
      );
      const budgetMessage = !generated.ok && generated.budgetExceeded ? generated.error : null;
      if (!generated.ok) console.error("[api/voice] Plan generation failed:", generated.error);

      if (generated.ok && generated.tasks.length > 0) {
        const planKind = inferPlanKind(text);
        const calendarIds = new Map<string, string>();
        for (const id of Array.from(new Set(generated.tasks.map((t) => t.calendarId)))) calendarIds.set(id, await resolveCalendarId(id));
        // One insert for every task, with plan_id already set (store.addPlanWithTasks).
        const { plan, tasks: created, skippedDuplicates } = await perfSpan(`plan: insert ${generated.tasks.length} tasks`, () =>
          addPlanWithTasks(
            { title: resolvePlanTitle(generated.title, text), description: "" },
            generated.tasks.map((t) => ({
              title: t.title,
              date: t.date,
              time: t.time,
              kind: planKind,
              completed: false,
              calendarId: calendarIds.get(t.calendarId) ?? "cal_all",
              notes: t.notes || undefined,
              startAction: t.startAction || undefined,
              resources: t.resources.length > 0 ? t.resources : undefined,
            }))
          )
        );
        const taskIds = created.map((t) => t.id);
        const record = await perfSpan("plan: undo record", () => recordAction("create_plan", `Created plan "${plan.title}" with ${taskIds.length} tasks`, {
          addedTaskIds: taskIds,
          addedPlanId: plan.id,
        }));

        const dupSuffix = skippedDuplicates > 0 ? ` Skipped ${skippedDuplicates} duplicate${skippedDuplicates > 1 ? "s" : ""}.` : "";
        await perfSpan("plan: voice log", () => addVoiceLog({ text, response: `Plan created with ${taskIds.length} tasks`, action: "create_plan", ok: true }));
        return NextResponse.json({
          ok: true,
          action: "create_plan",
          count: taskIds.length,
          response: `Your plan has been created with ${taskIds.length} tasks added to your calendar!${dupSuffix}`,
          plan: { id: plan.id, title: plan.title, taskCount: taskIds.length, color: plan.color },
          actionId: record.id,
          state: await perfSpan("plan: full app state", () => getAppState()),
        });
      }

      if (budgetMessage) {
        await addVoiceLog({ text, response: budgetMessage, action: "error", ok: false });
        return NextResponse.json({ ok: false, error: budgetMessage, response: budgetMessage }, { status: 429 });
      }

      // Fallback: add as a single generic task if plan generation failed
      console.log("[api/voice] Plan generation failed — adding as single task");
      const fallbackTask = await addTask({
        title: text.substring(0, 50),
        date: today,
        time: "09:00",
        kind: inferPlanKind(text),
        completed: false,
        calendarId: null,
        notes: "Plan requested: " + text,
      });
      if (fallbackTask.wasDuplicate) {
        const dupResponse = "Skipped 1 duplicate (already have a similar task around that time).";
        await addVoiceLog({ text, response: dupResponse, action: "add_task", ok: true });
        return NextResponse.json({ ok: true, action: "add_task", task: fallbackTask, response: dupResponse, state: await getAppState() });
      }
      const fallbackRecord = await recordAction("add_task", `Added "${fallbackTask.title}"`, { addedTaskIds: [fallbackTask.id] });
      await addVoiceLog({ text, response: "Added as single task", action: "add_task", ok: true });
      return NextResponse.json({
        ok: true,
        action: "add_task",
        actionId: fallbackRecord.id,
        task: fallbackTask,
        response: "I added this to your tasks. For detailed plans try being more specific.",
        state: await getAppState(),
      });
    }

    // ── Standard single-task / recurring path ─────────────────────────────────
    console.log("[api/voice] Calling Anthropic API...");
    routeAs(ROUTES.fast);
    const userContext = await getContextAsString();
    const voiceRequest = {
      system: await voiceSystemPrompt(tz, userContext),
      messages: [{ role: "user" as const, content: withContext(text) }],
    };
    const anthropicResponse = await callClaude("voiceCommand", voiceRequest, {
      format: { type: "json_schema", schema: VOICE_COMMAND_SCHEMA },
    });

    if (!anthropicResponse.ok) {
      console.error("[api/voice] Anthropic error:", anthropicResponse.status, anthropicResponse.error);

      if (anthropicResponse.status === 429) {
        console.log("[api/voice] Rate limited — waiting 2 seconds and retrying with simpler request");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const retryResponse = await callClaude(
          "voiceCommandRetry",
          {
            system: `Extract a short task title from the user's message and respond with an add_task command. ${promptDateContext(tz)}`,
            messages: [{ role: "user", content: text.substring(0, 100) }],
          },
          { format: { type: "json_schema", schema: VOICE_COMMAND_SCHEMA } }
        );

        if (retryResponse.ok) {
          let retryJson: Record<string, unknown> | null = null;
          try {
            retryJson = extractStructuredJson<Record<string, unknown>>(retryResponse.message);
          } catch (e) {
            console.error("[api/voice] Retry response parsing failed:", e instanceof Error ? e.message : e);
          }
          if (retryJson) {
            const cmd = retryJson;
            if (cmd.action === "add_task" && typeof cmd.title === "string" && cmd.title) {
              const retryDate = singleRelativeDay(text, tz) ?? (typeof cmd.date === "string" ? cmd.date : today);
              const retryTime = typeof cmd.time === "string" ? cmd.time : "09:00";
              const task = await addTask({
                title: cmd.title,
                date: retryDate,
                time: retryTime,
                completed: false,
                calendarId: null,
                notes: "Added after retry: " + text.substring(0, 100),
              });
              if (task.wasDuplicate) {
                const dupResponse = `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).`;
                await addVoiceLog({ text, response: dupResponse, action: "add_task", ok: true });
                return NextResponse.json({ ok: true, action: "add_task", task, response: dupResponse, state: await getAppState() });
              }
              const retryRecord = await recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
              await addVoiceLog({ text, response: "Task added after retry", action: "add_task", ok: true });
              return NextResponse.json({
                ok: true,
                action: "add_task",
                task,
                response: (cmd.response as string) || "Task added!",
                actionId: retryRecord.id,
                state: await getAppState(),
              });
            }
          }
        }

        return NextResponse.json({
          ok: false,
          error: "Rate limit exceeded. Please wait a moment and try again.",
          response: "Too many requests. Please wait 30 seconds and try again.",
        }, { status: 429 });
      }

      await addVoiceLog({ text, response: `Anthropic error ${anthropicResponse.status}`, action: "error", ok: false });
      return NextResponse.json({ ok: false, error: `Anthropic error: ${anthropicResponse.status} ${anthropicResponse.error}` }, { status: 502 });
    }


    let parsed: Record<string, unknown> | null = null;
    let parseError = "Could not understand that command.";
    try {
      parsed = extractStructuredJson<Record<string, unknown>>(anthropicResponse.message);
    } catch (e) {
      parseError = e instanceof Error ? e.message : parseError;
    }
    // Low-confidence FAST reply (unparseable, unknown action, or missing the
    // field the action needs): ask the SMART model once before giving up.
    if (!isUsableCommand(parsed)) {
      console.log("[router] FAST reply unusable — escalating to SMART:", parsed ? `action=${String(parsed.action)} fields=${Object.keys(parsed).join(",")}` : parseError);
      const smart = await callClaude("voiceCommand", voiceRequest, {
        format: { type: "json_schema", schema: VOICE_COMMAND_SCHEMA },
        tier: "SMART",
        route: ROUTES.escalation,
      });
      if (smart.ok) {
        try {
          const retry = extractStructuredJson<Record<string, unknown>>(smart.message);
          if (isUsableCommand(retry)) parsed = retry;
        } catch (e) {
          parseError = e instanceof Error ? e.message : parseError;
        }
      }
    }
    if (!parsed) {
      const message = parseError;
      console.error("[api/voice] Structured response parsing failed:", message);
      await addVoiceLog({ text, response: message, action: "error", ok: false });
      return NextResponse.json({
        ok: false,
        error: message,
        response: "Sorry I did not understand that command. Please try again.",
      }, { status: 422 });
    }

    const cmd = parsed;
    const action = cmd.action as string;
    const title = (cmd.title as string | undefined) ?? "";
    const response = (cmd.response as string | undefined) ?? "";
    const time = (cmd.time as string | undefined) ?? "09:00";

    console.log("[api/voice] Parsed — action:", action, "| title:", title);

    // ── Recurring task ─────────────────────────────────────────────────────────
    if (action === "add_recurring_task") {
      if (!title.trim()) {
        await addVoiceLog({ text, response: "No title provided", action, ok: false });
        return NextResponse.json({ ok: false, error: "No title in AI response" }, { status: 422 });
      }

      const rawFreq = cmd.frequency as string | undefined;
      const freq = rawFreq === "daily" || rawFreq === "weekly" || rawFreq === "monthly" || rawFreq === "yearly"
        ? rawFreq : "weekly";
      const startDate = (cmd.startDate as string | undefined) ?? today;
      const rawEndDate = cmd.endDate as string | null | undefined;
      const endDate = typeof rawEndDate === "string" ? rawEndDate : undefined;
      const rawDow = cmd.daysOfWeek;
      const daysOfWeek = Array.isArray(rawDow) ? (rawDow as number[]) : undefined;

      console.log("[api/voice] add_recurring_task — freq:", freq, "| start:", startDate, "| end:", endDate, "| daysOfWeek:", daysOfWeek);

      const recurringTasks = await addRecurringTask(
        {
          title,
          date: startDate,
          time,
          completed: false,
          calendarId: null,
          notes: `Recurring task added by voice: "${text}"`,
        },
        { frequency: freq, daysOfWeek, endDate }
      );

      const record = await recordAction("add_recurring_task", `Added ${recurringTasks.length} recurring "${title}" instances`, {
        addedTaskIds: recurringTasks.map((t) => t.id),
      });

      const confirmMsg = `${response} (${recurringTasks.length} instances created)`;
      await addVoiceLog({ text, response: confirmMsg, action, ok: true });
      console.log("[api/voice] add_recurring_task success — instances:", recurringTasks.length);

      return NextResponse.json({
        ok: true,
        action,
        count: recurringTasks.length,
        response: `${response} Created ${recurringTasks.length} instances.`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    // ── Plan ──────────────────────────────────────────────────────────────────
    // VOICE_COMMAND_SCHEMA cannot carry a tasks array, so the model can only signal
    // plan intent here. Hand off to the plan generator (lib/ai/plan.ts) instead
    // of creating a plan with no tasks.
    if (action === "create_plan") {
      console.log("[api/voice] create_plan from standard path — delegating to plan generator");
      return handleVoiceText(text, { ...opts, forcePlan: true });
    }

    // ── Clear all tasks ────────────────────────────────────────────────────────
    if (action === "delete_all_tasks") {
      console.log("[api/voice] delete_all_tasks — requesting confirmation");
      return await requestClearConfirmation(text);
    }

    // ── Get calendars ──────────────────────────────────────────────────────────
    if (action === "get_calendars") {
      const calendars = await getCalendars();
      const msg = `You have ${calendars.length} calendars: ${calendars.map((c) => c.name).join(", ")}`;
      await addVoiceLog({ text, response: msg, action, ok: true });
      console.log("[api/voice] get_calendars success — count:", calendars.length);
      return NextResponse.json({
        ok: true,
        action: "get_calendars",
        calendars,
        response: msg,
        state: await getAppState(),
      });
    }

    // ── Move tasks between calendars ───────────────────────────────────────────
    if (action === "move_tasks") {
      const targetCalendarId = (cmd.targetCalendarId as string | undefined) ?? (cmd.calendarId as string | undefined);
      // move_tasks reuses the schema's existing "title"/"startDate"/"endDate" fields as its
      // filter — see the VOICE_COMMAND_SCHEMA comment above for why there are no dedicated
      // filterTitle/filterDateStart/filterDateEnd fields.
      const filterTitle = cmd.title as string | undefined;
      const filterDateStart = cmd.startDate as string | undefined;
      const filterDateEnd = cmd.endDate as string | undefined;
      const filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } } = {};
      if (filterTitle) filter.title = filterTitle;
      if (filterDateStart && filterDateEnd) filter.dateRange = { start: filterDateStart, end: filterDateEnd };

      if (!targetCalendarId) {
        await addVoiceLog({ text, response: "No target calendar specified", action, ok: false });
        return NextResponse.json({ ok: false, error: "No target calendar specified" }, { status: 422 });
      }

      const calendars = await getCalendars();
      const targetCalendar = calendars.find(
        (c) => c.id === targetCalendarId || c.name.toLowerCase() === targetCalendarId.toLowerCase()
      );

      if (!targetCalendar) {
        const err = `Calendar "${targetCalendarId}" not found. Available: ${calendars.map((c) => c.name).join(", ")}`;
        await addVoiceLog({ text, response: err, action, ok: false });
        return NextResponse.json({ ok: false, error: err }, { status: 422 });
      }

      const matching = await getTasksMatchingFilter(filter);
      if (matching.length === 0) {
        const msg = "No matching tasks to move.";
        await addVoiceLog({ text, response: msg, action, ok: true });
        return NextResponse.json({ ok: true, action: "move_tasks", moved: 0, response: msg, state: await getAppState() });
      }

      // Any move that changes existing tasks' calendars requires explicit confirmation,
      // regardless of how many tasks match — moving is a change to something that already
      // exists on the calendar, not new content, so it's held to the same bar as delete/reschedule.
      const pending = await addPendingConfirmation(
        "move_tasks",
        `Move ${matching.length} task${matching.length !== 1 ? "s" : ""} to your ${targetCalendar.name} calendar?`,
        { filter, targetCalendarId: targetCalendar.id, targetCalendarName: targetCalendar.name }
      );
      await addVoiceLog({ text, response: "Awaiting confirmation to move tasks", action: "confirm_required", ok: true });
      return NextResponse.json({
        ok: true,
        action: "confirm_required",
        pending: { id: pending.id, kind: pending.kind, message: pending.message },
        response: pending.message,
      });
    }

    // ── Single task ────────────────────────────────────────────────────────────
    // A capture naming one relative day ("tomorrow", "tonight", "friday") is
    // pinned to the student's local calendar, whatever date the model returned.
    const aiDate = typeof cmd.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cmd.date) ? cmd.date : undefined;
    const hintedDate = singleRelativeDay(text, tz);
    const date = hintedDate ?? aiDate ?? today;
    if (hintedDate && aiDate && aiDate !== hintedDate) {
      console.log("[api/voice] model date", aiDate, "corrected to local", hintedDate, "(" + tz + ")");
    }

    if (action === "add_task") {
      if (!title.trim()) {
        await addVoiceLog({ text, response: "No title provided", action, ok: false });
        return NextResponse.json({ ok: false, error: "No title in AI response" }, { status: 422 });
      }
      const notes = (cmd.notes as string | undefined)?.trim() || undefined;
      const startAction = (cmd.startAction as string | undefined)?.trim() || undefined;
      const rawResources = Array.isArray(cmd.resources)
        ? (cmd.resources as unknown[]).filter(
            (r): r is { label: string; url: string } =>
              !!r && typeof r === "object" && typeof (r as Record<string, unknown>).label === "string" && typeof (r as Record<string, unknown>).url === "string"
          )
        : undefined;
      const resources = rawResources && rawResources.length > 0 ? rawResources : undefined;
      const calendarId = await resolveCalendarId(typeof cmd.calendarId === "string" ? cmd.calendarId : undefined);
      // The title is the title. Every surface renders task.time next to it
      // (TaskRow, the Today hero, the calendar day panel), so folding the time
      // into the title printed it twice: "Study math (15:00)  3:00 PM".
      const task = await addTask({ title, date, time, completed: false, calendarId, notes, startAction, resources });
      if (task.wasDuplicate) {
        const dupResponse = `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).`;
        console.log("[api/voice] add_task skipped duplicate:", task.id, task.title);
        await addVoiceLog({ text, response: dupResponse, action, ok: true });
        return NextResponse.json({ ok: true, action, task, response: dupResponse, state: await getAppState() });
      }
      const addRecord = await recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
      console.log("[api/voice] add_task success:", task.id, task.title);
      await addVoiceLog({ text, response, action, ok: true });
      return NextResponse.json({ ok: true, action, task, response, actionId: addRecord.id, state: await getAppState() });
    }

    if (action === "complete_task") {
      const found = await findTaskByTitle(title);
      if (!found) {
        await addVoiceLog({ text, response: `Task not found: ${title}`, action, ok: false });
        return NextResponse.json({ ok: false, error: `Task not found: ${title}` }, { status: 404 });
      }
      const task = await completeTask(found.id);
      const completeRecord = await recordAction("complete_task", `Completed "${found.title}"`, { completedTaskId: found.id });
      console.log("[api/voice] complete_task success:", found.id);
      await addVoiceLog({ text, response, action, ok: true });
      return NextResponse.json({ ok: true, action, task, response, actionId: completeRecord.id, state: await getAppState() });
    }

    if (action === "delete_task") {
      const found = await findTaskByTitle(title);
      if (!found) {
        await addVoiceLog({ text, response: `Task not found: ${title}`, action, ok: false });
        return NextResponse.json({ ok: false, error: `Task not found: ${title}` }, { status: 404 });
      }
      // Deleting a task that already exists on the calendar is a destructive change to
      // existing content, not new creation — always confirm before it happens.
      const pending = await addPendingConfirmation(
        "delete_task",
        `Delete "${found.title}" from your schedule?`,
        { taskId: found.id, title: found.title }
      );
      await addVoiceLog({ text, response: "Awaiting confirmation to delete task", action: "confirm_required", ok: true });
      return NextResponse.json({
        ok: true,
        action: "confirm_required",
        pending: { id: pending.id, kind: pending.kind, message: pending.message },
        response: pending.message,
      });
    }

    console.log("[api/voice] Unknown action from AI:", action);
    await addVoiceLog({ text, response: `Unknown action: ${action}`, action: action ?? "unknown", ok: false });
    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 422 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/voice] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
