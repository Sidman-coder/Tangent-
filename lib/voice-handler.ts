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
import { addTask, addPlan, addRecurringTask, completeTask, deleteTask, addVoiceLog, updateTask, getAppState, getAllTasks, getCalendars, moveTasksToCalendar, getTasksMatchingFilter, getContextAsString, recordAction, addPendingConfirmation } from "@/lib/store";
import type { TaskKind } from "@/lib/types";
import { needsAgentTools, runVoiceAgentToolLoop } from "@/lib/voice-agent-tools";
import { extractStructuredJson } from "@/lib/anthropic-json";

const RESOURCE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string" },
    url: { type: "string" },
  },
  required: ["label", "url"],
  additionalProperties: false,
} as const;

const PLAN_TASK_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    date: { type: "string" },
    time: { type: "string" },
    calendarId: { type: "string" },
    notes: { type: "string" },
    startAction: { type: "string" },
    resources: { type: "array", items: RESOURCE_ITEM_SCHEMA },
  },
  required: ["title", "date"],
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
// generate the tasks via the separate, simpler PLAN_SCHEMA below (confirmed
// independently safe despite nesting PLAN_TASK_ITEM_SCHEMA/RESOURCE_ITEM_SCHEMA, since it only
// has 3 top-level properties).

/** Shape returned by the dedicated two-step plan-generation call (planSystemPrompt). */
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    action: { const: "create_plan" },
    response: { type: "string" },
    tasks: { type: "array", items: PLAN_TASK_ITEM_SCHEMA },
  },
  required: ["action", "response", "tasks"],
  additionalProperties: false,
} as const;

/** Number of tasks/sessions a plan summary sentence promises (e.g. "18 focused sessions"), or null if it names none. */
function claimedSessionCount(summary: unknown): number | null {
  if (typeof summary !== "string") return null;
  const m = summary.match(/(\d+)\s+(?:[a-z-]+\s+){0,2}(?:tasks?|sessions?)\b/i);
  return m ? Number(m[1]) : null;
}

/** Clearing the whole schedule always requires confirmation — it's total and irreversible
 *  from the user's perspective without the undo system. Shared by all three call sites
 *  below (instant-detect, LLM-returned action, and the JSON-parse-failed fallback). */
function requestClearConfirmation(text: string): NextResponse {
  const existing = getAllTasks();
  if (existing.length === 0) {
    addVoiceLog({ text, response: "Nothing to clear — schedule is already empty", action: "delete_all_tasks", ok: true });
    return NextResponse.json({
      ok: true,
      action: "delete_all_tasks",
      response: "Your schedule is already empty.",
      state: getAppState(),
    });
  }
  const pending = addPendingConfirmation(
    "delete_all_tasks",
    `Clear all ${existing.length} tasks from your schedule?`,
    {}
  );
  addVoiceLog({ text, response: "Awaiting confirmation to clear schedule", action: "confirm_required", ok: true });
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

export function resolveCalendarId(input: string | undefined): string {
  if (!input) return 'cal_all'
  const calendars = getCalendars()
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

function voiceSystemPrompt(userContext?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const calendars = getCalendars();
  const calendarList = calendars.map((c) => `${c.id} (${c.name})`).join(", ");

  return `TONE AND VOICE RULES — follow these exactly:
- Write like a smart focused personal assistant, not like an AI chatbot
- Never use filler phrases like "Certainly!", "Of course!", "Great question!", "Sure!", "Absolutely!"
- Never start a response with "I"
- Be direct and specific — say exactly what was done or found, nothing more
- Use short sentences. No corporate speak.
- When confirming a task was added say exactly what was added and when, nothing else
- When summarizing information be precise and factual, not enthusiastic
- Responses should feel like a text from a competent friend, not a customer service bot
${userContext ? `
USER CONTEXT (what you know about this user from past interactions):
${userContext}

Use this context to:
- Schedule tasks at times that match their preferences
- Reference their goals and commitments when relevant
- Personalize suggestions based on their patterns
- Never ask for information you already know from context
` : ''}

CALENDAR AWARENESS:
The user has multiple calendars. Before adding any task you must determine which calendar it belongs to.
Current calendars: ${calendarList}
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

Today is ${today}. Tomorrow is ${tomorrow}. Current year is ${currentYear}.

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
- If no end date specified, default endDate to end of current year (${currentYear}-12-31)

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
- If no date mentioned use today (${today}). Default time: 09:00.
- Choose recurring vs single based on whether the user says a repeating word like "every" or "each".
- Choose plan vs single based on whether the user wants a multi-step schedule (plan) or one specific task (single).
- Use delete_all_tasks ONLY for explicit clear/wipe/remove-all commands, never for deleting a single task.
- Use get_calendars when the user asks what calendars exist.
- Use move_tasks when the user asks to move, reassign, or transfer tasks to a different calendar.`;
}

function findTaskByTitle(title: string) {
  const tasks = getAllTasks();
  const n = title.trim().toLowerCase();
  if (!n) return undefined;
  return (
    tasks.find((t) => t.title.toLowerCase() === n) ??
    tasks.find((t) => t.title.toLowerCase().includes(n) || n.includes(t.title.toLowerCase()))
  );
}

/** Shared voice-command handler — used by both the pen/text pipeline (app/api/voice/route.ts)
 *  and the browser hold-to-record endpoint (app/api/voice-browser/route.ts), so the
 *  downstream Claude tool-use logic is only implemented once. */
/**
 * `opts.context` is earlier conversation (e.g. a plan drafted in Plan mode) that
 * the model may draw on. It only reaches the LLM prompts — never the keyword
 * detectors, so words inside a drafted plan can't trigger a clear or a reroute.
 */
export async function handleVoiceText(
  text: string,
  opts: { forcePlan?: boolean; context?: string } = {}
): Promise<NextResponse> {
  const withContext = (t: string) =>
    opts.context
      ? `${t}\n\nEarlier in this conversation (use it for what "it", "that", or "this plan" refers to):\n${opts.context}`
      : t;
  try {
    console.log("[api/voice] Handler called. Task count:", getAllTasks().length);
    console.log("[api/voice] POST received text:", text);

    // Detect clear-schedule commands instantly — no API call needed
    const lowerText = text.toLowerCase().trim();
    if (/clear|clean|wipe|empty|delete all|remove all|reset|start fresh|start over/.test(lowerText)) {
      console.log("[api/voice] Clear schedule detected — requesting confirmation");
      return requestClearConfirmation(text);
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

      const recurringTasks = addRecurringTask(
        {
          title: activityName,
          date: new Date().toISOString().slice(0, 10),
          time,
          kind: "commitment",
          completed: false,
          calendarId,
          notes: `Recurring commitment added by voice: "${text}"`,
        },
        { frequency: "weekly", daysOfWeek }
      );

      const record = recordAction("add_recurring_task", `Added ${recurringTasks.length} recurring "${activityName}" instances`, {
        addedTaskIds: recurringTasks.map((t) => t.id),
      });

      const response = `Added "${activityName}" as a recurring commitment. Created ${recurringTasks.length} instances.`;
      addVoiceLog({ text, response, action: "add_recurring_task", ok: true });
      console.log("[api/voice] recurring_commitment handled deterministically — instances:", recurringTasks.length);

      return NextResponse.json({
        ok: true,
        action: "add_recurring_task",
        count: recurringTasks.length,
        response,
        actionId: record.id,
        state: getAppState(),
      });
    }

    // Gmail / Canvas commands — routed through a genuine multi-turn Claude tool-use loop
    // so Claude can read real inbox/assignment data, then act using add_task / create_plan.
    if (needsAgentTools(text)) {
      console.log("[api/voice] Detected Gmail/Canvas/Calendar command — running agent tool loop");
      try {
        const result = await runVoiceAgentToolLoop(withContext(text));
        addVoiceLog({ text, response: result.response, action: result.action, ok: true });
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
          state: getAppState(),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Agent tool loop failed";
        console.error("[api/voice] Agent tool loop error:", message);
        addVoiceLog({ text, response: message, action: "error", ok: false });
        return NextResponse.json({ ok: false, error: message }, { status: 502 });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[api/voice] Missing ANTHROPIC_API_KEY");
      addVoiceLog({ text, response: "Missing ANTHROPIC_API_KEY", action: "error", ok: false });
      return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);

    // ── Two-step plan approach (FIX 1 + FIX 2) ───────────────────────────────
    const isPlanRequest = opts.forcePlan || classifiedIntent === "goal_plan" || /plan|study|workout|routine|schedule|prepare|curriculum|course|week|month|learn|guide/i.test(text);

    if (isPlanRequest) {
      console.log("[api/voice] Detected plan request — using two-step approach");

      // FIX 2 — Extract date range from user text
      const todayDate = new Date();
      let startDate = todayDate.toISOString().split("T")[0];
      let endDate = new Date(todayDate.getTime() + 7 * 86400000).toISOString().split("T")[0];

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
        const year = todayDate.getFullYear();
        startDate = new Date(year, foundDates[0].month, foundDates[0].day).toISOString().split("T")[0];
        endDate = new Date(year, foundDates[1].month, foundDates[1].day).toISOString().split("T")[0];
        console.log("[api/voice] Extracted date range from text:", startDate, "to", endDate);
      } else if (foundDates.length === 1) {
        const year = todayDate.getFullYear();
        startDate = todayDate.toISOString().split("T")[0];
        endDate = new Date(year, foundDates[0].month, foundDates[0].day).toISOString().split("T")[0];
        console.log("[api/voice] Extracted end date only:", endDate);
      }

      // Duration word detection — overrides date extraction when explicit duration is mentioned
      const durationPatterns: [RegExp, number][] = [
        [/\b(one year|1 year|yearly|a year|365 days)\b/i, 365],
        [/\b(half year|6 months|six months|180 days)\b/i, 180],
        [/\b(3 months|three months|90 days|quarter)\b/i, 90],
        [/\b(2 months|two months|60 days)\b/i, 60],
        [/\b(one month|1 month|a month|monthly|30 days)\b/i, 30],
        [/\b(3 weeks|three weeks|21 days)\b/i, 21],
        [/\b(2 weeks|two weeks|fortnight|14 days)\b/i, 14],
        [/\b(one week|1 week|a week|weekly|7 days)\b/i, 7],
      ];

      for (const [pattern, days] of durationPatterns) {
        if (pattern.test(lowerForDate)) {
          endDate = new Date(todayDate.getTime() + (days - 1) * 86400000).toISOString().split("T")[0];
          startDate = todayDate.toISOString().split("T")[0];
          console.log("[api/voice] Duration word matched — days:", days, "| endDate:", endDate);
          break;
        }
      }
      console.log("[api/voice] Final date range:", startDate, "to", endDate);

      // Compute exact day count
      const dayCount = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
      console.log("[api/voice] Day count:", dayCount, "from", startDate, "to", endDate);

      // Task interval scaling — prevents excessive tasks for long plans
      let taskInterval = 1;
      if (dayCount <= 14) taskInterval = 1;
      else if (dayCount <= 30) taskInterval = 2;
      else if (dayCount <= 90) taskInterval = 3;
      else if (dayCount <= 180) taskInterval = 5;
      else taskInterval = 7;
      const expectedTaskCount = Math.ceil(dayCount / taskInterval);
      console.log("[api/voice] taskInterval:", taskInterval, "| expectedTaskCount:", expectedTaskCount);

      const planSystemPrompt = `You are a task generator.

Today is ${today}.
Start date: ${startDate}
End date: ${endDate}
Total days: ${dayCount}
Task interval: every ${taskInterval} day${taskInterval > 1 ? "s" : ""}
Expected task count: ${expectedTaskCount}

Generate exactly ${expectedTaskCount} tasks spaced ${taskInterval} day${taskInterval > 1 ? "s" : ""} apart starting from ${startDate}.

Return exactly this JSON structure:
{"action":"create_plan","response":"Plan created with ${expectedTaskCount} tasks","tasks":[{"title":"Task name","date":"YYYY-MM-DD","time":"HH:MM","calendarId":"cal_work|cal_personal|cal_study|cal_all","notes":"structured notes following the NOTES FORMAT below","startAction":"one specific concrete action under 20 words, starting with a verb","resources":[{"label":"Site — exact page title","url":"https://exact/url"}]}]}

CALENDARID — include a "calendarId" on every task. Work related tasks (meetings, calls, projects, deadlines, client work) use cal_work. Personal tasks (gym, health, hobbies, family, errands) use cal_personal. Study/school tasks (assignments, studying, courses, homework) use cal_study. If completely unclear use cal_all.

NOTES FORMAT — every task's notes field must follow this exact structure:
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

Rules:
- Generate exactly ${expectedTaskCount} tasks
- First task on ${startDate}, last task on or before ${endDate}
- Space tasks exactly ${taskInterval} day${taskInterval > 1 ? "s" : ""} apart
- Make each task different and progressive — build skills/knowledge over time
- Vary the times between 07:00 and 20:00
- Keep each title under 7 words and make it specific`;

      // A response that is schema-valid but empty, or whose own summary promises a
      // different number of sessions than it returned, is treated as a failure and
      // retried once — never reported to the user as a successful plan.
      let planJson: Record<string, unknown> | null = null;
      let rawTasks: unknown[] = [];
      for (let attempt = 1; attempt <= 2 && rawTasks.length === 0; attempt++) {
        const planResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            temperature: 0,
            system: planSystemPrompt,
            output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
            messages: [{
              role: "user",
              content: `Create a plan from ${startDate} to ${endDate} (${dayCount} days, ${expectedTaskCount} tasks, one task every ${taskInterval} day${taskInterval > 1 ? "s" : ""}). Request: ${withContext(text)}`,
            }],
          }),
        });
        if (!planResponse.ok) {
          console.error("[api/voice] Plan API call failed:", planResponse.status, "(attempt", attempt, ")");
          continue;
        }
        try {
          planJson = extractStructuredJson<Record<string, unknown>>(await planResponse.json());
        } catch (e) {
          console.error("[api/voice] Plan response parsing failed:", e instanceof Error ? e.message : e);
          continue;
        }
        const candidate = Array.isArray(planJson.tasks) ? planJson.tasks : [];
        const claimed = claimedSessionCount(planJson.response);
        if (candidate.length === 0 || (claimed !== null && claimed !== candidate.length)) {
          console.error("[api/voice] Plan response invalid — tasks:", candidate.length, "| claimed:", claimed, "| attempt", attempt);
          continue;
        }
        rawTasks = candidate;
      }

      {
        if (planJson) {
          const cmd = planJson;
          if (rawTasks.length > 0) {
            const taskIds: string[] = [];
            let skippedDuplicates = 0;
            const planKind = inferPlanKind(text);
            for (const rt of rawTasks) {
              if (!rt || typeof rt !== "object") continue;
              const t = rt as Record<string, unknown>;
              const taskTitle = typeof t.title === "string" ? t.title.trim() : "";
              if (!taskTitle) continue;
              const taskDate = typeof t.date === "string" ? t.date : today;
              const taskTime = typeof t.time === "string" ? t.time : "09:00";
              const taskNotes = typeof t.notes === "string" ? t.notes.trim() : undefined;
              const taskStartAction = typeof t.startAction === "string" ? t.startAction.trim() : undefined;
              const taskResources = Array.isArray(t.resources)
                ? (t.resources as unknown[]).filter(
                    (r): r is { label: string; url: string } =>
                      !!r && typeof r === "object" && typeof (r as Record<string, unknown>).label === "string" && typeof (r as Record<string, unknown>).url === "string"
                  )
                : undefined;
              const taskCalendarId = resolveCalendarId(typeof t.calendarId === "string" ? t.calendarId : undefined);
              const task = addTask({
                title: taskTitle,
                date: taskDate,
                time: taskTime,
                kind: planKind,
                completed: false,
                calendarId: taskCalendarId,
                notes: taskNotes || undefined,
                startAction: taskStartAction || undefined,
                resources: taskResources && taskResources.length > 0 ? taskResources : undefined,
              });
              // Duplicates return a pre-existing task's id — excluded so undo never
              // deletes a task the plan didn't actually create.
              if (task.wasDuplicate) {
                skippedDuplicates++;
                continue;
              }
              taskIds.push(task.id);
              console.log("[api/voice] Plan task added:", task.title, "on", task.date);
            }

            const planTitle = typeof cmd.title === "string" ? cmd.title : "New Plan";
            const plan = addPlan({ title: planTitle, description: "", taskIds, taskCount: taskIds.length });
            for (const id of taskIds) {
              updateTask(id, { planId: plan.id });
            }
            const record = recordAction("create_plan", `Created plan "${plan.title}" with ${taskIds.length} tasks`, {
              addedTaskIds: taskIds,
              addedPlanId: plan.id,
            });

            const dupSuffix = skippedDuplicates > 0 ? ` Skipped ${skippedDuplicates} duplicate${skippedDuplicates > 1 ? "s" : ""}.` : "";
            addVoiceLog({ text, response: `Plan created with ${taskIds.length} tasks`, action: "create_plan", ok: true });
            return NextResponse.json({
              ok: true,
              action: "create_plan",
              count: taskIds.length,
              response: `Your plan has been created with ${taskIds.length} tasks added to your calendar!${dupSuffix}`,
              plan: { id: plan.id, title: plan.title, taskCount: taskIds.length, color: plan.color },
              actionId: record.id,
              state: getAppState(),
            });
          }
        }
      }

      // Fallback: add as a single generic task if plan generation failed
      console.log("[api/voice] Plan generation failed — adding as single task");
      const fallbackTask = addTask({
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
        addVoiceLog({ text, response: dupResponse, action: "add_task", ok: true });
        return NextResponse.json({ ok: true, action: "add_task", task: fallbackTask, response: dupResponse, state: getAppState() });
      }
      const fallbackRecord = recordAction("add_task", `Added "${fallbackTask.title}"`, { addedTaskIds: [fallbackTask.id] });
      addVoiceLog({ text, response: "Added as single task", action: "add_task", ok: true });
      return NextResponse.json({
        ok: true,
        action: "add_task",
        actionId: fallbackRecord.id,
        task: fallbackTask,
        response: "I added this to your tasks. For detailed plans try being more specific.",
        state: getAppState(),
      });
    }

    // ── Standard single-task / recurring path ─────────────────────────────────
    console.log("[api/voice] Calling Anthropic API...");
    const userContext = getContextAsString();
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        temperature: 0,
        system: voiceSystemPrompt(userContext),
        output_config: { format: { type: "json_schema", schema: VOICE_COMMAND_SCHEMA } },
        messages: [
          { role: "user", content: withContext(text) },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text();
      console.error("[api/voice] Anthropic error:", anthropicResponse.status, err);

      if (anthropicResponse.status === 429) {
        console.log("[api/voice] Rate limited — waiting 2 seconds and retrying with simpler request");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const retryResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            temperature: 0,
            system: `Extract a short task title from the user's message and respond with an add_task command. Today is ${today}.`,
            output_config: { format: { type: "json_schema", schema: VOICE_COMMAND_SCHEMA } },
            messages: [{ role: "user", content: text.substring(0, 100) }],
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          let retryJson: Record<string, unknown> | null = null;
          try {
            retryJson = extractStructuredJson<Record<string, unknown>>(retryData);
          } catch (e) {
            console.error("[api/voice] Retry response parsing failed:", e instanceof Error ? e.message : e);
          }
          if (retryJson) {
            const cmd = retryJson;
            if (cmd.action === "add_task" && typeof cmd.title === "string" && cmd.title) {
              const retryDate = typeof cmd.date === "string" ? cmd.date : today;
              const retryTime = typeof cmd.time === "string" ? cmd.time : "09:00";
              const task = addTask({
                title: cmd.title,
                date: retryDate,
                time: retryTime,
                completed: false,
                calendarId: null,
                notes: "Added after retry: " + text.substring(0, 100),
              });
              if (task.wasDuplicate) {
                const dupResponse = `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).`;
                addVoiceLog({ text, response: dupResponse, action: "add_task", ok: true });
                return NextResponse.json({ ok: true, action: "add_task", task, response: dupResponse, state: getAppState() });
              }
              const retryRecord = recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
              addVoiceLog({ text, response: "Task added after retry", action: "add_task", ok: true });
              return NextResponse.json({
                ok: true,
                action: "add_task",
                task,
                response: (cmd.response as string) || "Task added!",
                actionId: retryRecord.id,
                state: getAppState(),
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

      addVoiceLog({ text, response: `Anthropic error ${anthropicResponse.status}`, action: "error", ok: false });
      return NextResponse.json({ ok: false, error: `Anthropic error: ${anthropicResponse.status} ${err}` }, { status: 502 });
    }

    const anthropicData = await anthropicResponse.json();

    let parsed: Record<string, unknown>;
    try {
      parsed = extractStructuredJson<Record<string, unknown>>(anthropicData);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not understand that command.";
      console.error("[api/voice] Structured response parsing failed:", message);
      addVoiceLog({ text, response: message, action: "error", ok: false });
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
        addVoiceLog({ text, response: "No title provided", action, ok: false });
        return NextResponse.json({ ok: false, error: "No title in AI response" }, { status: 422 });
      }

      const rawFreq = cmd.frequency as string | undefined;
      const freq = rawFreq === "daily" || rawFreq === "weekly" || rawFreq === "monthly" || rawFreq === "yearly"
        ? rawFreq : "weekly";
      const startDate = (cmd.startDate as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const rawEndDate = cmd.endDate as string | null | undefined;
      const endDate = typeof rawEndDate === "string" ? rawEndDate : undefined;
      const rawDow = cmd.daysOfWeek;
      const daysOfWeek = Array.isArray(rawDow) ? (rawDow as number[]) : undefined;

      console.log("[api/voice] add_recurring_task — freq:", freq, "| start:", startDate, "| end:", endDate, "| daysOfWeek:", daysOfWeek);

      const recurringTasks = addRecurringTask(
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

      const record = recordAction("add_recurring_task", `Added ${recurringTasks.length} recurring "${title}" instances`, {
        addedTaskIds: recurringTasks.map((t) => t.id),
      });

      const confirmMsg = `${response} (${recurringTasks.length} instances created)`;
      addVoiceLog({ text, response: confirmMsg, action, ok: true });
      console.log("[api/voice] add_recurring_task success — instances:", recurringTasks.length);

      return NextResponse.json({
        ok: true,
        action,
        count: recurringTasks.length,
        response: `${response} Created ${recurringTasks.length} instances.`,
        actionId: record.id,
        state: getAppState(),
      });
    }

    // ── Plan ──────────────────────────────────────────────────────────────────
    // VOICE_COMMAND_SCHEMA cannot carry a tasks array, so the model can only signal
    // plan intent here. Hand off to the dedicated plan generator (PLAN_SCHEMA) instead
    // of creating a plan with no tasks.
    if (action === "create_plan") {
      console.log("[api/voice] create_plan from standard path — delegating to plan generator");
      return handleVoiceText(text, { forcePlan: true, context: opts.context });
    }

    // ── Clear all tasks ────────────────────────────────────────────────────────
    if (action === "delete_all_tasks") {
      console.log("[api/voice] delete_all_tasks — requesting confirmation");
      return requestClearConfirmation(text);
    }

    // ── Get calendars ──────────────────────────────────────────────────────────
    if (action === "get_calendars") {
      const calendars = getCalendars();
      const msg = `You have ${calendars.length} calendars: ${calendars.map((c) => c.name).join(", ")}`;
      addVoiceLog({ text, response: msg, action, ok: true });
      console.log("[api/voice] get_calendars success — count:", calendars.length);
      return NextResponse.json({
        ok: true,
        action: "get_calendars",
        calendars,
        response: msg,
        state: getAppState(),
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
        addVoiceLog({ text, response: "No target calendar specified", action, ok: false });
        return NextResponse.json({ ok: false, error: "No target calendar specified" }, { status: 422 });
      }

      const calendars = getCalendars();
      const targetCalendar = calendars.find(
        (c) => c.id === targetCalendarId || c.name.toLowerCase() === targetCalendarId.toLowerCase()
      );

      if (!targetCalendar) {
        const err = `Calendar "${targetCalendarId}" not found. Available: ${calendars.map((c) => c.name).join(", ")}`;
        addVoiceLog({ text, response: err, action, ok: false });
        return NextResponse.json({ ok: false, error: err }, { status: 422 });
      }

      const matching = getTasksMatchingFilter(filter);
      if (matching.length === 0) {
        const msg = "No matching tasks to move.";
        addVoiceLog({ text, response: msg, action, ok: true });
        return NextResponse.json({ ok: true, action: "move_tasks", moved: 0, response: msg, state: getAppState() });
      }

      // Any move that changes existing tasks' calendars requires explicit confirmation,
      // regardless of how many tasks match — moving is a change to something that already
      // exists on the calendar, not new content, so it's held to the same bar as delete/reschedule.
      const pending = addPendingConfirmation(
        "move_tasks",
        `Move ${matching.length} task${matching.length !== 1 ? "s" : ""} to your ${targetCalendar.name} calendar?`,
        { filter, targetCalendarId: targetCalendar.id, targetCalendarName: targetCalendar.name }
      );
      addVoiceLog({ text, response: "Awaiting confirmation to move tasks", action: "confirm_required", ok: true });
      return NextResponse.json({
        ok: true,
        action: "confirm_required",
        pending: { id: pending.id, kind: pending.kind, message: pending.message },
        response: pending.message,
      });
    }

    // ── Single task ────────────────────────────────────────────────────────────
    const date = (cmd.date as string | undefined) ?? new Date().toISOString().slice(0, 10);

    if (action === "add_task") {
      if (!title.trim()) {
        addVoiceLog({ text, response: "No title provided", action, ok: false });
        return NextResponse.json({ ok: false, error: "No title in AI response" }, { status: 422 });
      }
      const displayTitle = time && time !== "09:00" ? `${title} (${time})` : title;
      const notes = (cmd.notes as string | undefined)?.trim() || undefined;
      const startAction = (cmd.startAction as string | undefined)?.trim() || undefined;
      const rawResources = Array.isArray(cmd.resources)
        ? (cmd.resources as unknown[]).filter(
            (r): r is { label: string; url: string } =>
              !!r && typeof r === "object" && typeof (r as Record<string, unknown>).label === "string" && typeof (r as Record<string, unknown>).url === "string"
          )
        : undefined;
      const resources = rawResources && rawResources.length > 0 ? rawResources : undefined;
      const calendarId = resolveCalendarId(typeof cmd.calendarId === "string" ? cmd.calendarId : undefined);
      const task = addTask({ title: displayTitle, date, time, completed: false, calendarId, notes, startAction, resources });
      if (task.wasDuplicate) {
        const dupResponse = `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).`;
        console.log("[api/voice] add_task skipped duplicate:", task.id, task.title);
        addVoiceLog({ text, response: dupResponse, action, ok: true });
        return NextResponse.json({ ok: true, action, task, response: dupResponse, state: getAppState() });
      }
      const addRecord = recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
      console.log("[api/voice] add_task success:", task.id, task.title);
      addVoiceLog({ text, response, action, ok: true });
      return NextResponse.json({ ok: true, action, task, response, actionId: addRecord.id, state: getAppState() });
    }

    if (action === "complete_task") {
      const found = findTaskByTitle(title);
      if (!found) {
        addVoiceLog({ text, response: `Task not found: ${title}`, action, ok: false });
        return NextResponse.json({ ok: false, error: `Task not found: ${title}` }, { status: 404 });
      }
      const task = completeTask(found.id);
      const completeRecord = recordAction("complete_task", `Completed "${found.title}"`, { completedTaskId: found.id });
      console.log("[api/voice] complete_task success:", found.id);
      addVoiceLog({ text, response, action, ok: true });
      return NextResponse.json({ ok: true, action, task, response, actionId: completeRecord.id, state: getAppState() });
    }

    if (action === "delete_task") {
      const found = findTaskByTitle(title);
      if (!found) {
        addVoiceLog({ text, response: `Task not found: ${title}`, action, ok: false });
        return NextResponse.json({ ok: false, error: `Task not found: ${title}` }, { status: 404 });
      }
      // Deleting a task that already exists on the calendar is a destructive change to
      // existing content, not new creation — always confirm before it happens.
      const pending = addPendingConfirmation(
        "delete_task",
        `Delete "${found.title}" from your schedule?`,
        { taskId: found.id, title: found.title }
      );
      addVoiceLog({ text, response: "Awaiting confirmation to delete task", action: "confirm_required", ok: true });
      return NextResponse.json({
        ok: true,
        action: "confirm_required",
        pending: { id: pending.id, kind: pending.kind, message: pending.message },
        response: pending.message,
      });
    }

    console.log("[api/voice] Unknown action from AI:", action);
    addVoiceLog({ text, response: `Unknown action: ${action}`, action: action ?? "unknown", ok: false });
    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 422 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/voice] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
