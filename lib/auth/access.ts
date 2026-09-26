// Invite-only and owner checks. Server-side only (reads non-public env vars);
// safe to import from middleware.

function parseEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalize(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** True only for emails listed in ALLOWED_EMAILS. Fails closed: if the env var
 *  is unset or empty, nobody is allowed in. */
export function isEmailAllowed(email: string | null | undefined): boolean {
  const e = normalize(email);
  if (!e) return false;
  const allowed = parseEmails(process.env.ALLOWED_EMAILS);
  if (allowed.size === 0) {
    console.warn("[auth] ALLOWED_EMAILS is empty — denying all sign-ins.");
    return false;
  }
  return allowed.has(e);
}

/** True when the email matches OWNER_EMAIL — the account whose Google
 *  credentials (GOOGLE_* env vars) back the Gmail / Google Calendar tools. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const e = normalize(email);
  const owner = normalize(process.env.OWNER_EMAIL);
  return !!e && !!owner && e === owner;
}
