import { CalendarCheck2, Mic, MessageCircleQuestion, Orbit, Scale } from "lucide-react";
import TangentLogo from "@/components/TangentLogo";
import "./auth.css";

// The first thing anyone sees: what Tangent is, then the way in. Every line
// here describes something the app actually does today.
const POINTS = [
  { icon: Mic, title: "Say it, it's saved", body: "Tap the mic and talk. Tangent turns it into a task on the right day in about a second." },
  { icon: MessageCircleQuestion, title: "It asks before it guesses", body: "Big or vague? A couple of sharp questions first, built from what it already knows about you." },
  { icon: Scale, title: "No day gets buried", body: "It knows how much you can handle and puts new work on lighter days." },
  { icon: CalendarCheck2, title: "Canvas, handled", body: "Assignments and due dates flow in on their own, next to everything else." },
  { icon: Orbit, title: "Built for the long game", body: "Map the path to a college, a rating or a career, and branch off ideas you can keep." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-pitch" aria-label="What Tangent is">
        <div className="auth-brand">
          <TangentLogo size={34} />
          <span className="auth-brand-word">Tangent</span>
        </div>
        <h2 className="auth-headline">Your week, planned around you.</h2>
        <p className="auth-sub">The planner for high school students that listens, asks the right questions, and spaces everything out so nothing piles up.</p>
        <ul className="auth-features">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="auth-feature-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span>
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="auth-card">{children}</div>
    </main>
  );
}
