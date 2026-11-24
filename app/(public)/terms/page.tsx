import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/public/PublicLinks";

// Terms of use (overnight 2 Phase 5), from the founders' draft
// (Overnight 2/tangent-legal-pages-draft.md). Not legal advice; a lawyer or
// template service should review before a wider launch (NEEDS-SID).

export const metadata: Metadata = {
  title: "Terms of use · Tangent",
  description: "The rules for using Tangent during the invite-only pilot.",
};

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export default function TermsPage() {
  return (
    <article className="pub-doc">
      <h1>Terms of use</h1>
      <p className="pub-doc-date">Effective November 22, 2026 · Last updated November 22, 2026</p>

      <p>These terms are the rules for using Tangent. By using Tangent you agree to them. If you&apos;re under 18, please read them with a parent or guardian.</p>

      <ol>
        <li>
          <strong>Who can use Tangent.</strong> You must be 13 or older. Tangent is currently invite-only and free during the pilot.
        </li>
        <li>
          <strong>Your account.</strong> Keep your sign-in private. You&apos;re responsible for what happens in your account. Tell us at <Mail /> if you think someone else
          is using it.
        </li>
        <li>
          <strong>Your content.</strong> What you put into Tangent is yours. You let us store and process it only to run Tangent for you, as described in our{" "}
          <Link href="/privacy">Privacy policy</Link>.
        </li>
        <li>
          <strong>AI suggestions.</strong> Tangent uses AI to suggest plans and answers. AI can be wrong. Use your own judgment, and check important dates and requirements
          with your teachers or school. Tangent isn&apos;t a substitute for professional, medical or mental-health advice.
        </li>
        <li>
          <strong>Fair use.</strong> Don&apos;t misuse Tangent. That means:
          <ul>
            <li>don&apos;t try to break it</li>
            <li>don&apos;t access other people&apos;s data</li>
            <li>don&apos;t use it to harass anyone</li>
            <li>don&apos;t share anything illegal</li>
            <li>don&apos;t overload it with automated requests</li>
          </ul>
          During the pilot, AI use has fair daily limits.
        </li>
        <li>
          <strong>Connections.</strong> If you connect Canvas or other services, their own terms also apply. You can disconnect any time.
        </li>
        <li>
          <strong>Changes and availability.</strong> Tangent is a pilot and may change, pause or have bugs. We may update these terms and will tell you in the app about
          important changes.
        </li>
        <li>
          <strong>Ending.</strong> You can stop using Tangent and delete your account any time in Settings. We may suspend accounts that break these terms.
        </li>
        <li>
          <strong>No warranty; limits.</strong> Tangent is provided &ldquo;as is&rdquo;. To the extent the law allows, we aren&apos;t responsible for missed deadlines,
          grades or other results from using or relying on Tangent.
        </li>
        <li>
          <strong>Law.</strong> These terms are governed by the laws of the State of Georgia, USA.
        </li>
        <li>
          <strong>Contact.</strong> <Mail />
        </li>
      </ol>
    </article>
  );
}
