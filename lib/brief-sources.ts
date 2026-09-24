import type { Task } from "./types";

export function checkStaleItems(tasks: Task[], daysThreshold = 5): string[] {
  const now = Date.now();
  return tasks
    .filter((t) => !t.completed && now - new Date(t.date).getTime() > daysThreshold * 86400000)
    .map((t) => `You haven't touched "${t.title}" in a while.`);
}

export async function fetchRSSSummary(url: string): Promise<string[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const xml = await res.text();
    const titles: string[] = [];
    const titleRegex = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
    let match: RegExpExecArray | null;
    let skippedFeedTitle = false;
    while ((match = titleRegex.exec(xml)) !== null && titles.length < 5) {
      if (!skippedFeedTitle) {
        // The first <title> in an RSS/Atom document is the feed's own title, not an item.
        skippedFeedTitle = true;
        continue;
      }
      const title = match[1].trim();
      if (title) titles.push(title);
    }
    return titles;
  } catch (e) {
    console.error("[brief-sources] fetchRSSSummary error:", e);
    return [];
  }
}

// ─── AI calls — only used where deterministic assembly isn't enough ─────────

async function callHaikuCached(systemPrompt: string, userContent: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      // Static system prompt in its own cached block — only per-user variable
      // data goes in the user message, so this block actually hits cache.
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

const MANUAL_URL_SUMMARY_SYSTEM_PROMPT = `You summarize a single web page for a user's daily brief. You will receive raw page text. Write 2-3 sentences capturing what's new or noteworthy on the page. No filler like "this page discusses" — just the substance. Return plain text only, no markdown, no JSON.`;

/** Only source type that needs interpretation — an unstructured page with no feed to parse. */
export async function summarizeManualUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    if (!text) return "";
    return await callHaikuCached(MANUAL_URL_SUMMARY_SYSTEM_PROMPT, text, 200);
  } catch (e) {
    console.error("[brief-sources] summarizeManualUrl error:", e);
    return "";
  }
}

const FIND_SOURCES_SYSTEM_PROMPT = `You suggest RSS feeds and websites a user could add as daily-brief sources, based on a topic or interest they describe. Return a JSON array (2-5 items) of objects shaped exactly like:
[{ "label": "short display name", "type": "rss" or "manual_url", "url": "https://...", "reason": "one short sentence on why this fits" }]
Prefer well-known, stable, real feeds/sites. Use "rss" only when you are confident the URL is an actual RSS/Atom feed; otherwise use "manual_url" for a normal page. Return ONLY the JSON array. No other text.`;

export type SuggestedBriefSource = {
  label: string;
  type: "rss" | "manual_url";
  url: string;
  reason: string;
};

/** AI-assisted source discovery — user describes an interest, picks which suggestions to keep. */
export async function findSuggestedSources(query: string): Promise<SuggestedBriefSource[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const text = await callHaikuCached(FIND_SOURCES_SYSTEM_PROMPT, trimmed, 500);
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SuggestedBriefSource =>
          item &&
          typeof item.label === "string" &&
          (item.type === "rss" || item.type === "manual_url") &&
          typeof item.url === "string" &&
          typeof item.reason === "string"
      )
      .slice(0, 5);
  } catch (e) {
    console.error("[brief-sources] findSuggestedSources error:", e);
    return [];
  }
}

const BRIEF_NARRATION_SYSTEM_PROMPT = `You write the narration for a user's daily brief. You will receive plain-text data that has already been assembled: stale-task reminders, feed headlines, and page summaries. Stitch it into 2-4 short, direct sentences. Do not invent facts that aren't in the data. No filler, no chatbot tone. Return plain text only, no markdown, no JSON.`;

/** Final narration pass — only called after stale-check and RSS data is assembled with zero AI cost. */
export async function generateBriefNarration(input: {
  staleItems: string[];
  feedHeadlines: Record<string, string[]>;
  manualSummaries: string[];
}): Promise<string> {
  const sections: string[] = [];
  if (input.staleItems.length) sections.push("STALE ITEMS:\n" + input.staleItems.join("\n"));
  for (const [label, headlines] of Object.entries(input.feedHeadlines)) {
    if (headlines.length) sections.push(`FEED "${label}":\n` + headlines.join("\n"));
  }
  if (input.manualSummaries.length) sections.push("PAGE SUMMARIES:\n" + input.manualSummaries.join("\n"));
  const userContent = sections.join("\n\n") || "No new data today.";

  try {
    return await callHaikuCached(BRIEF_NARRATION_SYSTEM_PROMPT, userContent, 250);
  } catch (e) {
    console.error("[brief-sources] generateBriefNarration error:", e);
    return "";
  }
}
