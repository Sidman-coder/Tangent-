// Hands what the student typed into "Tell Tangent" (Cmd-K) to the page that
// will handle it — Home for a question, Projects for a new project —
// through sessionStorage, not the URL (it's their own words). Read once.

type Target = "ai" | "project";

export function putAsk(target: Target, text: string): void {
  try {
    window.sessionStorage.setItem(`tangent-ask-${target}`, text);
  } catch {
    /* storage blocked: the page just opens empty */
  }
}

export const ASK_EVENT = "tangent:ask";

/** A question for Tangent. Round 4 Phase 4: there's no chat panel any more;
 *  Home's own box answers it inline. When Home is showing, its composer takes
 *  it in place (AddFlow cancels the event); otherwise go to /?ask=1. */
export function askOnHome(text: string, go: (href: string) => void): void {
  putAsk("ai", text);
  const handled = window.location.pathname === "/" && !window.dispatchEvent(new Event(ASK_EVENT, { cancelable: true }));
  if (!handled) go("/?ask=1");
}

export function takeAsk(target: Target): string | null {
  try {
    const key = `tangent-ask-${target}`;
    const text = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return text?.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

/** "Ask about this": a project's own page has an ask box (?ask=1 sends what
 *  was handed over); anything else is asked on Home. */
export type AskAbout = { kind: "project" | "task"; id: string };

export function askAboutHref({ kind, id }: AskAbout): string {
  return kind === "project" ? `/projects/${encodeURIComponent(id)}?ask=1` : "/?ask=1";
}
