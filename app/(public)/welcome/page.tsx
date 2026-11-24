import type { Metadata } from "next";
import Link from "next/link";

// The landing page (overnight 2 Phase 5). Signed-out visitors to / see this
// with the address still reading / (middleware rewrite, lib/auth/gate.ts).
// Every line describes what the app does today; no invented numbers, quotes
// or logos. The "Why" example is a real line from a plan Tangent wrote in a
// test run (docs/overnight/screens/before/sim-maya-step10-real-plan.png).

export const metadata: Metadata = {
  title: "Tangent: plans around your week, then follows up",
  description:
    "The planner for high school students. Say what you need to do; Tangent plans it around your real week and checks in until it's done.",
};

const STEPS = [
  {
    n: "1",
    title: "Say it",
    body: "Tap the mic or type it: “chem final Dec 12” or “start a robotics club”. If the answer would change the plan, Tangent asks a question or two first. You can always skip.",
  },
  {
    n: "2",
    title: "It plans around your week",
    body: "Steps land on days that have room, around school, practice, work and your Canvas due dates. Nothing goes on your calendar until you confirm it.",
  },
  {
    n: "3",
    title: "It follows up",
    body: "The day after a step, it asks how it went. Your answer sizes the next steps, so the next round fits better than the last.",
  },
];

const FAQ = [
  {
    q: "Who is Tangent for?",
    a: "High school students, 13 and up. It's an invite-only pilot right now: request an invite and we'll let you in as space opens.",
  },
  {
    q: "What does it cost?",
    a: "Nothing during the pilot.",
  },
  {
    q: "Does it work with Canvas?",
    a: "Yes. Paste your Canvas calendar link and your due dates come in on their own, next to everything else. Tangent only reads that calendar; it never writes to Canvas and never sees your grades.",
  },
  {
    q: "What happens to what I tell it?",
    a: "It's used to plan for you and nothing else. You can read, change or delete what Tangent has learned in Settings, and delete everything at any time. No ads, and we never sell your information.",
  },
  {
    q: "Will it nag me?",
    a: "No streaks, no scores, no guilt. Check-ins are short and every one has a Skip. You choose when notifications come, or turn them off.",
  },
];

export default function WelcomePage() {
  return (
    <>
      <section className="pub-hero" aria-labelledby="hero-title">
        <div className="pub-hero-copy">
          <p className="pub-eyebrow">The planner for high school students</p>
          <h1 id="hero-title" className="pub-hero-title">
            Say what you need to do. Tangent plans it around your week.
          </h1>
          <p className="pub-lede">
            Tests, practice, clubs, a job, a big goal. Tangent turns it into small steps on the days that have room, then checks in until it&apos;s done.
          </p>
          <div className="pub-actions">
            <Link href="/signin?mode=create" className="ui-button ui-button--primary">
              Request an invite
            </Link>
            <Link href="/signin" className="ui-button ui-button--secondary">
              Sign in
            </Link>
          </div>
        </div>
        <figure className="pub-shot">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static screenshot; next/image would add nothing here */}
          <img
            src="/landing/plan-brief.png"
            width={720}
            height={900}
            alt="A Tangent plan for an AP Chem final: five dated steps, from confirming the scope on Saturday, December 5 to redoing every missed problem on Wednesday, December 9."
          />
          <figcaption>A real plan from a test run: one step at a time, each on its own day.</figcaption>
        </figure>
      </section>

      <section className="pub-section" aria-labelledby="how-title">
        <h2 id="how-title" className="pub-h2">
          How it works
        </h2>
        <ol className="pub-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="pub-step-n" aria-hidden="true">
                {s.n}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="pub-section pub-split" aria-labelledby="diff-title">
        <div>
          <h2 id="diff-title" className="pub-h2">
            It uses what you tell it
          </h2>
          <p className="pub-body">
            Most planners hand everyone the same advice. Tangent remembers what you said: when you work best, how much a school night can hold, what&apos;s already on your week. Every step shows the reason it&apos;s there, so you can see your own words in the plan and change them if they&apos;re wrong.
          </p>
        </div>
        <div className="pub-why" aria-label="Example step from a plan">
          <p className="pub-why-title">Solve 8 kinetics mechanism problems</p>
          <p className="pub-why-meta">Fri, Nov 20 · 7:00 PM</p>
          <p className="pub-why-line">
            <span>Why</span> You said you work best in the evenings, and Friday is a school-day slot with no commitments, so it fits a problem set.
          </p>
          <p className="pub-why-line">
            <span>Because</span> you said you like to work in the evenings
          </p>
        </div>
      </section>

      <section className="pub-section pub-parents" aria-labelledby="parents-title">
        <h2 id="parents-title" className="pub-h2">
          For parents
        </h2>
        <ul className="pub-list">
          <li>Plans around school hours, practice and the commitments your teen tells it about.</li>
          <li>No ads, and we never sell your teen&apos;s information. Their plans are private to them.</li>
          <li>For ages 13 and up. Your teen can see and delete everything Tangent learns, any time.</li>
        </ul>
        <Link href="/parents" className="pub-more">
          Read the parents&apos; page
        </Link>
      </section>

      <section className="pub-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="pub-h2">
          Questions
        </h2>
        <div className="pub-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pub-cta" aria-labelledby="cta-title">
        <h2 id="cta-title" className="pub-h2">
          Plan your week around you.
        </h2>
        <p className="pub-body">Free during the pilot. Ages 13 and up.</p>
        <div className="pub-actions">
          <Link href="/signin?mode=create" className="ui-button ui-button--primary">
            Request an invite
          </Link>
          <Link href="/signin" className="ui-button ui-button--secondary">
            I have an account
          </Link>
        </div>
      </section>
    </>
  );
}
