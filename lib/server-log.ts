// Server-side error logging without personal data (Round 4, Phase 1.1/1.4).
// Postgres and Supabase messages can quote the value that failed ("invalid
// input syntax for type date: \"…\""), and auth errors can name an email. The
// summary keeps what helps debugging (where, status, code, the shape of the
// message) and replaces quoted values and email addresses.

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
};

const EMAIL = /[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@]+/g;
const QUOTED = /"[^"]*"|'[^']*'|`[^`]*`/g;
const MAX = 300;

/** The message with quoted values and email addresses removed, trimmed. */
export function redactMessage(message: string): string {
  return message.replace(EMAIL, "[email]").replace(QUOTED, '"…"').replace(/\s+/g, " ").trim().slice(0, MAX);
}

/** A one-line, personal-data-free description of a thrown value. */
export function safeErrorSummary(err: unknown): { name: string; code?: string; status?: number; message: string } {
  if (!err || typeof err !== "object") {
    return { name: typeof err, message: typeof err === "string" ? redactMessage(err) : "non-error thrown" };
  }
  const e = err as ErrorLike;
  const out: { name: string; code?: string; status?: number; message: string } = {
    name: typeof e.name === "string" ? e.name : "Error",
    message: typeof e.message === "string" ? redactMessage(e.message) : "",
  };
  if (typeof e.code === "string" || typeof e.code === "number") out.code = String(e.code).slice(0, 40);
  if (typeof e.status === "number") out.status = e.status;
  return out;
}

/** Logs `where` plus the safe summary. Never pass request bodies as `extra`;
 *  only fixed labels such as the action name. */
export function logServerError(where: string, err: unknown, extra?: Record<string, string | number | boolean | undefined>): void {
  console.error(`[${where}]`, JSON.stringify({ ...extra, ...safeErrorSummary(err) }));
}
