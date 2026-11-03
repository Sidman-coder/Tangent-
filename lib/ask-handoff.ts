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

/** "Ask about this": a project or task opened in Tangent AI as a chip. */
export type AskAbout = { kind: "project" | "task"; id: string };
export const ASK_ABOUT_EVENT = "tangent:ask-about";

export function askAboutHref({ kind, id }: AskAbout): string {
  return `/ai?${kind}=${encodeURIComponent(id)}`;
}

export function attachmentFromSearch(search: string): AskAbout | null {
  const params = new URLSearchParams(search);
  const project = params.get("project");
  if (project) return { kind: "project", id: project };
  const task = params.get("task");
  return task ? { kind: "task", id: task } : null;
}
