"use client";

// Development-only preview of the capture home with sample data, so its
// motion can be looked at and profiled locally without a Supabase account.
// npm run dev, then open /dev/capture. 404s in production.

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { MockAppStateProvider } from "@/components/AppStateProvider";
import MotionProvider from "@/components/MotionProvider";
import CaptureHome from "@/components/capture/CaptureHome";
import { SAMPLE_STATE } from "@/lib/dev/sample-state";



// ?demo=1: press and release the island on a loop (hold 2.2s, rest 2.8s), so
// the motion can be recorded where nobody can hold it (iOS Simulator).
function useDemoLoop() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get("demo") !== "1") return;
    const fire = (type: string) => {
      const el = document.querySelector(".capture-island");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, isPrimary: true, pointerType: "touch", clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    };
    const timers: number[] = [];
    const cycle = () => {
      fire("pointerdown");
      timers.push(window.setTimeout(() => fire("pointerup"), 2200));
    };
    timers.push(window.setTimeout(cycle, 1500));
    const id = window.setInterval(cycle, 5000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(id);
    };
  }, []);
}

export default function CapturePreview() {
  useDemoLoop();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <MockAppStateProvider state={SAMPLE_STATE}>
      <MotionProvider>
        <CaptureHome />
      </MotionProvider>
    </MockAppStateProvider>
  );
}
