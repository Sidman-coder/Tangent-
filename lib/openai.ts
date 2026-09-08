import { COMMAND_SYSTEM_PROMPT, parseCommandsFromText } from "./command-json";
import type { Command } from "./types";

type ChatResult = { reply: string; commands: Command[] };

export async function openaiCommandsFromTranscript(
  apiKey: string,
  model: string,
  transcript: string
): Promise<Command[]> {
  const body = {
    model,
    messages: [
      { role: "system", content: COMMAND_SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseCommandsFromText(text);
  return parsed ?? [];
}

const CHAT_SYSTEM = `You are Tangent, a concise productivity assistant (Notion-like tone).
Always respond with a single JSON object ONLY, no markdown:
{"reply":"string shown to user","commands":[]}
where "commands" is an array of command objects. Same rules as:
${COMMAND_SYSTEM_PROMPT}
If no data changes, use "commands": [].`;

export async function openaiChatWithCommands(
  apiKey: string,
  model: string,
  userMessage: string,
  contextJson: string
): Promise<ChatResult> {
  const body = {
    model,
    messages: [
      { role: "system", content: CHAT_SYSTEM },
      {
        role: "user",
        content: `Current app state (JSON):\n${contextJson}\n\nUser:\n${userMessage}`,
      },
    ],
    temperature: 0.35,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "{}";
  let raw = text.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) raw = fence[1].trim();
  let reply = raw;
  let commands: Command[] = [];
  try {
    const obj = JSON.parse(raw) as { reply?: string; commands?: Command[] };
    reply = typeof obj.reply === "string" ? obj.reply : raw;
    commands = Array.isArray(obj.commands) ? obj.commands : [];
  } catch {
    reply = text;
  }
  return { reply, commands };
}
