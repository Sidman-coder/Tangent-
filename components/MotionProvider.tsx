"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { defaultTransition } from "@/lib/motion";

const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

/**
 * App-wide motion settings.
 * - reducedMotion="user": when the OS asks for reduced motion, every `m`
 *   component drops transform and layout animation and keeps only opacity /
 *   color fades — one switch instead of per-component checks.
 * - transition: the motion tokens (--dur, --ease) for anything that names no
 *   transition of its own, so CSS and JS animations share one timing.
 * - LazyMotion + `m` components (strict) keep the animation features out of
 *   the first load; domMax (needed for layout animations) arrives as its own
 *   chunk right after hydration.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={defaultTransition}>{children}</MotionConfig>
    </LazyMotion>
  );
}
