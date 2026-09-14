// lib/voice-agent-tools.ts
//
// A genuine multi-turn Anthropic tool-use loop, additive to the existing
// single-shot JSON voice pipeline in app/api/voice/route.ts. It is only
// invoked for commands that look like they need Gmail or Canvas data
// (see needsAgentTools below). It reuses the existing store functions
// (addTask / addPlan / updateTask) for the "act" side so behavior matches
// the create_plan / add_task cases already in app/api/voice/route.ts.
import { addTask, addPlan, updateTask, getCalendars, moveTasksToCalendar, getTasksMatchingFilter, getContextAsString, recordAction } from "@/lib/store";
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
/** Same threshold as lib/voice-handler.ts — move_tasks operations affecting more tasks
 *  than this are too destructive to run unattended inside a multi-turn tool loop. */
const MOVE_CONFIRM_THRESHOLD = 5;

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
    input_schema: {
      type: "object",
      properties: {
        max_results: { type: "number", description: "How many recent emails to fetch, default 10" },
        query: {
          type: "string",
          description: "Optional Gmail search query like 'is:unread' or 'from:professor'",
        },
      },
    },
  },
  {
    name: "get_canvas_assignments",
    description: "Read upcoming Canvas assignments with due dates across all courses",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look, default 14" },
      },
    },
  },
  {
    name: "get_canvas_course_files",
    description: "List files available in a specific Canvas course",
    input_schema: {
      type: "object",
      properties: { course_id: { type: "string" } },
      required: ["course_id"],
    },
  },
  {
    name: "read_canvas_file",
    description: "Download and read the text content of a specific Canvas file such as a PDF or Word document",
    input_schema: {
      type: "object",
      properties: {
        file_url: { type: "string" },
        file_name: { type: "string" },
      },
      required: ["file_url", "file_name"],
    },
  },
  {
    name: "get_upcoming_events",
    description: "Read upcoming events from the user's Google Calendar",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "How many days ahead to look, default 7" },
      },
    },
  },
  {
    name: "get_events_for_date",
    description: "Get all calendar events for a specific date",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_calendars",
    description: "Get the list of all calendars the user has with their ids and names",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "move_tasks",
    description: "Move tasks matching a description or date range to a different calendar",
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
            },
          },
        },
      },
      required: ["targetCalendarId"],
    },
  },
  {
    name: "add_task",
    description: "Add a single task to the user's calendar",
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
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_plan",
    description: "Create a multi-task plan (e.g. a study plan) spread across several days on the calendar",
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
                },
              },
            },
            required: ["title", "date"],
          },
        },
      },
      required: ["title", "tasks"],
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
      if (matching.length > MOVE_CONFIRM_THRESHOLD) {
        return {
          data: {
            confirmRequired: true,
            count: matching.length,
            message: `This would move ${matching.length} tasks — too many to move automatically. Tell the user what would be affected and ask them to confirm before retrying.`,
          },
        };
      }

      const moves = matching.map((t) => ({ taskId: t.id, fromCalendarId: t.calendarId ?? null }));
      const moved = moveTasksToCalendar(filter, targetCalendar.id);
      const record = recordAction("move_tasks", `Moved ${moved} tasks to ${targetCalendar.name}`, { moves });
      return {
        data: { ok: true, moved, targetCalendar: targetCalendar.name },
        action: "move_tasks",
        count: moved,
        actionId: record.id,
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

    case "get_upcoming_events": {
      const daysAhead = typeof input.days_ahead === "number" ? input.days_ahead : 7;
      const events = await getUpcomingEvents(daysAhead);
      return { data: { events } };
    }

    case "get_events_for_date": {
      const date = typeof input.date === "string" ? input.date : "";
      if (!date) return { data: { error: "Missing date" } };
      const events = await getEventsForDate(date);
      return { data: { events } };
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
};

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
  };
}
