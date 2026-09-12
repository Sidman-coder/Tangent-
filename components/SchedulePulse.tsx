import { CalendarRange, Clock3, TrendingUp } from "lucide-react";
import type { ScheduleInsight } from "@/lib/schedule-insights";

const TONE_ICON = {
  neutral: CalendarRange,
  positive: TrendingUp,
  warning: Clock3,
};

export default function SchedulePulse({ insight }: { insight: ScheduleInsight }) {
  const Icon = TONE_ICON[insight.tone];

  return (
    <section className={`schedule-pulse schedule-pulse--${insight.tone}`} aria-labelledby="schedule-pulse-title">
      <div className="schedule-pulse-icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div>
        <span className="schedule-pulse-label">Schedule pulse</span>
        <h2 id="schedule-pulse-title" className="schedule-pulse-title">{insight.title}</h2>
        <p className="schedule-pulse-detail">{insight.detail}</p>
      </div>
    </section>
  );
}
