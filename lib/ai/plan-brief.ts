// Master fix Phase 3, the adaptive grill: what a plan needs to know, by kind
// of goal. Each kind has a brief (its slots, most impact first). A slot is
// filled from what Tangent already has (the request, the chat so far, the
// student context: What Tangent knows, capacity, load, Canvas, Paths) before
// anything is asked; only the missing required slots become questions, all in
// one card (components/console/ClarifyCard.tsx, which adds "Other…" and
// "Just do it"). Whatever is still missing when the plan is drafted is filled
// with a safe default and shown as an assumption on the preview.
//
// Pure: no model call, no I/O. lib/ai/clarify.ts asks with it; the plan
// drafter (lib/voice-handler.ts) reads answers and defaults with it.

export type GoalType = "exam" | "competition" | "skill" | "habit" | "single";

/** `assume` is what Tangent goes with if the question is skipped. */
export type BriefQuestion = { id: string; question: string; options: string[]; assume: string };

import { IF_SKIPPED, TIMEFRAME_OPTIONS, TIMEFRAME_QUESTION } from "../timeframe";

type Source = { request: string; chat: string; context: string; capacityKnown: boolean };

type Slot = {
  id: string;
  label: string;
  question: string;
  options: string[];
  /** Asked when missing; an optional slot is only ever a default. */
  required: boolean;
  /** The assumption shown when nothing fills it. */
  assume: string;
  /** The plan's date range is already stated by the drafter ("Spread from…",
   *  or that no timeframe was given), so a date default isn't repeated. */
  isDate?: boolean;
  fill: (s: Source) => string | null;
};

// ─── Reading values out of text ──────────────────────────────────────────────

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_RE = new RegExp(
  [
    `\\b${MONTH}\\.? \\d{1,2}(?:st|nd|rd|th)?\\b`,
    `\\b\\d{1,2}(?:st|nd|rd|th)? (?:of )?${MONTH}\\b`,
    `\\b\\d{4}-\\d{2}-\\d{2}\\b`,
    `\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b`,
    `\\b(?:in|within) (?:a|one|two|three|four|five|six|\\d+) (?:days?|weeks?|months?)\\b`,
    `\\b(?:next|this) (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b`,
    `\\b(?:tomorrow|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\\b`,
    `\\b(?:by|before|until|on) (?:the )?\\d{1,2}(?:st|nd|rd|th)\\b`,
    `\\bin (?:${MONTH})\\b`,
  ].join("|"),
  "i"
);
const TIMEFRAME_RE = /\b(?:in|within|over|for|by) (?:the )?(?:a|one|two|three|four|five|six|\d+|next|this|few) ?(?:days?|weeks?|months?|years?|summer|semester|year)\b|\bby (?:summer|winter|spring|fall|the end of|next)\b/i;
const HOURS_RE = /\b(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|ten) ?(?:-|to )?(?:\d+ )?(?:hours?|hrs?|h)\b(?: (?:a|per|each|every) (?:week|day|night|weekday))?|\b\d+ ?(?:min(?:ute)?s?)\b(?: (?:a|per|each) day)?/i;
const PER_WEEK_RE = /\b(?:(?:\d|one|two|three|four|five|six|seven)(?: ?(?:-|to) ?\d)? (?:times|days|sessions|x)(?: a| per| each)? week|every (?:day|morning|night|evening|weekday|other day)|daily|weekdays|weekends|(?:once|twice) a week|on (?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:s)?)\b/i;
const TIME_OF_DAY_RE = /\b(?:mornings?|evenings?|nights?|afternoons?|after school|before school|lunch|weekends?|at \d{1,2}(?::\d{2})? ?(?:am|pm)?|\d{1,2}(?::\d{2})? ?(?:am|pm))\b/i;
const DURATION_RE = /\b(?:for )?\d+ ?(?:min(?:ute)?s?|hours?|hrs?)\b|\b(?:half an hour|an hour|quick|short)\b/i;
const START_RE = /\b(?:start(?:ing)?|begin(?:ning)?|from) (?:today|tomorrow|now|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week|on)\b|\btoday\b|\btomorrow\b/i;
/** A score or grade ("1500", "a 5", "an A"); words like "pass" only when no number is given. */
const SCORE_RE = /\b(?:1[0-6]\d0|[2-3]\d)\+?\b(?! ?(?:min|hour|hr|day|week|time|session|am|pm|th|st|nd|rd))|\b(?:a|an) (?:[1-5]|a\+?|b\+?)\b(?= on| in|$|[,. ])/i;
const SCORE_WORDS_RE = /\b(?:pass|ace|top \d+%?|perfect score|full marks)\b/i;
const LEVEL_RE = /\b(?:beginner|intermediate|advanced|from scratch|never (?:done|played|tried)|(?:a|an) ?\d{3,4} (?:rating|elo)|\d{3,4} (?:rating|elo)|varsity|jv|black belt|grade \d|make the team|compete|competitive|casual|for fun|fluent|conversational|run (?:a|my first) (?:5k|10k|half|marathon)|(?:5k|10k|half marathon|marathon))\b/i;
const EQUIPMENT_RE = /\b(?:coach|trainer|tutor|lessons?|classes|club|team|gym|home workouts?|no equipment|online course|(?:have|own|got|with) (?:a |an |my |some )?(?:gear|equipment|bag|gloves|piano|keyboard|guitar|racket|weights|bike|board)|my (?:gear|bag|gloves|piano|keyboard|guitar|racket|weights|bike|board))\b/i;
const STAGE_RE = /\b(?:haven'?t started|not started|no idea yet|just an idea|brainstorm(?:ing)?|researching|research phase|collecting data|experiment(?:ing|s)?|prototype|prototyping|building|writing (?:it )?up|write-?up|almost done|nearly done|finished|have a topic|have a question|halfway)\b/i;
const MENTOR_RE = /\b(?:mentor|advisor|adviser|professor|teacher (?:is )?helping|on my own|no mentor|alone|by myself|lab|supervisor|sponsor)\b/i;
const MILESTONE_RE = /\b(?:abstract|registration|regionals?|state|qualif(?:y|ier)|board|poster|paper due|submission|round \d)\b/i;
const FREQ_RE = PER_WEEK_RE;

const ICF_FIELDS = /\b(?:robotics|biochem(?:istry)?|biology|bio|chemistry|chem|physics|cs|computer science|coding|software|engineering|math(?:ematics)?|environmental|earth|space|astronomy|medicine|health|behavioral|psychology|energy|materials|plant|animal|microbio(?:logy)?|translational|ai|machine learning|debate|speech|policy|lincoln-douglas|public forum|essay|poetry|art|music|business|marketing|finance|entrepreneurship)\b/i;
const SINGLE_SUBJECT_EXAM = /\b(?:ap [a-z]+(?: [a-z]+)?|chem(?:istry)?|bio(?:logy)?|physics|calc(?:ulus)?|algebra|geometry|precalc|stats|statistics|history|english|spanish|french|latin|german|chinese|econ(?:omics)?|psych(?:ology)?|gov(?:ernment)?|lit(?:erature)?|lang|math|science|vocab|cs) (?:test|exam|quiz|final|midterm|unit test)\b|\b(?:test|exam|quiz|final|midterm) (?:in|for|on) [a-z]+/i;
const SUBJECT_WORDS = /\b(?:math|reading|writing|english|science|verbal|quant|grammar|essay|rw|r&w|all (?:sections|subjects)|everything|every subject|chem(?:istry)?|bio(?:logy)?|physics|history|calc(?:ulus)?|spanish|french)\b/i;

const first = (re: RegExp, ...texts: string[]): string | null => {
  for (const t of texts) {
    const m = t.match(re);
    if (m) return m[0].trim();
  }
  return null;
};
/** The request and the chat first; the student context only for what it
 *  holds about this goal (a line naming it). */
const own = (s: Source) => [s.request, s.chat];

/** The goal's key word ("SAT", "ISEF", "chem test"), to find it in the context. */
function goalKey(request: string): string | null {
  const m = request.match(
    /\b(?:sat|act|psat|ap [a-z]+(?: [a-z]+)?|isef|science fair|olympiad|hackathon|amc|aime|usaco|deca|fbla|mun|ib|gcses?|a-?levels?|lsat|mcat|gre|gmat|[a-z]+ (?:test|exam|final|midterm|competition|tournament|fair))\b/i
  );
  return m ? m[0].toLowerCase() : null;
}
/** A YYYY-MM-DD on a context line that names the goal (Canvas, Paths, open tasks). */
function contextDate(s: Source): string | null {
  const key = goalKey(s.request);
  if (!key) return null;
  for (const line of s.context.split("\n")) {
    if (!line.toLowerCase().includes(key)) continue;
    const m = line.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (m) return m[0];
  }
  return null;
}
/** Does this say when: a date, or a stretch of time? */
export const saysWhen = (text: string) => DATE_RE.test(text) || TIMEFRAME_RE.test(text);
/** A known date for this goal, from Canvas, Paths or open tasks. */
export const knownDate = (request: string, context: string) => contextDate({ request, chat: "", context, capacityKnown: false });

/** A Paths goal line for this goal that already says hours per week. */
function contextHours(s: Source): string | null {
  const key = goalKey(s.request);
  if (!key) return null;
  for (const line of s.context.split("\n")) {
    if (!line.toLowerCase().includes(key)) continue;
    const m = line.match(/\b\d+(?:\.\d+)? hrs\/week\b/);
    if (m) return m[0];
  }
  return null;
}
/** A line in the context naming the goal that has this kind of value. */
function contextMatch(s: Source, re: RegExp): string | null {
  const key = goalKey(s.request);
  if (!key) return null;
  for (const line of s.context.split("\n")) if (line.toLowerCase().includes(key) && re.test(line)) return first(re, line);
  return null;
}

// ─── The briefs ──────────────────────────────────────────────────────────────

const date = (label: string, question: string): Slot => ({
  id: label === "Exam date" ? "date" : "deadline",
  label,
  question,
  options: [...TIMEFRAME_OPTIONS],
  required: true,
  assume: IF_SKIPPED,
  isDate: true,
  fill: (s) => first(DATE_RE, ...own(s)) ?? contextDate(s),
});

const hours = (question: string): Slot => ({
  id: "hours",
  label: "Hours per week",
  question,
  options: ["About 2 hrs", "About 4 hrs", "About 6 hrs", "8+ hrs"],
  required: true,
  assume: "About 3–4 hours a week, fitted to your usual capacity",
  fill: (s) => first(HOURS_RE, ...own(s)) ?? contextHours(s) ?? (s.capacityKnown ? "your usual capacity" : null),
});

export const BRIEFS: Record<GoalType, Slot[]> = {
  exam: [
    date("Exam date", "When is the exam?"),
    {
      id: "subjects",
      label: "Subjects",
      question: "Which sections or subjects need the most work?",
      options: ["Math", "Reading & writing", "Science", "All of it"],
      required: true,
      assume: "Every section, weakest first once you tell me",
      fill: (s) => first(SINGLE_SUBJECT_EXAM, s.request) ?? first(SUBJECT_WORDS, ...own(s)) ?? contextMatch(s, SUBJECT_WORDS),
    },
    {
      id: "target",
      label: "Level / target",
      question: "What score or grade are you aiming for?",
      options: ["Just pass", "A solid improvement", "Top score", "Not sure"],
      required: true,
      assume: "A solid improvement: practice first, then timed review",
      fill: (s) => first(SCORE_RE, ...own(s)) ?? contextMatch(s, SCORE_RE) ?? first(SCORE_WORDS_RE, ...own(s)),
    },
    hours("How many hours a week can you give it?"),
    {
      id: "times",
      label: "Times",
      question: "When do you study best?",
      options: ["After school", "Evenings", "Mornings", "Weekends"],
      required: false,
      assume: "At your open times after school",
      fill: (s) => first(TIME_OF_DAY_RE, ...own(s)),
    },
  ],
  competition: [
    date("Deadline", "When is the deadline or event?"),
    {
      id: "stage",
      label: "Stage",
      question: "Where are you with it right now?",
      options: ["Just an idea", "Researching", "Building / testing", "Writing it up"],
      required: true,
      assume: "Starting from the idea stage",
      fill: (s) => first(STAGE_RE, ...own(s)),
    },
    {
      id: "category",
      label: "Category",
      question: "What category or field is it in?",
      options: ["Engineering / robotics", "Biology / chemistry", "CS / math", "Something else"],
      required: true,
      assume: "General steps that fit any category",
      fill: (s) => first(ICF_FIELDS, ...own(s)) ?? contextMatch(s, ICF_FIELDS),
    },
    hours("How many hours a week can you put in?"),
    {
      id: "mentor",
      label: "Mentor",
      question: "Do you have a mentor or teacher helping?",
      options: ["Yes, a mentor", "A teacher, sometimes", "On my own"],
      required: true,
      assume: "Working on your own, with check-ins you can share with a teacher",
      fill: (s) => first(MENTOR_RE, ...own(s)),
    },
    {
      id: "milestones",
      label: "Milestones",
      question: "Any milestones before the final deadline?",
      options: ["Registration", "Abstract", "A regional round", "None that I know"],
      required: false,
      assume: "Standard milestones: idea, research, build, write-up, practice",
      fill: (s) => first(MILESTONE_RE, ...own(s)) ?? contextMatch(s, MILESTONE_RE),
    },
  ],
  skill: [
    {
      id: "timeframe",
      label: "Timeframe",
      question: TIMEFRAME_QUESTION,
      options: [...TIMEFRAME_OPTIONS],
      required: true,
      assume: IF_SKIPPED,
      isDate: true,
      fill: (s) => first(TIMEFRAME_RE, ...own(s)) ?? first(DATE_RE, ...own(s)),
    },
    {
      id: "level",
      label: "Goal level",
      question: "Where are you starting, and how good do you want to get?",
      options: ["Total beginner", "Some experience", "Already decent, want more"],
      required: true,
      assume: "Starting from the basics",
      fill: (s) => first(LEVEL_RE, ...own(s)),
    },
    {
      id: "sessions",
      label: "Sessions per week",
      question: "How many times a week can you practice?",
      options: ["2 times", "3 times", "4–5 times", "Every day"],
      required: true,
      assume: "3 sessions a week",
      fill: (s) => first(PER_WEEK_RE, ...own(s)),
    },
    {
      id: "access",
      label: "Equipment / coach",
      question: "Do you have a coach, club or the gear?",
      options: ["Coach or club", "Just the gear", "Nothing yet"],
      required: true,
      assume: "No coach or special gear needed to start",
      fill: (s) => first(EQUIPMENT_RE, ...own(s)),
    },
  ],
  habit: [
    {
      id: "frequency",
      label: "Frequency",
      question: "How often?",
      options: ["Every day", "Weekdays", "3 times a week"],
      required: true,
      assume: "Every day",
      fill: (s) => first(FREQ_RE, ...own(s)),
    },
    {
      id: "time",
      label: "Time",
      question: "What time of day?",
      options: ["Morning", "After school", "Evening", "Before bed"],
      required: true,
      assume: "After school, at an open time",
      fill: (s) => first(TIME_OF_DAY_RE, ...own(s)),
    },
    {
      id: "duration",
      label: "Duration",
      question: "How long each time?",
      options: ["10 min", "20 min", "30 min", "1 hr"],
      required: false,
      assume: "20 minutes each time, easy to keep up",
      fill: (s) => first(DURATION_RE, ...own(s)),
    },
    {
      id: "start",
      label: "Start date",
      question: "When should it start?",
      options: ["Today", "Tomorrow", "Next Monday"],
      required: false,
      assume: "Starts tomorrow",
      isDate: true,
      fill: (s) => first(START_RE, ...own(s)),
    },
  ],
  single: [],
};

/** Most questions one card may ask, by kind: a simple ask gets 0–2, a big goal
 *  up to 4–5. */
export const MAX_QUESTIONS: Record<GoalType, number> = { exam: 3, competition: 3, skill: 2, habit: 2, single: 0 };

// ─── What kind of goal ───────────────────────────────────────────────────────

const PHYSICAL =
  /\b(?:box(?:ing|er)?|mma|fight(?:er|ing)?|wrestl(?:e|ing)|martial arts?|karate|judo|jiu ?jitsu|bjj|taekwondo|kickbox(?:ing)?|lift(?:ing)?|weights?|gym|bodybuild(?:ing)?|run(?:ning)?|marathon|5k|10k|sprint|swim(?:ming)?|basketball|soccer|football|tennis|volleyball|baseball|hockey|climb(?:ing)?|gymnastics|cycling|bike|skate(?:boarding)?|surf(?:ing)?|track|fitness|workout|muscle|dunk|athlete|sport|tyson|ali|lebron|jordan|messi|ronaldo|kobe|curry|bolt|phelps|serena)\b/i;
const ASPIRATION = /\b(?:be (?:like|as good as)|become (?:like |as good as )?(?:a |an |the )?|turn into|be the next|want to be (?:a |an )?)[a-z]/i;
const EXAM = /\b(?:exams?|tests?|quiz(?:zes)?|midterms?|finals?|sat|act|psat|ap [a-z]+|gcses?|a-?levels?|ib exams?|lsat|mcat|gre|gmat|boards)\b/i;
const EXAM_PREP = /\b(?:study|studying|prep|prepare|preparing|review|get ready|ace|pass|score|cram|plan|help|practice|improve|raise|boost)\b/i;
const COMPETITION = /\b(?:competitions?|olympiads?|isef|science fair|hackathons?|contests?|tournaments?|regionals|nationals|debate|model un|mun|deca|fbla|science olympiad|amc|aime|usaco|robotics comp(?:etition)?|pitch|essay contest|scholarship)\b/i;
const COMPETITION_PREP = /\b(?:prep|prepare|preparing|plan|help|get ready|compete|enter|win|qualify|place|working on|project|submit|build|train)\b/i;
const HABIT = /\b(?:habit|routine|streak|every (?:day|morning|night|evening)|daily|each day|each morning|(?:start|begin|keep) (?:journaling|meditating|reading|stretching|running|waking|sleeping|drinking))\b/i;
const HABIT_WANT = /\b(?:want|wanna|build|start|keep|stick|make|get into|form|help|try)\b/i;
/** "fight Mike Tyson in 2 weeks": a silly match-up against a famous athlete.
 *  Master fix Phase 3: read as a skill aspiration (one light question, then a
 *  safe fundamentals plan), whatever timeframe it names. */
const CHALLENGE =
  /\b(?:fight|beat|box|spar(?: with| against)?|knock out|take on|go (?:\d+ )?rounds with|race|outrun|1v1|play against)\s+(?:mike tyson|tyson|muhammad ali|lebron(?: james)?|michael jordan|messi|ronaldo|kobe|steph curry|usain bolt|bolt|michael phelps|phelps|serena(?: williams)?|a pro(?:fessional)?\b|an? (?:olympian|champion|pro boxer|ufc fighter))/i;
const SKILL = /\b(?:get better at|learn(?:ing)?(?: (?:to|how))?|improve(?: at| my)?|master|getting good at|get good at|train(?:ing)? (?:for|to)|teach myself|pick up|work on my|level up)\b/i;

/** The kind of goal a request is, or null when it isn't one of the known
 *  kinds (lib/ai/clarify.ts then asks the model, as before). "single" is a
 *  plain capture: never grilled. */
export function goalType(text: string): GoalType | null {
  const t = text.trim();
  if (COMPETITION.test(t) && COMPETITION_PREP.test(t)) return "competition";
  if (EXAM.test(t) && EXAM_PREP.test(t)) return "exam";
  if (HABIT.test(t) && HABIT_WANT.test(t)) return "habit";
  if (SKILL.test(t) || ASPIRATION.test(t) || CHALLENGE.test(t)) return "skill";
  if (COMPETITION.test(t) || EXAM.test(t)) return "single";
  return null;
}

/** "I want to be like Mike Tyson": a big dream with nothing concrete, which
 *  gets one light question and then a safe plan. */
export function isAspiration(text: string): boolean {
  if (CHALLENGE.test(text)) return true;
  return ASPIRATION.test(text) && !LEVEL_RE.test(text) && !TIMEFRAME_RE.test(text);
}

export const isPhysical = (text: string) => PHYSICAL.test(text);

export const SAFETY_ASSUMPTION = "Safe start: technique and conditioning first, no sparring, contact or max lifts without a coach";

// ─── Reading a brief ─────────────────────────────────────────────────────────

export type Brief = {
  type: GoalType;
  /** Slot id → what filled it (the request, the chat, the context or an answer). */
  filled: Record<string, string>;
  /** Slots nothing filled, in brief order. */
  missing: Slot[];
  aspiration: boolean;
  physical: boolean;
};

const ANSWERS_MARK = "\n\nMy answers to your questions:\n";
const SKIP_ANSWER = /^(?:other…?|not sure(?: yet)?|skip|idk|i don'?t know|no idea)$/i;

/** The request without the answers block app/api/chat appends, and the answers
 *  ("- {question} {answer}" lines) as question → answer. */
export function splitAnswers(text: string): { request: string; answers: Map<string, string> } {
  const at = text.indexOf(ANSWERS_MARK);
  if (at < 0) return { request: text, answers: new Map() };
  const answers = new Map<string, string>();
  const allQuestions = Object.values(BRIEFS).flat().map((s) => s.question);
  for (const raw of text.slice(at + ANSWERS_MARK.length).split("\n")) {
    const line = raw.replace(/^- /, "");
    const q = allQuestions.find((question) => line.startsWith(`${question} `));
    if (q) answers.set(q, line.slice(q.length + 1).trim());
  }
  // Anything after the answers (a project note) stays with the request.
  const rest = text.slice(at + ANSWERS_MARK.length).split("\n\n").slice(1).join("\n\n");
  return { request: rest ? `${text.slice(0, at)}\n\n${rest}` : text.slice(0, at), answers };
}

/**
 * The brief for a request: its kind, the slots already filled from the
 * request, the chat so far, the student context and any answers, and what's
 * still missing. Null when the request isn't a known kind of goal.
 */
export function readBrief(
  text: string,
  ctx: { chat?: string; studentContext?: string; capacityKnown?: boolean } = {}
): Brief | null {
  const { request, answers } = splitAnswers(text);
  const type = goalType(request);
  if (!type) return null;
  const src: Source = { request, chat: ctx.chat ?? "", context: ctx.studentContext ?? "", capacityKnown: ctx.capacityKnown ?? false };
  const filled: Record<string, string> = {};
  const missing: Slot[] = [];
  for (const slot of BRIEFS[type]) {
    const answered = answers.get(slot.question);
    const value = answered && !SKIP_ANSWER.test(answered) ? answered : slot.fill(src);
    if (value) filled[slot.id] = value;
    else missing.push(slot);
  }
  return { type, filled, missing, aspiration: type === "skill" && isAspiration(request), physical: isPhysical(request) };
}

/** The questions to ask: the missing required slots, most impact first, at
 *  most MAX_QUESTIONS for the kind. An aspiration ("be like Mike Tyson") gets
 *  one light question; the rest are safe defaults. */
export function briefQuestions(b: Brief): BriefQuestion[] {
  const cap = b.aspiration ? 1 : MAX_QUESTIONS[b.type];
  return b.missing
    // A dream has no deadline to ask about: its one question is where they're starting.
    .filter((s) => s.required && !(b.aspiration && s.isDate))
    .slice(0, cap)
    .map((s) => ({ id: `brief-${s.id}`, question: s.question, options: [...s.options], assume: s.assume }));
}

/** The defaults behind every slot still missing, as preview assumptions (the
 *  plan's date range is stated by the drafter, so date slots are left out),
 *  plus the safety line for anything physical. */
export function briefAssumptions(b: Brief): string[] {
  const out = b.missing.filter((s) => !s.isDate).map((s) => s.assume);
  if (b.type === "skill" && b.physical) out.push(SAFETY_ASSUMPTION);
  return out;
}

/** The brief as the plan's notes (its project context) and as the planner's
 *  instructions: what's known, and the defaults it should follow. */
export function briefNotes(b: Brief): string {
  const known = BRIEFS[b.type].filter((s) => b.filled[s.id]).map((s) => `${s.label}: ${b.filled[s.id]}`);
  const assumed = briefAssumptions(b);
  const lines = [];
  if (known.length) lines.push(`Brief — ${known.join(" · ")}`);
  if (assumed.length) lines.push(`Assumed — ${assumed.join(" · ")}`);
  return lines.join("\n");
}
