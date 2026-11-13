"use client";

// Round 4 §3.3: the planning workspace. When the Home composer starts planning
// (a goal typed or said, or the onboarding goal), it opens up into two panes:
// the talk on the left (Q&A, then "Tell me anything about this") and the plan
// on the right (the calendar preview and "How this plan works"). On a phone
// the panes stack behind Chat / Plan tabs. AddFlow owns all the state; this
// only lays it out.

import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

export type Pane = "chat" | "plan";
export type TalkMode = "plan" | "talk";

export function ModeToggle({ mode, onChange, disabled }: { mode: TalkMode; onChange: (m: TalkMode) => void; disabled?: boolean }) {
  return (
    <div className="plan-ws-toggle" role="radiogroup" aria-label="What should Tangent do">
      {(
        [
          { id: "plan", label: "Plan it" },
          { id: "talk", label: "Just talk" },
        ] as const
      ).map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          className={mode === o.id ? "is-on" : ""}
          onClick={() => onChange(o.id)}
          disabled={disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function HowThisPlanWorks({ steps, basedOn }: { steps: number | null; basedOn: string[] }) {
  return (
    <section className="plan-ws-how" aria-labelledby="plan-ws-how-title">
      <h3 id="plan-ws-how-title">How this plan works</h3>
      <dl>
        <dt>Round 1 gets you</dt>
        <dd>{steps ? `${steps} step${steps === 1 ? "" : "s"} over about a week` : "3 to 7 steps over about a week"}, at the times you usually get things done.</dd>
        <dt>Based on</dt>
        <dd>
          {basedOn.length ? (
            <ul>
              {basedOn.slice(0, 5).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            "Your goal and your calendar so far."
          )}
        </dd>
      </dl>
      <p className="plan-ws-how-next">When you finish these, tell Tangent how they went and it plans the next round.</p>
    </section>
  );
}

export function CalendarPlaceholder({ working }: { working: boolean }) {
  return (
    <div className="plan-ws-cal-empty">
      <CalendarDays size={22} strokeWidth={1.75} aria-hidden="true" />
      <p>{working ? "Placing round 1 on your calendar…" : "Round 1 shows here once Tangent has enough to plan it."}</p>
    </div>
  );
}

export default function PlanWorkspace({
  title,
  head,
  pane,
  onPane,
  chat,
  plan,
}: {
  title: string;
  head: ReactNode;
  pane: Pane;
  onPane: (p: Pane) => void;
  chat: ReactNode;
  plan: ReactNode;
}) {
  return (
    <>
      <div className="plan-ws-head">
        <p className="plan-ws-title" title={title}>
          <span>Planning</span> {title}
        </p>
        {head}
      </div>
      <div className="plan-ws-tabs" role="tablist" aria-label="Planning">
        {(["chat", "plan"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`plan-ws-tab-${p}`}
            aria-selected={pane === p}
            aria-controls={`plan-ws-pane-${p}`}
            className={pane === p ? "is-on" : ""}
            onClick={() => onPane(p)}
          >
            {p === "chat" ? "Chat" : "Plan"}
          </button>
        ))}
      </div>
      <div className="plan-ws-panes">
        <div className="plan-ws-left" id="plan-ws-pane-chat" role="tabpanel" aria-labelledby="plan-ws-tab-chat" data-active={pane === "chat"}>
          {chat}
        </div>
        <div className="plan-ws-right" id="plan-ws-pane-plan" role="tabpanel" aria-labelledby="plan-ws-tab-plan" data-active={pane === "plan"}>
          {plan}
        </div>
      </div>
    </>
  );
}
