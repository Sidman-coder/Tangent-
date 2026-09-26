// The dashboard's motion vocabulary. Every animated element picks from these
// presets instead of defining its own timing, so the page moves as one system.
// Duration-based springs (visualDuration + bounce) are used throughout: they
// read like a duration to tune, but still carry velocity between interruptions.

import type { Transition, Variants } from "motion/react";

export const spring = {
  /** Hover, press, checkbox pops — small, fast, barely-there bounce. */
  snappy: { type: "spring", visualDuration: 0.22, bounce: 0.2 },
  /** Section entrances and content swaps. */
  soft: { type: "spring", visualDuration: 0.45, bounce: 0.08 },
  /** List reflow when rows are added, completed, or removed. */
  layout: { type: "spring", visualDuration: 0.35, bounce: 0.05 },
} satisfies Record<string, Transition>;

/** Parent container that staggers its sections in on first paint. */
export const staggerChildren: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

/** A section rising into place. Under reducedMotion="user" the y offset is
 *  dropped by MotionConfig and only the opacity fade remains. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

/** A list row entering or leaving (used with AnimatePresence + layout). */
export const rowPresence = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, x: 16, transition: { ...spring.snappy, visualDuration: 0.18 } },
} as const;

/** Tactile feedback for anything pressable. */
export const press = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.94 },
  transition: spring.snappy,
} as const;
