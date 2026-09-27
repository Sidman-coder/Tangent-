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
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/** A section rising into place. Under reducedMotion="user" the y offset is
 *  dropped by MotionConfig and only the opacity fade remains. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...spring.soft, visualDuration: 0.6, bounce: 0, filter: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
    // A lingering filter or transform makes the element the containing block
    // for position:fixed children, which would pin modals to the section
    // instead of the viewport. Clear both once the entrance is over.
    transitionEnd: { filter: "none", transform: "none" },
  },
};

/** A whole page arriving after navigation: a short lift and focus-pull, so a
 *  route change reads as one continuous surface rather than a hard cut. */
export const pageEnter = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
    transitionEnd: { filter: "none", transform: "none" },
  },
} as const;

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
