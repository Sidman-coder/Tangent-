// The dashboard's motion vocabulary. Every animated element picks from these
// presets instead of defining its own timing, so the page moves as one system.
// Duration-based springs (visualDuration + bounce) are used throughout: they
// read like a duration to tune, but still carry velocity between interruptions.

import type { Transition, Variants } from "motion/react";

// Apple's default for UI that wasn't thrown is critically damped (no
// overshoot): bounce 0 everywhere here. Bounce belongs only to things the
// student flicks, and those set their own.
export const spring = {
  /** Press, checkbox pops — small and fast. */
  snappy: { type: "spring", visualDuration: 0.2, bounce: 0 },
  /** Section entrances and content swaps. */
  soft: { type: "spring", visualDuration: 0.35, bounce: 0 },
  /** List reflow when rows are added, completed, or removed. */
  layout: { type: "spring", visualDuration: 0.32, bounce: 0 },
} satisfies Record<string, Transition>;

/** Parent container that staggers its sections in on first paint. */
export const staggerChildren: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0 } },
};

/** A section rising into place. Under reducedMotion="user" the y offset is
 *  dropped by MotionConfig and only the opacity fade remains. */
export const riseIn: Variants = {
  // No blur: it's expensive to draw (Safari especially) and, stacked with the
  // page fade, made every arrival feel soft and slow. Opacity and a short lift.
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] },
    // A lingering transform makes the element the containing block for
    // position:fixed children (modals). Clear it once the entrance is over.
    transitionEnd: { transform: "none" },
  },
};

/** A whole page arriving after navigation: a quick fade and a few pixels of
 *  lift, done in a fifth of a second so navigation feels instant. */
export const pageEnter = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
    transitionEnd: { transform: "none" },
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
  // Press feedback only: growing on hover read as springy, not crisp.
  whileTap: { scale: 0.96 },
  transition: spring.snappy,
} as const;
