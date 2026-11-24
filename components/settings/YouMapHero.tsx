"use client";

// "You, mapped" (Round 5B Phase 2): the map sits on an ivory stage at the top
// of What Tangent knows. Scrolling past it turns the sphere a little (motion's
// useScroll on the stage); dragging turns it by hand; clicking an area or a
// point drills in. The title steps aside while an area or fact is open.
//
// Round 4's tall sticky track is gone: the map is now something you explore
// in place, so it can't also be a scroll-jacked story. The area chips under
// it stay, as white pills with a pastel dot.
//
// Reduced motion: no scroll-linked turn and no drift; the same picture still.

import { useRef } from "react";
import { useReducedMotion, useScroll, useTransform } from "motion/react";
import type { GroupedFacts, MapGroupKey } from "@/lib/you-map";
import type { MapLink, PlanRef } from "@/lib/you-map-links";
import YouMap, { type MapLevel } from "./YouMap";

export default function YouMapHero({
  grouped,
  initials,
  summary,
  focus,
  plans,
  links,
  usedBy,
  level,
  onLevel,
  onPick,
  glowIds,
}: {
  grouped: GroupedFacts;
  initials: string;
  summary: string;
  focus: MapGroupKey | null;
  plans: readonly PlanRef[];
  links: readonly MapLink[];
  usedBy: Record<string, PlanRef[]>;
  level: MapLevel;
  onLevel: (level: MapLevel) => void;
  /** An area chip under the map: open it on the map and show its card. */
  onPick: (group: MapGroupKey) => void;
  glowIds?: ReadonlySet<string>;
}) {
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "end start"] });
  const spin = useTransform(scrollYProgress, [0, 1], [-0.8, 0.8]);

  return (
    <div className={`you-hero${reduce ? " is-still" : ""}`}>
      <div ref={stage} className="you-hero-stage">
        <YouMap
          grouped={grouped}
          initials={initials}
          plans={plans}
          links={links}
          usedBy={usedBy}
          level={level}
          onLevel={onLevel}
          focus={focus}
          spin={reduce ? undefined : spin}
          glowIds={glowIds}
        />
        <div className={`you-hero-intro${level.kind === "root" ? "" : " is-away"}`}>
          <h2 id="knows-title" className="you-hero-title">You, mapped</h2>
          <p className="you-hero-summary">{summary}</p>
        </div>
        <p className={`you-hero-hint${level.kind === "root" ? "" : " is-away"}`} aria-hidden="true">
          Drag to turn · pick an area to open it
        </p>
      </div>

      <ul
        className="you-hero-areas"
        aria-label="Areas"
        onKeyDown={(e) => {
          // Escape on a chip steps the map back out, as it does on the map itself.
          if (e.key !== "Escape" || level.kind === "root") return;
          e.preventDefault();
          onLevel(level.kind === "fact" ? { kind: "area", key: level.key } : { kind: "root" });
        }}
      >
        {grouped.map(({ group, facts }) => (
          <li key={group.key} style={{ "--c": `var(--map-${group.color})` } as React.CSSProperties}>
            <button type="button" onClick={() => onPick(group.key)} aria-pressed={level.kind !== "root" && level.key === group.key}>
              <span className="you-map-pill-dot" aria-hidden="true" />
              <span className="you-hero-area-label">{group.label}</span>
              {/* F09: no count here; it shows once, on the area's card. */}
              {facts.length === 0 && <span className="you-hero-area-none">Not asked yet</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
