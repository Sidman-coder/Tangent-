import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/public/PublicLinks";

// Privacy policy (overnight 2 Phase 5). Text from the founders' draft
// (Overnight 2/tangent-legal-pages-draft.md); every [VERIFY] item was checked
// against the code and the providers' current pages; sources and the items
// still open are in docs/overnight2/NEEDS-SID.md ("Legal pages").

export const metadata: Metadata = {
  title: "Privacy policy · Tangent",
  description: "What Tangent collects, why, who helps run it, and how to see or delete your information.",
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const COLLECT: [string, React.ReactNode][] = [
  ["Your email address, and your name if you give it (or from Google sign-in)", "To create your account, sign you in and contact you about Tangent."],
  ["Your password, stored only in scrambled (hashed) form by our sign-in provider", "To sign you in."],
  [
    "Your answer to the age question when you sign up",
    "To make sure Tangent is right for your age. If you're 13 or older, the answer isn't stored. If you're under 13, we store only that, so the account stays closed.",
  ],
  ["Tasks, projects, plans, notes and calendar items you create", "This is the app: so Tangent can plan and remind you."],
  ["What you type or say to Tangent's chat, and your answers to its questions", "To answer you and make your plans fit you."],
  [
    "Facts Tangent learns about how you work (for example “you work best in the evening”)",
    "To personalize plans. You can see, edit and delete these in Settings, What Tangent knows.",
  ],
  [
    "Activity signals, such as when you finish, move or skip a step. Stored as simple codes, not your words",
    "To learn what timing and step sizes work for you.",
  ],
  [
    "Your Canvas calendar feed link and the due dates it brings in, if you connect Canvas",
    "To plan around your assignments. The link is never shown back in full and is left out of your data download.",
  ],
  [
    "Your voice, when you use the microphone",
    "Turned into text so Tangent can understand you. Tangent doesn't keep the audio. It keeps the words of your last 100 voice commands, so it can act on them and you can undo.",
  ],
  ["Basic technical data: time zone, device and browser type, error logs", "To show the right times and fix problems."],
];

const PROVIDERS: [string, React.ReactNode][] = [
  ["Supabase", "Stores your account and app data, and handles sign-in."],
  ["Vercel", "Hosts the Tangent website and app."],
  [
    "Anthropic (Claude AI)",
    "Reads what you type, plus the context needed for that task (for example your upcoming tasks), to write answers and plans. Under Anthropic's commercial terms it doesn't train its models on this, and it deletes it within 30 days (longer only if a request is flagged under its usage policy).",
  ],
  [
    "Deepgram",
    "Turns your voice into text. Every request opts out of Deepgram's model-improvement program, so Deepgram keeps the audio only as long as it takes to process it.",
  ],
  ["Google", "Sign in with Google, if you choose it."],
  ["Instructure (Canvas)", "Only if you connect it. Tangent reads your Canvas calendar feed; it doesn't write to Canvas."],
];

function Table({ head, rows }: { head: [string, string]; rows: [string, React.ReactNode][] }) {
  return (
    <div className="pub-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{head[0]}</th>
            <th scope="col">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <article className="pub-doc">
      <h1>Privacy policy</h1>
      <p className="pub-doc-date">Effective November 22, 2026 · Last updated November 22, 2026</p>

      <p>
        Tangent helps high school students turn what they need to do into small steps on their calendar, and follows up until it&apos;s done. This policy explains what we
        collect, why, who helps us run Tangent, and how you can see or delete your information. We wrote it in plain language. If anything is unclear, email <Mail />.
      </p>

      <h2>Who can use Tangent</h2>
      <p>
        Tangent is for students <strong>13 and older</strong>. If you&apos;re under 13, please don&apos;t use Tangent. If we learn that someone under 13 has signed up, we
        block the account and delete its information. If you&apos;re under 18, we encourage you to read this policy with a parent or guardian. Tangent is currently an
        invite-only pilot.
      </p>

      <h2>What we collect</h2>
      <Table head={["What", "Why"]} rows={COLLECT} />
      <p>
        <strong>We don&apos;t collect</strong> your location, contacts or photos. <strong>We don&apos;t show ads, and we never sell your information.</strong>
      </p>
      <p>We ask you not to share health, medical or family matters with Tangent. If you do, Tangent tries not to save them.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run Tangent: capture, plans, reminders, check-ins and follow-ups.</li>
        <li>To personalize your plans to your schedule and how you work.</li>
        <li>To keep Tangent safe and working, and to fix bugs.</li>
        <li>To contact you about your account.</li>
      </ul>
      <p>We don&apos;t use your information for advertising. We don&apos;t use it to build profiles for anyone else.</p>

      <h2>Who helps us run Tangent</h2>
      <p>We share information only with companies that help us run Tangent, and only what they need:</p>
      <Table head={["Provider", "What they do"]} rows={PROVIDERS} />
      <p>These providers may process data in the United States. We may also share information if the law requires it, or to protect someone&apos;s safety.</p>

      <h2>Your choices and controls</h2>
      <ul>
        <li>
          <strong>See and edit</strong> what Tangent has learned: Settings, What Tangent knows.
        </li>
        <li>
          <strong>Forget</strong> what Tangent has learned (facts and noticed habits): Settings, What Tangent knows, Forget everything.
        </li>
        <li>
          <strong>Disconnect</strong> Canvas any time; you can also remove what it brought in.
        </li>
        <li>
          <strong>Download</strong> your data: Settings, Your data.
        </li>
        <li>
          <strong>Delete</strong> your data, or your whole account: Settings, Your data.
        </li>
        <li>
          <strong>Notifications:</strong> choose when they come, or turn them off, in Settings, Notifications.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is open. When you delete your data or your account, we delete it from our systems <strong>within 30 days</strong>,
        including logs. Records of what the AI decided are deleted automatically after 90 days, even if you keep your account.
      </p>

      <h2>Security</h2>
      <p>
        We use encrypted connections and access controls so each student can reach only their own data. No system is perfectly secure. If something goes wrong that
        affects your information, we&apos;ll tell you.
      </p>

      <h2>Parents and guardians</h2>
      <p>
        A parent or guardian can email <Mail /> to ask what we hold about their teen, or to ask us to delete it. See our <Link href="/parents">For parents</Link> page.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy in an important way, we&apos;ll tell you in the app before the change applies.</p>

      <h2>Contact</h2>
      <p>
        <Mail />
      </p>
    </article>
  );
}
