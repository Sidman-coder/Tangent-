// Round 4 §3.1: messages that ask Tangent to plan something must start
// planning, never become a task with the request as its title ("Break down
// plan: get 10k followers on Instagram" did). Pure, so the quick-capture path,
// the rules fallback and the model router all agree.

const FILLER = /^(?:(?:um+|uh+|so|ok(?:ay)?|hey|tangent|please|can you|could you|pls)\b[\s,]*)+/i;

// "help me move my dentist appointment" is still a task edit, not planning.
const TASK_EDIT = /^help me\s+(?:move|reschedule|delete|remove|cancel|find|remember|add|mark|clear|rename)\b/i;

const PLANNING_LEADS: RegExp[] = [
  /^break\s+(?:it\s+|this\s+|that\s+)?(?:down|up)\b/i,
  /^break\s+\S.*\s+(?:down|up|into)\b/i,
  /^(?:make|create|build|give|write|draft)\s+(?:me\s+|us\s+)?(?:a|an|my|the)?\s*(?:[\w-]+\s+){0,3}?(?:plan|path|roadmap|schedule|routine)\b/i,
  /^(?:plan|map)\s+(?:out|for|my|how)\b/i,
  /^(?:a\s+)?(?:plan|path|roadmap)\s+(?:for|to)\b/i,
  /^help\s+me\b/i,
  /^(?:what are (?:the\s+)?)?steps\s+(?:to|for)\b/i,
  /^how\s+(?:do|can|should|would)\s+i\s+(?:get|grow|reach|become|improve|start|build|learn|prepare|prep|hit|make|go from|master|get better)\b/i,
  /^i\s+(?:want|need|would like|'d like)\s+(?:a\s+)?(?:plan|path|roadmap)\b/i,
];

// "Break down plan: …", "Plan: …": a label, then the goal.
const LABEL = /^(?:break\s*down(?:\s+(?:plan|project|goal))?|plan|path|goal|roadmap)\s*[:\-–—]\s*/i;

function clean(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(FILLER, "").trim();
}

/** True when the message asks Tangent to plan, break down or map a path. */
export function isPlanningRequest(text: string): boolean {
  const s = clean(text);
  if (!s || s.length > 600) return false;
  if (LABEL.test(s)) return true;
  if (TASK_EDIT.test(s)) return false;
  return PLANNING_LEADS.some((re) => re.test(s));
}

/** The goal inside a planning request, for a project title or draft brief:
 *  "Break down plan: get 10k followers on Instagram" → "Get 10k followers on
 *  Instagram". Returns the cleaned text when there's no lead to strip. */
export function planningGoal(text: string): string {
  let s = clean(text).replace(/[.!?]+$/, "");
  const labelled = s.match(LABEL);
  if (labelled) s = s.slice(labelled[0].length);
  else
    s = s
      .replace(/^break\s+(?:it\s+|this\s+|that\s+)?(?:down|up)\s*(?:for me\s*)?(?:[:\-]\s*)?/i, "")
      .replace(/^(?:make|create|build|give|write|draft)\s+(?:me\s+|us\s+)?(?:a|an|my|the)?\s*(?:plan|path|roadmap|game plan)\s+(?:for|to)\s+/i, "")
      .replace(/^(?:a\s+)?(?:plan|path|roadmap)\s+(?:for|to)\s+/i, "")
      .replace(/^help\s+me\s+(?:to\s+)?/i, "")
      .replace(/^(?:what are (?:the\s+)?)?steps\s+(?:to|for)\s+/i, "")
      .replace(/^how\s+(?:do|can|should|would)\s+i\s+/i, "");
  s = s.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : clean(text);
}
