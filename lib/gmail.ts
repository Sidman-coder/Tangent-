// lib/gmail.ts
//
// READ-ONLY BY DESIGN. This module only ever calls Gmail endpoints capable of
// reading mail (users.messages.list / users.messages.get) using the
// gmail.readonly OAuth scope. It must never implement gmail.send, gmail.modify,
// gmail.compose, or any endpoint that can send, label, or delete mail.
// Do not add write-capable functions to this file.

export type EmailSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
};

export type EmailFull = EmailSummary & {
  to: string;
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

/** Refreshes the access token using the stored refresh token. Read-only scope only. */
async function getGmailAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedTokenExpiresAt) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in .env.local"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  // Refresh a little early to avoid using a token that expires mid-request.
  cachedTokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedAccessToken;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

/** Walks the MIME part tree and extracts plain text, decoding base64url bodies. */
function extractBodyFromParts(part: GmailPart | undefined): { text: string | null; html: string | null } {
  if (!part) return { text: null, html: null };

  let text: string | null = null;
  let html: string | null = null;

  if (part.mimeType === "text/plain" && part.body?.data) {
    text = decodeBase64Url(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data) {
    html = decodeBase64Url(part.body.data);
  }

  if (part.parts) {
    for (const child of part.parts) {
      const found = extractBodyFromParts(child);
      if (found.text && !text) text = found.text;
      if (found.html && !html) html = found.html;
    }
  }

  return { text, html };
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return "";
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

type GmailMessageResource = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
};

function messageToEmail(msg: GmailMessageResource): EmailFull {
  const headers = msg.payload?.headers;
  const { text, html } = extractBodyFromParts(msg.payload);
  const body = text ?? (html ? stripHtml(html) : "") ?? "";

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(headers, "Subject") || "(no subject)",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    date: getHeader(headers, "Date"),
    snippet: msg.snippet ?? "",
    body: body.trim(),
  };
}

/** Fetches recent emails. Returns subject, sender, date, and plain text body for each. GET-only. */
export async function getRecentEmails(maxResults: number, query?: string): Promise<EmailSummary[]> {
  const accessToken = await getGmailAccessToken();

  const listParams = new URLSearchParams({ maxResults: String(Math.max(1, Math.min(maxResults || 10, 50))) });
  if (query) listParams.set("q", query);

  const listRes = await fetch(`${GMAIL_API_BASE}/messages?${listParams.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list messages failed: ${listRes.status} ${err}`);
  }

  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = listData.messages ?? [];

  const emails: EmailSummary[] = [];
  for (const { id } of ids) {
    const msgRes = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as GmailMessageResource;
    emails.push(messageToEmail(msg));
  }

  return emails;
}

/** Fetches a single email's full content by message ID. GET-only. */
export async function getEmailById(messageId: string): Promise<EmailFull> {
  const accessToken = await getGmailAccessToken();

  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail get message failed: ${res.status} ${err}`);
  }

  const msg = (await res.json()) as GmailMessageResource;
  return messageToEmail(msg);
}
