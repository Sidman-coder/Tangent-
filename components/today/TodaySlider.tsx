"use client";

// One small slider under Today's input, in place of the rows that used to stack
// up there: the day at a glance, where the next thing goes, and what Tangent
// wants to know. It never grows past 120px.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { AddDestination } from "@/components/add/AddFlow";
import { planSeriesColor } from "@/lib/task-colors";
import type { Plan } from "@/lib/types";

const SLIDE_KEY = "tangent-today-slide";
const SWIPE_PX = 40;

type SlideId = "glance" | "send" | "tangent";
const SLIDE_LABEL: Record<SlideId, string> = { glance: "Today at a glance", send: "Send to", tangent: "From Tangent" };
export type SendMode = "auto" | "calendar" | "project";

type Props = {
  glance: string;
  onGlance: () => void;
  plans: readonly Plan[];
  destination: AddDestination | null;
  onDestination: (destination: AddDestination | null) => void;
  questionCount: number;
  onAnswer: () => void;
  setupLeft: number;
  onHideSetup: () => void;
};

function readSlide(): SlideId {
  try {
    const saved = window.sessionStorage.getItem(SLIDE_KEY);
    if (saved === "send" || saved === "tangent") return saved;
  } catch {}
  return "glance";
}

export default function TodaySlider({ glance, onGlance, plans, destination, onDestination, questionCount, onAnswer, setupLeft, onHideSetup }: Props) {
  const hasFromTangent = questionCount > 0 || setupLeft > 0;
  const slides: SlideId[] = hasFromTangent ? ["glance", "send", "tangent"] : ["glance", "send"];
  const [wanted, setWanted] = useState<SlideId>("glance");
  const [projectOpen, setProjectOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => setWanted(readSlide()), []);

  // An emptied third slide falls back to the first.
  const slide = slides.includes(wanted) ? wanted : "glance";
  const index = slides.indexOf(slide);

  const go = (next: SlideId) => {
    setWanted(next);
    try {
      window.sessionStorage.setItem(SLIDE_KEY, next);
    } catch {}
  };
  const step = (by: number) => {
    const next = slides[index + by];
    if (next) go(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    else return;
    event.preventDefault();
  };

  // The choice applies to the next thing sent; afterwards it's Auto again, so
  // the Project row closes with it.
  const mode: SendMode = destination?.dest ?? (projectOpen ? "project" : "auto");
  useEffect(() => {
    if (!destination) setProjectOpen(false);
  }, [destination]);

  const setMode = (next: SendMode) => {
    setProjectOpen(next === "project");
    if (next === "auto" || next === "project") onDestination(null);
    if (next === "calendar") onDestination({ dest: "calendar", label: "Calendar" });
  };

  return (
    <div
      className="today-slider"
      role="group"
      aria-roledescription="carousel"
      aria-label="Today at a glance, where things go, and notes from Tangent"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const from = touchX.current;
        touchX.current = null;
        const to = e.changedTouches[0]?.clientX;
        if (from === null || to === undefined || Math.abs(to - from) < SWIPE_PX) return;
        step(to < from ? 1 : -1);
      }}
    >
      <div className="today-slider-frame">
        <button type="button" className="today-slider-arrow" aria-label="Previous" disabled={index === 0} onClick={() => step(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <div key={slide} className="today-slide" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}: ${SLIDE_LABEL[slide]}`}>
          {slide === "glance" && (
            <button type="button" className="today-slide-glance" onClick={onGlance}>
              {glance}
            </button>
          )}

          {slide === "send" && (
            <>
              <div className="today-send">
                <span className="today-send-label" id="today-send-label">Send to</span>
                <div className="today-seg" role="radiogroup" aria-labelledby="today-send-label">
                  {(["auto", "calendar", "project"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={mode === option}
                      className={mode === option ? "is-on" : undefined}
                      onClick={() => setMode(option)}
                    >
                      {option === "auto" ? "Auto" : option === "calendar" ? "Calendar" : "Project"}
                    </button>
                  ))}
                </div>
              </div>
              {mode === "project" && (
                <div className="today-chips" role="group" aria-label="Choose a project">
                  {plans.map((plan) => {
                    const on = destination?.projectId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`today-chip${on ? " is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => onDestination({ dest: "project", projectId: plan.id, label: plan.title, color: planSeriesColor(plan) })}
                      >
                        <span className="today-chip-dot" style={{ background: planSeriesColor(plan) }} aria-hidden="true" />
                        {plan.title}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`today-chip${destination?.projectId === "new" ? " is-on" : ""}`}
                    aria-pressed={destination?.projectId === "new"}
                    onClick={() => onDestination({ dest: "project", projectId: "new", label: "New project" })}
                  >
                    New project
                  </button>
                </div>
              )}
            </>
          )}

          {slide === "tangent" && (
            <div className="today-from">
              {questionCount > 0 && (
                <div className="today-from-row">
                  <span>
                    {questionCount} question{questionCount === 1 ? "" : "s"} to improve your plans
                  </span>
                  <button type="button" className="today-from-go" onClick={onAnswer}>Answer</button>
                </div>
              )}
              {setupLeft > 0 && (
                <div className="today-from-row">
                  <span>Finish setting up ({setupLeft} left)</span>
                  <span className="today-from-actions">
                    <Link href="/settings/context" className="today-from-go">Open</Link>
                    <button type="button" className="today-from-hide" aria-label="Hide Finish setting up" onClick={onHideSetup}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" className="today-slider-arrow" aria-label="Next" disabled={index === slides.length - 1} onClick={() => step(1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="today-dots">
        {slides.map((id, i) => (
          <button
            key={id}
            type="button"
            className={`today-dot${id === slide ? " is-on" : ""}`}
            aria-label={`Slide ${i + 1} of ${slides.length}: ${SLIDE_LABEL[id]}`}
            aria-current={id === slide ? "true" : undefined}
            onClick={() => go(id)}
          />
        ))}
      </div>
    </div>
  );
}
