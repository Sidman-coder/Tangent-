export type AppearanceMode = "dark" | "light";

const THEME_KEY = "tangent-theme";

/** Always writes an explicit data-theme, so both palette blocks in
 *  globals.css are reachable. Removing the attribute instead of setting
 *  "light" left [data-theme="light"] dead and only worked by accident,
 *  because :root happened to carry the same values. */
const THEME_BG: Record<AppearanceMode, string> = { light: "#f5f3fa", dark: "#13111d" };

function paint(theme: AppearanceMode): void {
  document.documentElement.setAttribute("data-theme", theme);
  // Keep the browser chrome in step with the page. The inline bootstrap in
  // app/layout.tsx sets this on load; this keeps it right when the theme is
  // switched from Settings without a reload.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BG[theme]);
}

/** The stored preference, resolved the same way the inline bootstrap in
 *  app/layout.tsx resolves it: anything that isn't exactly "dark" is light. */
export function readTheme(): AppearanceMode {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function setTheme(theme: AppearanceMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  paint(theme);
}
