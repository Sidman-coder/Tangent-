// Hands a Path title from Home ("Make it a Path") to the New Path dialog on
// /tangents. The title is the student's own words, so it travels through
// sessionStorage rather than the URL; /tangents?new=1 only says "open the
// dialog". Read once, then removed.

const KEY = "tangent-new-path-title";

export function putNewPathTitle(title: string): void {
  try {
    window.sessionStorage.setItem(KEY, title);
  } catch {
    /* storage blocked: the dialog just opens empty */
  }
}

export function takeNewPathTitle(): string | null {
  try {
    const title = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return title?.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}
