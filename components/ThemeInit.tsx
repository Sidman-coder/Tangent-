"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

export function ThemeInit() {
  useEffect(() => {
    applyTheme();
  }, []);
  return null;
}
