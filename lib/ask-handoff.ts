// Hands what the student typed into "Tell Tangent" (Cmd-K) to the page that
// will handle it — the AI page for a question, Projects for a new project —
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

/** A question for Ask Tangent. When Home is already showing, its chat sheet
 *  takes it in place (HomeChat cancels the event); otherwise go to /?ask=1. */
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

/** "Ask about this": a task opens its own chat over Home; a project opens its
 *  chat on the project page. */
export type AskAbout = { kind: "project" | "task"; id: string };

export function askAboutHref({ kind, id }: AskAbout): string {
  const safe = encodeURIComponent(id);
  return kind === "project" ? `/projects/${safe}?chat=1` : `/?taskChat=${safe}`;
}
