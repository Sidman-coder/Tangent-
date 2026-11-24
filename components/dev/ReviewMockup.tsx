// STATIC MOCKUP, sample data only (overnight Phase 4.5). Nothing here reads or
// writes anything: no fetch, no storage, buttons do nothing. It shows what the
// post-event review could look like if Sid approves the plan in
// docs/overnight/NEEDS-SID.md ("Post-event reviews"). Reuses the existing
// question-card classes (tg-clarify, tg-chip) so it looks like the rest of Tangent.
// Reached at /dev/app/review-mockup (development only; 404 in production).

const SAMPLE_EVENT = "AP Chem unit 4 test";

const WEEK = [
  { id: "r1", day: "Mon", title: "AP Chem unit 4 test", takeaway: "Rushed the last two questions. Next test, skip and come back." },
  { id: "r2", day: "Wed", title: "Debate round 2", takeaway: "Opening felt good. Rebuttals were the weak spot." },
  { id: "r3", day: "Fri", title: "Soccer vs. Lincoln", takeaway: "Tired by half time. Sleep before games helped last time." },
];

function Section({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>{label}</h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>{note}</p>
      {children}
    </section>
  );
}

/** Home card: one row, only when a review is due. Both exits are quiet. */
function HomeCard() {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>How did {SAMPLE_EVENT} go?</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-3)" }}>Two quick questions, under a minute.</p>
      </div>
      <button type="button" className="tg-clarify-btn is-primary" style={{ minHeight: 44 }}>Answer</button>
      <button type="button" className="tg-clarify-quiet">Not now</button>
    </div>
  );
}

/** A fixed question (free tier). Same Skip and Stop as every Tangent question. */
function QuestionCard({ n, question, options, ai }: { n: number; question: string; options: string[]; ai?: boolean }) {
  return (
    <div className="tg-clarify slot-card" role="group" aria-label={`Review question ${n} of 3`}>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-3)" }}>
        {SAMPLE_EVENT} · question {n} of 3{ai ? " · follow-up" : ""}
      </p>
      <fieldset className="tg-clarify-q" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{question}</legend>
        <div className="tg-clarify-options">
          {options.map((o, i) => (
            <button key={o} type="button" className={`tg-chip${i === 1 ? " is-on" : ""}`}>{o}</button>
          ))}
          <button type="button" className="tg-chip is-ghost">Say or type your own</button>
        </div>
      </fieldset>
      <div className="tg-clarify-actions">
        <button type="button" className="tg-clarify-btn is-primary">Next</button>
        <button type="button" className="tg-clarify-quiet">Skip</button>
        <button type="button" className="tg-clarify-quiet">Stop</button>
      </div>
    </div>
  );
}

/** Weekly "what you've learned": the student's own words, each editable and deletable. */
function WeekView() {
  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 12 }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>What you&apos;ve learned this week</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-3)" }}>Only you can see this. Edit or delete anything.</p>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {WEEK.map((r) => (
          <li key={r.id} style={{ display: "grid", gap: 4, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{r.day} · {r.title}</span>
            <span style={{ color: "var(--text)" }}>{r.takeaway}</span>
            <span style={{ display: "flex", gap: 14 }}>
              <button type="button" className="tg-clarify-quiet">Edit</button>
              <button type="button" className="tg-clarify-quiet">Delete</button>
            </span>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
        Tangent will use this: your next test plan puts a practice run of the last questions first.
      </p>
    </div>
  );
}

/** The opt-in row in Settings. Off by default; one switch per event type. */
function OptInRow() {
  const types: { label: string; on: boolean }[] = [
    { label: "Tests and quizzes", on: true },
    { label: "Presentations and performances", on: true },
    { label: "Games and competitions", on: false },
    { label: "Interviews", on: false },
    { label: "Project due dates", on: false },
  ];
  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>After-event check-ins</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-3)" }}>
          After something you pick, Tangent asks how it went. At most one a day, never at night or while you&apos;re busy.
        </p>
      </div>
      {types.map((t) => (
        <label key={t.label} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, color: "var(--text)" }}>
          <input type="checkbox" defaultChecked={t.on} style={{ width: 20, height: 20 }} />
          {t.label}
        </label>
      ))}
    </div>
  );
}

export default function ReviewMockup() {
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "16px 16px 120px", display: "grid", gap: 28 }}>
      <header style={{ display: "grid", gap: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, margin: 0, color: "var(--text)" }}>Post-event reviews (mockup)</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>Sample data only. Nothing here is saved and the buttons do nothing.</p>
      </header>
      <Section label="1. Settings: opt in by event type" note="Off until the student turns a type on.">
        <OptInRow />
      </Section>
      <Section label="2. Home: one card, only when a review is due" note="Not a notification and not a new screen. It sits where the Canvas row sits and goes away after 48 hours.">
        <HomeCard />
      </Section>
      <Section label="3. Free: three fixed questions" note="Tap a chip, or say or type your own. Skip and Stop on every one.">
        <QuestionCard n={1} question="How did it go?" options={["Better than expected", "About right", "Harder than I thought"]} />
        <QuestionCard n={2} question="What got in the way?" options={["Ran out of time", "Blanked on a topic", "Nothing, it was fine"]} />
      </Section>
      <Section label="4. Paid: one AI follow-up in place of a fixed question" note="Written from the student's answer and their plan, never a long chat.">
        <QuestionCard n={3} question="You said you ran out of time. Was it the last section, or all the way through?" options={["The last section", "All the way through"]} ai />
      </Section>
      <Section label="5. Weekly: what you've learned" note="Reached from You, mapped. Each line is the student's own takeaway, linked to the event and the goal.">
        <WeekView />
      </Section>
    </div>
  );
}
