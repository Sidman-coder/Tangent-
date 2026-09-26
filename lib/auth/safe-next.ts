/** Only allow same-site relative paths as a post-sign-in destination, so the
 *  `next` param can't be used as an open redirect. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
