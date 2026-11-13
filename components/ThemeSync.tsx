"use client";

import { useEffect } from "react";
import { readTheme, setTheme } from "@/lib/theme";

/** Re-applies the stored theme after hydration. The inline bootstrap in
 *  app/layout.tsx sets data-theme before first paint, but if hydration fails
 *  anywhere React replaces the whole document with client HTML, which carries
 *  the server's data-theme="light" and silently drops dark mode. */
export default function ThemeSync() {
  useEffect(() => {
    setTheme(readTheme());
  }, []);
  return null;
}
