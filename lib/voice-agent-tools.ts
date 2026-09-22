// lib/voice-agent-tools.ts
//
// A genuine multi-turn Anthropic tool-use loop, additive to the existing
// single-shot JSON voice pipeline in app/api/voice/route.ts. It is only
// invoked for commands that look like they need Gmail or Canvas data
// (see needsAgentTools below). It reuses the existing store functions
// (addTask / addPlan / updateTask) for the "act" side so behavior matches
// the create_plan / add_task cases already in app/api/voice/route.ts.
import { addTask, addPlan, updateTask, getCalendars, getTasksMatchingFilter, getContextAsString, recordAction, getAllTasks, getTasksByDate, addPendingConfirmation } from "@/lib/store";
import type { Task, TaskKind } from "@/lib/types";
import { getRecentEmails, getEmailById } from "@/lib/gmail";
import {
  getUpcomingAssignments,
  getCourseFiles,
  getFileTextContent,
} from "@/lib/canvas";
import { getUpcomingEvents, getEventsForDate } from "@/lib/calendar";

const MODEL = "claude-sonnet-4-5";
const MAX_TOOL_TURNS = 8;
const GMAIL_KEYWORDS = /\b(email|emails|gmail|inbox|unread|message|messages)\b/i;
const CANVAS_KEYWORDS = /\b(canvas|assignment|assignments|course|due|homework|class|syllabus|professor)\b/i;
const CALENDAR_KEYWORDS = /\b(calendar|event|events|schedule|meeting|appointment|what do i have|what's on my)\b/i;

/** Commands that plausibly need real Gmail/Canvas/Calendar data get routed through the tool loop. */
export function needsAgentTools(text: string): boolean {
  const gmailMatch = GMAIL_KEYWORDS.exec(text)?.[0];
  const canvasMatch = CANVAS_KEYWORDS.exec(text)?.[0];
  const calendarMatch = CALENDAR_KEYWORDS.exec(text)?.[0];

  const group = gmailMatch ? "gmail" : canvasMatch ? "canvas" : calendarMatch ? "calendar" : null;
  const keyword = gmailMatch ?? canvasMatch ?? calendarMatch;

  if (group) {
    console.log(
      `[voice-agent-tools] needsAgentTools matched "${keyword}" (${group} keyword) — routing to agent tool loop`
    );
  }

  return group !== null;
}

const TOOLS = [
  {
    name: "get_recent_emails",
    description:
      "Read recent emails from the user's Gmail inbox including sender, subject, date, and content",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        max_results: { type: "number", description: "How many recent emails to fetch, default 10" },
        query: {
          type: "string",
          description: "Optional Gmail search query like 'is:unread' or 'from:professor'",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_canvas_assignments",
    description: "Read upcoming Canvas assignments with due dates across all courses",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look, default 14" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_canvas_course_files",
    description: "List files available in a specific Canvas course",
    strict: true,
    input_schema: {
      type: "object",
      properties: { course_id: { type: "string" } },
      required: ["course_id"],
      additionalProperties: false,
    },
  },
  {
    name: "read_canvas_file",
    description: "Download and read the text content of a specific Canvas file such as a PDF or Word document",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        file_url: { type: "string" },
        file_name: { type: "string" },
      },
      required: ["file_url", "file_name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_my_tasks",
    description:
      "Read the user's own TANGENT tasks (their internal schedule/to-do list) — always available, does not depend on Google Calendar being connected. Use this for questions about what the user has on their schedule/plate unless they specifically ask about their Google Calendar.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Optional single date YYYY-MM-DD to filter to. Omit to get all tasks." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_upcoming_events",
    description: "Read upcoming events from the user's connected Google Calendar (a separate, optional integration from their TANGENT tasks — prefer get_my_tasks unless the user specifically asks about Google Calendar).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look, default 7" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_events_for_date",
    description: "Get all events for a specific date from the user's connected Google Calendar (prefer get_my_tasks for the user's own TANGENT tasks unless they specifically ask about Google Calendar).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_calendars",
    description: "Get the list of all calendars the user has with their ids and names",
    strict: true,
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "move_tasks",
    description: "Move tasks matching a description or date range to a different calendar",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        targetCalendarId: {
          type: "string",
          description: "The id of the calendar to move tasks to, e.g. cal_work, cal_personal",
        },
        filter: {
          type: "object",
          description: "Filter to match which tasks to move",
          properties: {
            title: { type: "string", description: "Keyword to match in task titles" },
            dateRange: {
              type: "object",
              properties: {
                start: { type: "string", description: "Start date YYYY-MM-DD" },
                end: { type: "string", description: "End date YYYY-MM-DD" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      required: ["targetCalendarId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_task",
    description: "Add a single task to the user's calendar",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24-hour, default 09:00" },
        calendarId: { type: "string", description: "The calendar id to file this task under, e.g. cal_work, cal_personal, cal_study, cal_all" },
        notes: { type: "string" },
        startAction: { type: "string", description: "One specific concrete action under 20 words, starting with a verb" },
        resources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
            required: ["label", "url"],
            additionalProperties: false,
          },
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "create_plan",
    description: "Create a multi-task plan (e.g. a study plan) spread across several days on the calendar",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              time: { type: "string", description: "HH:MM 24-hour" },
              calendarId: { type: "string", description: "The calendar id to file this task under, e.g. cal_work, cal_personal, cal_study, cal_all" },
              notes: { type: "string" },
              startAction: { type: "string", description: "One specific concrete action under 20 words, starting with a verb" },
              resources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["label", "url"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "date"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "tasks"],
      additionalProperties: false,
    },
  },
];

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[] | { type: "tool_result"; tool_use_id: string; content: string }[];
};

const SIDE_EC_KEYWORDS = /\b(sport|sports|soccer|basketball|football|baseball|tennis|swim|swimming|track|volleyball|hockey|golf|wrestling|gym|workout|fitness|hobby|hobbies|art|drawing|painting|music|guitar|piano|photograph(?:y)?|cooking|baking|gaming|dance|dancing|yoga|climbing|skiing|surfing|hiking)\b/i;

/** Keyword-based (non-AI) kind default for AI-generated plans — academic-ec unless
 *  the topic clearly matches a side-EC pattern (sports, hobby keywords). */
function inferPlanKind(topic: string): TaskKind {
  return SIDE_EC_KEYWORDS.test(topic) ? "side-ec" : "academic-ec";
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

function resolveCalendarId(input: string | undefined): string {
  if (!input) return "cal_all";
  const calendars = getCalendars();
  const exactMatch = calendars.find((c) => c.id === input);
  if (exactMatch) return exactMatch.id;
  const nameMatch = calendars.find(
    (c) =>
      c.name.toLowerCase() === input.toLowerCase() ||
      c.name.toLowerCase().includes(input.toLowerCase()) ||
      input.toLowerCase().includes(c.name.toLowerCase())
  );
  if (nameMatch) return nameMatch.id;
  const lower = input.toLowerCase();
  if (lower.includes("work") || lower.includes("professional") || lower.includes("business")) {
    const workCal = calendars.find((c) => c.name.toLowerCase().includes("work"));
    if (workCal) return workCal.id;
  }
  if (lower.includes("personal") || lower.includes("private") || lower.includes("life")) {
    const personalCal = calendars.find((c) => c.name.toLowerCase().includes("personal"));
    if (personalCal) return personalCal.id;
  }
  if (lower.includes("study") || lower.includes("school") || lower.includes("learn")) {
    const studyCal = calendars.find((c) => c.name.toLowerCase().includes("study"));
    if (studyCal) return studyCal.id;
  }
  return inferCalendarId(input, "");
}

/** Distinguishes "Google Calendar isn't configured on this server" (a missing-credential
 *  setup problem the developer needs to fix, not a transient failure) from any other
 *  error, so the system prompt can tell the model to explain it plainly instead of
 *  vaguely saying it "can't connect". */
function googleCalendarErrorPayload(e: unknown): { error: string; detail: string } {
  const message = e instanceof Error ? e.message : "Google Calendar request failed";
  if (message.startsWith("Missing GOOGLE_")) {
    return {
      error: "google_calendar_not_connected",
      detail: "Google Calendar is not connected on this server (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN). This is a one-time setup step the developer needs to complete — it is not the user's fault and not something they can fix by asking again.",
    };
  }
  return { error: "google_calendar_error", detail: message };
}

function summarize(payload: unknown): string {
  const json = JSON.stringify(payload);
  return json.length > 200 ? json.slice(0, 200) + "…" : json;
}

type ToolExecResult = {
  data: unknown;
  action?: string;
  task?: Task;
  plan?: { id: string; title: string; taskCount: number; color: string };
  count?: number;
  actionId?: string;
  pending?: { id: string; kind: string; message: string };
};

async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolExecResult> {
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case "get_calendars": {
      const calendars = getCalendars();
      return { data: { calendars } };
    }

    case "move_tasks": {
      const targetCalendarId = typeof input.targetCalendarId === "string" ? input.targetCalendarId : "";
      if (!targetCalendarId) return { data: { error: "Missing targetCalendarId" } };
      const calendars = getCalendars();
      const targetCalendar = calendars.find(
        (c) => c.id === targetCalendarId || c.name.toLowerCase() === targetCalendarId.toLowerCase()
      );
      if (!targetCalendar) {
        return { data: { error: `Calendar "${targetCalendarId}" not found. Available: ${calendars.map((c) => c.name).join(", ")}` } };
      }
      const rawFilter = (input.filter as Record<string, unknown> | undefined) ?? {};
      const filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } } = {};
      if (typeof rawFilter.title === "string") filter.title = rawFilter.title;
      if (typeof rawFilter.calendarId === "string") filter.calendarId = rawFilter.calendarId;
      const rawDateRange = rawFilter.dateRange as Record<string, unknown> | undefined;
      if (rawDateRange && typeof rawDateRange.start === "string" && typeof rawDateRange.end === "string") {
        filter.dateRange = { start: rawDateRange.start, end: rawDateRange.end };
      }

      const matching = getTasksMatchingFilter(filter);
      if (matching.length === 0) {
        return { data: { ok: true, moved: 0, targetCalendar: targetCalendar.name } };
      }

      // Moving tasks that already exist on the calendar is a change to existing content,
      // not new creation — always confirm before it happens, regardless of count. See the
      // matching gate in lib/voice-handler.ts's move_tasks handling for the same rule.
      const pending = addPendingConfirmation(
        "move_tasks",
        `Move ${matching.length} task${matching.length !== 1 ? "s" : ""} to your ${targetCalendar.name} calendar?`,
        { filter, targetCalendarId: targetCalendar.id, targetCalendarName: targetCalendar.name }
      );
      return {
        data: { confirmRequired: true, message: pending.message },
        pending: { id: pending.id, kind: pending.kind, message: pending.message },
      };
    }

    case "get_recent_emails": {
      const maxResults = typeof input.max_results === "number" ? input.max_results : 10;
      const query = typeof input.query === "string" ? input.query : undefined;
      const emails = await getRecentEmails(maxResults, query);
      // Cap body length per email so the tool result stays small.
      const trimmed = emails.map((e) => ({ ...e, body: e.body.slice(0, 1500) }));
      return { data: { emails: trimmed } };
    }

    case "get_canvas_assignments": {
      const daysAhead = typeof input.days_ahead === "number" ? input.days_ahead : 14;
      const assignments = await getUpcomingAssignments(daysAhead);
      return { data: { assignments } };
    }

    case "get_canvas_course_files": {
      const courseId = String(input.course_id ?? "");
      if (!courseId) return { data: { error: "Missing course_id" } };
      const files = await getCourseFiles(courseId);
      return { data: { files } };
    }

    case "read_canvas_file": {
      const fileUrl = String(input.file_url ?? "");
      const fileName = String(input.file_name ?? "");
      if (!fileUrl || !fileName) return { data: { error: "Missing file_url or file_name" } };
      const text = await getFileTextContent(fileUrl, fileName);
      if (text === null) return { data: { supported: false, text: null } };
      return { data: { supported: true, text: text.slice(0, 8000) } };
    }

    case "get_my_tasks": {
      const date = typeof input.date === "string" ? input.date : undefined;
      const tasks = date ? getTasksByDate(date) : getAllTasks();
      return { data: { tasks } };
    }

    case "get_upcoming_events": {
      const daysAhead = typeof input.days_ahead === "number" ? input.days_ahead : 7;
      try {
        const events = await getUpcomingEvents(daysAhead);
        return { data: { events } };
      } catch (e) {
        return { data: googleCalendarErrorPayload(e) };
      }
    }

    case "get_events_for_date": {
      const date = typeof input.date === "string" ? input.date : "";
      if (!date) return { data: { error: "Missing date" } };
      try {
        const events = await getEventsForDate(date);
        return { data: { events } };
      } catch (e) {
        return { data: googleCalendarErrorPayload(e) };
      }
    }

    case "add_task": {
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title) return { data: { error: "Missing title" } };
      const date = typeof input.date === "string" && input.date ? input.date : today;
      const time = typeof input.time === "string" && input.time ? input.time : "09:00";
      const displayTitle = time !== "09:00" ? `${title} (${time})` : title;
      const notes = typeof input.notes === "string" ? input.notes.trim() || undefined : undefined;
      const startAction = typeof input.startAction === "string" ? input.startAction.trim() || undefined : undefined;
      const rawResources = Array.isArray(input.resources)
        ? (input.resources as unknown[]).filter(
            (r): r is { label: string; url: string } =>
              !!r && typeof r === "object" && typeof (r as Record<string, unknown>).label === "string" && typeof (r as Record<string, unknown>).url === "string"
          )
        : undefined;
      const resources = rawResources && rawResources.length > 0 ? rawResources : undefined;
      const calendarId = resolveCalendarId(typeof input.calendarId === "string" ? input.calendarId : undefined);
      const task = addTask({ title: displayTitle, date, time, completed: false, calendarId, notes, startAction, resources });
      if (task.wasDuplicate) {
        return { data: { ok: true, task, skipped: true, message: `Skipped 1 duplicate (already have "${task.title}" around ${task.time}).` }, action: "add_task", task };
      }
      const record = recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
      return { data: { ok: true, task }, action: "add_task", task, actionId: record.id };
    }

    case "create_plan": {
      const planTitle = typeof input.title === "string" && input.title ? input.title : "New Plan";
      const rawTasks = Array.isArray(input.tasks) ? (input.tasks as Record<string, unknown>[]) : [];
      const taskIds: string[] = [];
      let skippedDuplicates = 0;
      const planKind = inferPlanKind(planTitle);
      for (const rt of rawTasks) {
        const taskTitle = typeof rt.title === "string" ? rt.title.trim() : "";
        if (!taskTitle) continue;
        const taskDate = typeof rt.date === "string" ? rt.date : today;
        const taskTime = typeof rt.time === "string" ? rt.time : "09:00";
        const taskStartAction = typeof rt.startAction === "string" ? rt.startAction.trim() || undefined : undefined;
        const rawTaskResources = Array.isArray(rt.resources)
          ? (rt.resources as unknown[]).filter(
              (r): r is { label: string; url: string } =>
                !!r && typeof r === "object" && typeof (r as Record<string, unknown>).label === "string" && typeof (r as Record<string, unknown>).url === "string"
            )
          : undefined;
        const taskResources = rawTaskResources && rawTaskResources.length > 0 ? rawTaskResources : undefined;
        const taskCalendarId = resolveCalendarId(typeof rt.calendarId === "string" ? rt.calendarId : undefined);
        const task = addTask({
          title: taskTitle,
          date: taskDate,
          time: taskTime,
          kind: planKind,
          completed: false,
          calendarId: taskCalendarId,
          notes: typeof rt.notes === "string" ? rt.notes : "",
          startAction: taskStartAction,
          resources: taskResources,
        });
        // Duplicates return a pre-existing task's id — excluded so undo never
        // deletes a task the plan didn't actually create.
        if (task.wasDuplicate) {
          skippedDuplicates++;
          continue;
        }
        taskIds.push(task.id);
      }
      const plan = addPlan({ title: planTitle, description: "", taskIds, taskCount: taskIds.length });
      for (const id of taskIds) updateTask(id, { planId: plan.id });
      const record = recordAction("create_plan", `Created plan "${plan.title}" with ${taskIds.length} tasks`, {
        addedTaskIds: taskIds,
        addedPlanId: plan.id,
      });
      return {
        data: { ok: true, plan, taskCount: taskIds.length, skippedDuplicates },
        action: "create_plan",
        plan: { id: plan.id, title: plan.title, taskCount: taskIds.length, color: plan.color },
        count: taskIds.length,
        actionId: record.id,
      };
    }

    default:
      return { data: { error: `Unknown tool: ${name}` } };
  }
}

function systemPrompt(today: string, userContext?: string): string {
  const calendars = getCalendars();
  const calendarList = calendars.map((c) => `${c.id} (${c.name})`).join(", ");

  return `You are TANGENT's voice assistant. Today is ${today}.

The user gave a voice command that may require reading their Gmail or Canvas data before you can respond or act.
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
Current calendars: ${calendarList}
Always assign tasks to the correct calendar based on content.
Work tasks → cal_work
Personal tasks → cal_personal
Study tasks → cal_study (if exists) or cal_personal
When user names a specific calendar always use that calendar's id exactly.
Include calendarId in every add_task and create_plan tool call.
For move_tasks operations match tasks by title keywords or date range.
Call get_calendars if you need to confirm what calendars exist before assigning a task.

Rules:
- Use get_recent_emails / get_canvas_assignments / get_canvas_course_files / read_canvas_file to gather whatever real data you need BEFORE answering. Never guess or invent emails, assignments, or due dates.
- TANGENT has TWO separate, unrelated notions of "calendar": (1) the user's own TANGENT tasks — always available, read with get_my_tasks — and (2) an optional read-only Google Calendar integration — read with get_upcoming_events / get_events_for_date. For "what's on my schedule", "what do I have today/this week", or similar questions about the user's own plate, call get_my_tasks. Only call get_upcoming_events / get_events_for_date when the user specifically asks about their Google Calendar, or after get_my_tasks turns up nothing relevant and you want to check if it's on Google Calendar instead.
- If get_upcoming_events or get_events_for_date returns {"error":"google_calendar_not_connected", ...}, do NOT say something vague like "I can't connect to your calendar right now" or imply it's a temporary glitch. Say plainly that Google Calendar isn't connected/set up yet, and offer to check their TANGENT tasks instead (via get_my_tasks) if relevant.
- If the user wants something added to their calendar (a single task, or a multi-day plan built around real due dates), call add_task or create_plan with the real data you gathered.
- If the user is just asking a question (e.g. "summarize my unread emails"), do not call add_task or create_plan — just answer in plain text using the data you fetched.
- Your final reply (once you are done calling tools) must be plain natural language only — no JSON, no markdown, no code fences. Keep it under 60 words unless the user asked for a detailed summary.

NOTES FORMAT — whenever you call add_task or create_plan, each task's "notes" field must follow this exact structure:
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
Pass task resources as the separate "resources" array field on add_task / create_plan tasks — never embed URLs in notes.
Each resource must be an object with these exact fields: {"label": "Khan Academy — Derivatives Introduction", "url": "https://www.khanacademy.org/exact/path/here"}
Never include a site if you are not certain the specific page exists and is relevant.

STARTACTION — generate a "startAction" field for every task alongside title, date, time, notes, and resources.
The startAction must be one specific concrete thing the user can do in the first 2 minutes to begin this task.
It must reference something real — a specific resource linked in the resources array, a specific page number, a specific action, or a specific tool to open.
It must be under 20 words.
It must start with a verb — Watch, Read, Open, Write, Complete, Solve, Review, Draft.
Never say "Start by" or "Begin with" — just give the direct action.`;
}

export type ToolLoopResult = {
  response: string;
  action: string;
  task?: Task;
  plan?: { id: string; title: string; taskCount: number; color: string };
  count?: number;
  actionId?: string;
  /** Friendly labels (e.g. "Gmail", "Canvas") for which real data sources this
   *  turn actually read, so the UI can show that the agent path fired. */
  sourcesChecked?: string[];
  /** Set when a tool call in the loop hit a confirm-gated action (e.g. move_tasks)
   *  — the loop stops immediately and the caller must surface a confirm/cancel prompt
   *  rather than letting the LLM take further turns on top of an unresolved change. */
  pending?: { id: string; kind: string; message: string };
};

/** Maps a data-read tool name to the friendly source label shown in the UI.
 *  Action tools (add_task, create_plan, move_tasks, get_calendars) are
 *  excluded — this is only for "we went and read your real data" moments. */
function sourceLabelForTool(name: string): string | null {
  switch (name) {
    case "get_recent_emails":
      return "Gmail";
    case "get_canvas_assignments":
    case "get_canvas_course_files":
    case "read_canvas_file":
      return "Canvas";
    case "get_my_tasks":
      return "your tasks";
    case "get_upcoming_events":
    case "get_events_for_date":
      return "your calendar";
    default:
      return null;
  }
}

/** Runs a genuine multi-turn Claude tool-use loop: fetch real data, then act on it. */
export async function runVoiceAgentToolLoop(userText: string): Promise<ToolLoopResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const today = new Date().toISOString().slice(0, 10);
  const userContext = getContextAsString();
  const messages: AnthropicMessage[] = [{ role: "user", content: userText }];

  let finalText = "";
  let lastAction = "assistant_reply";
  let lastTask: Task | undefined;
  let lastPlan: ToolLoopResult["plan"];
  let lastCount: number | undefined;
  let lastActionId: string | undefined;
  const sourcesChecked = new Set<string>();

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: systemPrompt(today, userContext),
        tools: TOOLS,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { content: AnthropicContentBlock[]; stop_reason: string };
    messages.push({ role: "assistant", content: data.content });

    const toolUseBlocks = data.content.filter((b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    const textBlocks = data.content.filter((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text");
    if (textBlocks.length > 0) finalText = textBlocks.map((b) => b.text).join("\n").trim();

    if (toolUseBlocks.length === 0 || data.stop_reason !== "tool_use") {
      break;
    }

    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const block of toolUseBlocks) {
      console.log(`[voice-agent-tools] Calling tool: ${block.name}`, JSON.stringify(block.input));
      const sourceLabel = sourceLabelForTool(block.name);
      if (sourceLabel) sourcesChecked.add(sourceLabel);
      let resultPayload: unknown;
      try {
        const exec = await executeTool(block.name, block.input);
        resultPayload = exec.data;
        if (exec.action) lastAction = exec.action;
        if (exec.task) lastTask = exec.task;
        if (exec.plan) lastPlan = exec.plan;
        if (exec.count !== undefined) lastCount = exec.count;
        if (exec.actionId) lastActionId = exec.actionId;
        console.log(`[voice-agent-tools] Tool result (${block.name}):`, summarize(resultPayload));
        if (exec.pending) {
          return {
            response: exec.pending.message,
            action: "confirm_required",
            sourcesChecked: sourcesChecked.size > 0 ? Array.from(sourcesChecked) : undefined,
            pending: exec.pending,
          };
        }
      } catch (e) {
        resultPayload = { error: e instanceof Error ? e.message : "Tool failed" };
        console.error(`[voice-agent-tools] Tool error (${block.name}):`, resultPayload);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(resultPayload).slice(0, 8000),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    response: finalText || "Done!",
    action: lastAction,
    task: lastTask,
    plan: lastPlan,
    count: lastCount,
    actionId: lastActionId,
    sourcesChecked: sourcesChecked.size > 0 ? Array.from(sourcesChecked) : undefined,
  };
}
