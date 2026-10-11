"use client";

// Feeds the pointer position to whichever .lg-interactive glass it's over,
// so the light inside the glass follows it (app/liquid-glass.css). One
// passive listener for the whole app; writes two custom properties on that
// one element, no React state.

import { useEffect } from "react";

export default function LiquidGlass() {
  useEffect(() => {
    let raf = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.(".lg-interactive") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--lg-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--lg-y", `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
