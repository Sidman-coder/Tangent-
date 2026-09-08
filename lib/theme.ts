export type AppearanceMode = "dark" | "light";
export type FontMode = "formal" | "warm";

const THEME_KEY = "tangent-theme";
const FONT_MODE_KEY = "tangent-font-mode";

export function applyTheme(): void {
  if (typeof window === "undefined") return;

  const theme = (localStorage.getItem(THEME_KEY) as AppearanceMode | null) ?? "light";
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  const fontMode = (localStorage.getItem(FONT_MODE_KEY) as FontMode | null) ?? "warm";
  document.documentElement.setAttribute("data-font", fontMode);
}

export function setTheme(theme: AppearanceMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setFontMode(mode: FontMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FONT_MODE_KEY, mode);
  document.documentElement.setAttribute("data-font", mode);
}
