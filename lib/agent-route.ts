// Which requests go to the agent tool loop (Sonnet, live Gmail/Canvas/Calendar
// data). Pure, so it can be unit-tested without the server-only store.

const GMAIL_KEYWORDS = /\b(email|emails|gmail|inbox|unread|message|messages)\b/i;
const CANVAS_KEYWORDS = /\b(canvas|assignment|assignments|course|due|homework|class|syllabus|professor)\b/i;
const CALENDAR_KEYWORDS = /\b(calendar|event|events|schedule|meeting|appointment|what do i have|what's on my)\b/i;

/** Words that name a live source; "homework", "due" and "class" are titles. */
const DATA_SOURCE_WORDS = /\b(email|emails|gmail|inbox|unread|canvas|syllabus)\b/i;

/** Overnight 2 (eval calc-and-essay, chat-title-bio-homework): "homework",
 *  "due", "class" or "meeting" alone are titles in a capture ("add bio
 *  homework tomorrow at 5"). They need live data only when the student is
 *  asking to look something up. A source name (Gmail, Canvas) always does. */
const LOOKUP_WORDS = /\?|\b(what|what's|whats|which|show|list|check|read|any|anything|how many|do i have|have i got|summari[sz]e|find|look up)\b/i;

/** "remind me to email Mr. Patel", "email coach tonight": "email" as a verb is
 *  a to-do, not a look in Gmail (overnight 2, eval voice-email-teacher). */
const EMAIL_VERB = /\b(?:remind me to|need to|have to|got to|gotta|should|must|don'?t forget to|to)\s+e-?mail\b|^\s*e-?mail\s+(?!from\b)/i;
const OTHER_SOURCE_WORDS = /\b(gmail|inbox|unread|canvas|syllabus|emails)\b/i;

/** "email" only as the thing to do, with nothing to look up. */
function emailIsTheTask(text: string): boolean {
  return EMAIL_VERB.test(text) && !OTHER_SOURCE_WORDS.test(text) && !LOOKUP_WORDS.test(text);
}

/** Master fix B1: the student's own words, without what the server appends
 *  (answers to Tangent's questions, a project's brief). Those are full of
 *  "due", "schedule" and "class", which sent ISEF's answered questions into
 *  the tool loop, and its create_plan saved without a preview. */
export function ownWords(text: string): string {
  const cut = ["\n\nMy answers to your questions:", "\n\n(This request is inside the student's project"]
    .map((marker) => text.indexOf(marker))
    .filter((i) => i >= 0);
  return cut.length ? text.slice(0, Math.min(...cut)) : text;
}

/** Overnight 2 (eval cancel-robotics): once the router has called it a task
 *  command, only Gmail or Canvas words need live data; "meeting" or
 *  "appointment" is just a task title, so the cheap single call handles it. */
export function needsDataTools(fullText: string): boolean {
  const text = ownWords(fullText);
  return DATA_SOURCE_WORDS.test(text) && !emailIsTheTask(text);
}

/** Commands that plausibly need real Gmail/Canvas/Calendar data get routed through the tool loop. */
export function needsAgentTools(fullText: string): boolean {
  const text = ownWords(fullText);
  if (!DATA_SOURCE_WORDS.test(text) && !LOOKUP_WORDS.test(text)) return false;
  if (emailIsTheTask(text)) return false;
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
