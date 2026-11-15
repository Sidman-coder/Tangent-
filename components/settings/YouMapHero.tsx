"use client";

// "You, mapped" as a scroll story (Round 4 Phase 4, item c): the map of you
// fills the settings window first. Scrolling turns it and lets it settle back
// while the title gives way to the six areas; then the cards with the facts
// themselves scroll in underneath. The stage is sticky inside a tall track and
// every value is derived from that track's scroll progress (motion's
// useScroll), so nothing animates on its own except the sphere's slow spin.
//
// Reduced motion: no tall track and no scroll-linked movement. The same
// picture sits still, with the title and the areas both showing.

import { useRef } from "react";
import { useReducedMotion, useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { ChevronDown } from "lucide-react";
import type { GroupedFacts, MapGroupKey } from "@/lib/you-map";
import YouOrbit from "./YouOrbit";

export default function YouMapHero({
  grouped,
  initials,
  summary,
  focus,
  onPick,
}: {
  grouped: GroupedFacts;
  initials: string;
  summary: string;
  focus: MapGroupKey | null;
  onPick: (group: MapGroupKey) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  // Through a function first: motion would otherwise hand the opacity fades to
  // a native ViewTimeline, whose keyframes (ending at 0.32 etc.) get an implied
  // last frame that snaps back to full opacity. This keeps them on the JS path.
  const p = useTransform(scrollYProgress, (v) => v);

  // 0 → 0.3: the title lifts away while the sphere turns.
  // 0.3 → 0.7: the sphere eases up into the space above the areas, which rise
  // in under it. It stays big: it settles, it doesn't shrink into a corner.
  const spin = useTransform(p, [0, 1], [0, Math.PI * 1.1]);
  const orbitScale = useTransform(p, [0, 0.3, 0.7], [1, 1, 0.92]);
  const orbitY = useTransform(p, [0.3, 0.7], ["0%", "-7%"]);
  const introOpacity = useTransform(p, [0, 0.28], [1, 0]);
  const introY = useTransform(p, [0, 0.28], [0, -40]);
  const cueOpacity = useTransform(p, [0, 0.1], [1, 0]);
  const areasOpacity = useTransform(p, [0.35, 0.65], [0, 1]);
  const areasY = useTransform(p, [0.35, 0.65], [32, 0]);

  const still = reduce;

  return (
    <div ref={track} className={`you-hero${still ? " is-still" : ""}`}>
      <div className="you-hero-stage">
        <m.div className="you-hero-orbit" style={still ? undefined : { scale: orbitScale, y: orbitY }}>
          <YouOrbit grouped={grouped} initials={initials} focus={focus} onPick={onPick} variant="hero" spin={still ? undefined : spin} />
        </m.div>

        <m.div className="you-hero-intro" style={still ? undefined : { opacity: introOpacity, y: introY }}>
          <p className="you-hero-kicker">What Tangent knows</p>
          <h2 id="knows-title" className="you-hero-title">You, mapped</h2>
          <p className="you-hero-summary">{summary}</p>
        </m.div>

        {!still && (
          <m.p className="you-hero-cue" style={{ opacity: cueOpacity }} aria-hidden="true">
            Scroll to explore
            <ChevronDown size={16} strokeWidth={1.75} />
          </m.p>
        )}

        <m.ul
          className="you-hero-areas"
          aria-label="Facts per area"
          style={still ? undefined : { opacity: areasOpacity, y: areasY }}
        >
          {grouped.map(({ group, facts }) => (
            <li key={group.key} style={{ "--c": `var(--series-${group.color})` } as React.CSSProperties}>
              <button type="button" onClick={() => onPick(group.key)}>
                <span className="you-map-swatch" aria-hidden="true" />
                <span className="you-hero-area-label">{group.label}</span>
                <b>{facts.length}</b>
              </button>
            </li>
          ))}
        </m.ul>
      </div>
    </div>
  );
}
