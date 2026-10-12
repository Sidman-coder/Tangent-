// What a full sign-out clears in the browser: this tab's session data and every
// Tangent key in localStorage (chat ids, cached titles, nudges), except the
// theme, which belongs to the device rather than the student.

const KEEP = new Set(["tangent-theme"]);

export function isTangentKey(key: string): boolean {
  return /^tangent[:-]/.test(key) && !KEEP.has(key);
}

export function clearLocalAppData(): void {
  try {
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isTangentKey(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}
