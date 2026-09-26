export type AppearanceMode = "dark" | "light";

const THEME_KEY = "tangent-theme";

/** Always writes an explicit data-theme, so both palette blocks in
 *  globals.css are reachable. Removing the attribute instead of setting
 *  "light" left [data-theme="light"] dead and only worked by accident,
 *  because :root happened to carry the same values. */
function paint(theme: AppearanceMode): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyTheme(): void {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(THEME_KEY) as AppearanceMode | null;
  paint(stored === "dark" ? "dark" : "light");
}

export function setTheme(theme: AppearanceMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  paint(theme);
}
