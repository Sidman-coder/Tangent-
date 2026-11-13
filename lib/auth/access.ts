// Invite-only and owner checks. Server-side only (reads non-public env vars);
// safe to import from middleware.

function parseEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map(normalizeEmail)
      .filter(Boolean)
  );
}

/** Lowercased and trimmed. A space inside the address can only be a "+" that
 *  a query string decoded (a+eval@x.com → "a eval@x.com"), so it goes back. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase().replace(/\s+(?=[^@]*@)/g, "+");
}

/** The address without a "+tag" (a+eval@x.com → a@x.com). */
function withoutTag(email: string): string {
  return email.replace(/\+[^@]*(?=@)/, "");
}

/** Pure allowlist match: exact (case-insensitive, trimmed), or a "+tag" alias of
 *  an invited address (same mailbox). An invited alias doesn't admit the base
 *  address or other aliases. */
export function emailInList(email: string | null | undefined, allowed: ReadonlySet<string>): boolean {
  const e = normalizeEmail(email);
  if (!e || !/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  if (allowed.has(e)) return true;
  const base = withoutTag(e);
  return base !== e && allowed.has(base);
}

/** True only for emails listed in ALLOWED_EMAILS (see emailInList). Fails
 *  closed: if the env var is unset or empty, nobody is allowed in. */
export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = parseEmails(process.env.ALLOWED_EMAILS);
  if (allowed.size === 0) {
    console.warn("[auth] ALLOWED_EMAILS is empty — denying all sign-ins.");
    return false;
  }
  return emailInList(email, allowed);
}

/** True when the email matches OWNER_EMAIL — the account whose Google
 *  credentials (GOOGLE_* env vars) back the Gmail / Google Calendar tools. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  const owner = normalizeEmail(process.env.OWNER_EMAIL);
  return !!e && !!owner && e === owner;
}
