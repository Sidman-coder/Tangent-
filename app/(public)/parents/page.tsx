import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/public/PublicLinks";

// For parents (overnight 2 Phase 5), from the founders' draft
// (Overnight 2/tangent-legal-pages-draft.md).

export const metadata: Metadata = {
  title: "For parents · Tangent",
  description: "What Tangent does for your teen, what it never does, and how to ask us anything.",
};

export default function ParentsPage() {
  return (
    <article className="pub-doc">
      <h1>For parents</h1>
      <p className="pub-doc-date">Effective November 22, 2026</p>

      <h2>Tangent helps your teen follow through</h2>
      <p>
        Teens have a lot going on: classes, tests, practice, clubs, jobs. Tangent turns what they need to do (&ldquo;chem final Dec 12&rdquo;, &ldquo;start a robotics
        club&rdquo;) into small, realistic steps on their calendar, planned around their real schedule. Then it checks in until the work is done.
      </p>

      <h2>What Tangent does</h2>
      <ul>
        <li>Plans around school hours, practice and other commitments your teen tells it about.</li>
        <li>Breaks big goals into steps of about a week at a time, and adjusts based on how it went.</li>
        <li>Sends short, pressure-free check-ins. No streaks, no scores, no guilt.</li>
      </ul>

      <h2>What Tangent never does</h2>
      <ul>
        <li>No ads, and we never sell your teen&apos;s information.</li>
        <li>No grades or school records. If your teen connects Canvas, Tangent reads only the calendar of due dates.</li>
        <li>No sharing with teachers, schools or parents. A teen&apos;s plans and notes are private to them.</li>
      </ul>

      <h2>Privacy, in short</h2>
      <ul>
        <li>
          For ages <strong>13 and up</strong>. Under 13 can&apos;t use it.
        </li>
        <li>Your teen can see, edit and delete everything Tangent learns about them, and delete their account in the app.</li>
        <li>
          AI is provided by Anthropic (text) and Deepgram (voice), only to run Tangent. Neither trains its models on what Tangent sends. Details are in our{" "}
          <Link href="/privacy">Privacy policy</Link>.
        </li>
      </ul>

      <h2>Cost</h2>
      <p>Free during the invite-only pilot.</p>

      <h2>Questions or deletion requests</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We reply personally.
      </p>
    </article>
  );
}
