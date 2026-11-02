"use client";

// The Tangent tour: a step-by-step walk through every place, spotlighting the
// real control and saying what it does in a sentence or two. It moves between
// pages itself, waits for each control to appear, and falls back to a centred
// card when a control isn't on screen (a phone, an empty state).
//
// Mounted in app/(app)/layout.tsx, outside AppShell, so it survives the
// Tangents takeover. Starts on TOUR_EVENT: after Get to know you the first
// time, from Today's "Take the tour", or from Settings.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import "./feature-tour.css";

export const TOUR_EVENT = "tangent:tour";
export const TOUR_DONE_KEY = "tangent-tour-done";
/** Set for as long as the tour runs, so pages it revisits don't offer it again. */
export const TOUR_ACTIVE_KEY = "tangent-tour-active";

function setActive(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(TOUR_ACTIVE_KEY, "1");
    else window.sessionStorage.removeItem(TOUR_ACTIVE_KEY);
  } catch {}
}

type Step = {
  route: string;
  /** CSS selectors to spotlight, first visible one wins. None = centred card. */
  target?: string[];
  title: string;
  body: string;
  /** Optional: a button that shows the feature live. */
  demo?: { label: string; run: () => void };
};

const STEPS: Step[] = [
  {
    route: "/today",
    title: "Tangent in two minutes",
    body: "A quick walk through everything Tangent does. Use the arrow keys or the buttons; Esc ends it any time.",
  },
  {
    route: "/today",
    target: [".add-flow.is-hero"],
    title: "Add anything, typed or spoken",
    body: "This is the heart of Tangent. Type it, or tap the mic and say it. Tangent works out whether it's a task or a project, asks a question or two when that helps (skip them any time), then puts it on your calendar or in the project, with Undo.",
    demo: { label: "Try it now", run: () => window.dispatchEvent(new CustomEvent("tangent:open-palette", { detail: { prefill: "prep for my chem final" } })) },
  },
  {
    route: "/today",
    target: [".float-mic"],
    title: "Say it from anywhere",
    body: "The mic in the bottom corner is on every page: tap it and talk, and it goes through the same Add flow. Press ⌘K to type instead. Questions go to Tangent AI and long-range goals become Tangents, from the same box.",
  },
  {
    route: "/today",
    target: [".today-card"],
    title: "Today, in one list",
    body: "What needs attention sits at the top with why (overdue, starting soon, a Canvas deadline) and a Tomorrow button. The rest of your day follows. Click any task to open it in the middle.",
  },
  {
    route: "/today",
    target: ["#questions"],
    title: "Questions you skipped wait here",
    body: "If you skip Tangent's questions, or capture something quickly, they wait here. Answer whenever you like; every answer sharpens the task and teaches Tangent about you.",
  },
  {
    route: "/today",
    target: [".week-strip"],
    title: "It spaces your week",
    body: "Tangent knows how much you can handle in a day. New work lands on lighter days, and if one gets overloaded it suggests a move. Nothing moves without your tap.",
  },
  {
    route: "/calendar",
    target: [".cal-island"],
    title: "One bar to steer the calendar",
    body: "Week, Month or Agenda, back and forward, and what to show: School, Projects or Short-term. All in the floating bar, so the calendar itself stays clear.",
  },
  {
    route: "/calendar",
    target: [".calendar-grid-shell", ".calendar-week-shell", ".calendar-agenda-shell"],
    title: "Your calendar",
    body: "Dots are things to do; rings are due dates. Click a task to open it, or a date to see the whole day.",
  },
  {
    route: "/projects",
    target: [".project-card", ".projects-new", ".page-header-actions"],
    title: "Projects, each with its own Tangent AI",
    body: "A final, a science fair, starting a club. Tangent asks a few questions, then lays the steps across your calendar. Open a project and it has its own Tangent AI that knows it: ask what's next, or have it add and change steps.",
  },
  {
    route: "/projects",
    target: ['a.rail-btn[href="/tangents"]', '.mobile-nav-link[href="/tangents"]'],
    title: "Tangents for long-range goals",
    body: "Where you want to be in a year or more: a college, a rating, a career. Tangent asks what it needs to know, maps paths from what you already do, and branches off ideas you can keep.",
  },
  {
    route: "/ai",
    target: [".tg-composer-glow", ".tg-composer"],
    title: "Tangent AI knows you",
    body: "Plan your week, think something through, or ask what fits in 30 minutes. It already knows your schedule, classes, projects and workload, so it won't ask what it can see.",
  },
  {
    route: "/settings",
    target: ["#onboarding"],
    title: "Set Tangent up in Settings",
    body: "Onboarding has this tour, Tangent's first questions about you, Grill me and your setup answers. Just below, Connections brings in Canvas, your Google, Apple or Outlook calendar, and notes from Notion, Docs or other AIs.",
  },
  {
    route: "/settings",
    target: ["#what-tangent-knows"],
    title: "What Tangent knows",
    body: "Everything Tangent has learned about you, in one place. Forget anything wrong, or tell it something new.",
  },
  {
    route: "/today",
    title: "That's Tangent",
    body: "Add it, answer a question or two, and let Tangent place it. You can take this tour again from Settings → Onboarding.",
  },
];

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 8;

function findTarget(selectors?: string[]): HTMLElement | null {
  for (const sel of selectors ?? []) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export default function FeatureTour() {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = index === null ? null : STEPS[index];

  const end = useCallback(() => {
    setIndex(null);
    setRect(null);
    setActive(false);
    try {
      window.localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {}
  }, []);

  useEffect(() => {
    const start = () => {
      setActive(true);
      setReady(false);
      setIndex(0);
    };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);

  // Go to the step's page, then wait for its control to exist.
  useEffect(() => {
    if (!step) return;
    setReady(false);
    targetRef.current = null;
    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }
    let tries = 0;
    let timer = 0;
    const look = () => {
      const el = findTarget(step.target);
      if (el || !step.target || tries++ > 25) {
        targetRef.current = el;
        if (el) el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        window.setTimeout(() => setReady(true), el ? 260 : 0);
        return;
      }
      timer = window.setTimeout(look, 120);
    };
    // Give the page a beat to draw (its entrance animation) first.
    timer = window.setTimeout(look, 250);
    return () => window.clearTimeout(timer);
  }, [step, pathname, router, reduced]);

  // Track the control while it moves (scroll, resize, layout).
  useLayoutEffect(() => {
    if (!ready) return;
    let raf = 0;
    const measure = () => {
      const el = targetRef.current;
      if (el && el.isConnected) {
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && Math.abs(prev.x - r.left) < 0.5 && Math.abs(prev.y - r.top) < 0.5 && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
            ? prev
            : { x: r.left, y: r.top, w: r.width, h: r.height }
        );
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [ready, index]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        if (i === null) return i;
        const n = i + delta;
        if (n < 0) return 0;
        if (n >= STEPS.length) {
          window.setTimeout(end, 0);
          return i;
        }
        return n;
      });
    },
    [end]
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, end]);

  useEffect(() => {
    if (ready) cardRef.current?.focus();
  }, [ready, index]);

  if (index === null || !step || typeof document === "undefined") return null;

  const spot = ready && rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  // Below the spotlight if there's room, else above, else centred.
  // No transforms here: the card's own entrance animation owns transform.
  let cardStyle: React.CSSProperties = { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 110), width: cardW };
  if (spot) {
    const left = Math.min(Math.max(16, spot.x + spot.w / 2 - cardW / 2), vw - cardW - 16);
    if (spot.y + spot.h + 230 < vh) cardStyle = { left, top: spot.y + spot.h + 14, width: cardW };
    else if (spot.y > 240) cardStyle = { left, bottom: vh - spot.y + 14, width: cardW };
  }
  const isLast = index === STEPS.length - 1;
  const spring = reduced ? { duration: 0 } : ({ type: "spring", visualDuration: 0.4, bounce: 0 } as const);

  return createPortal(
    <div className="tour-root" aria-live="polite">
      <svg className="tour-scrim" width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <m.rect
                initial={false}
                // attrX/attrY move the rect itself; x/y would be a CSS
                // transform, which an SVG mask ignores.
                animate={{ attrX: spot.x, attrY: spot.y, width: spot.w, height: spot.h }}
                transition={spring}
                rx={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.42)" mask="url(#tour-hole)" />
      </svg>
      {spot && (
        <m.div
          className="tour-ring"
          initial={false}
          animate={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
          transition={spring}
          aria-hidden="true"
        />
      )}
      {/* Clicks outside the card are swallowed so the page underneath stays put. */}
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />

      <m.div
        key={index}
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        style={cardStyle}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: ready ? 1 : 0, y: 0 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
        <p className="tour-count">
          {index + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          {index === 0 ? (
            <button type="button" className="tour-quiet" onClick={end}>
              Not now
            </button>
          ) : (
            <button type="button" className="tour-quiet" onClick={() => go(-1)}>
              Back
            </button>
          )}
          <span className="tour-spacer" />
          {step.demo && (
            <button
              type="button"
              className="tour-secondary"
              onClick={() => {
                end();
                step.demo!.run();
              }}
            >
              {step.demo.label}
            </button>
          )}
          {isLast ? (
            <button type="button" className="tour-primary" onClick={end}>
              Done
            </button>
          ) : (
            <button type="button" className="tour-primary" onClick={() => go(1)}>
              {index === 0 ? "Start" : "Next"}
            </button>
          )}
        </div>
      </m.div>
    </div>,
    document.body
  );
}
