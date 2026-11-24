"use client";

// Client like the other Settings pages: SettingsPageHeader reads the nav list
// from a client module, which a server page can't call.
import Link from "next/link";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";
import { CONTACT_EMAIL } from "@/components/public/PublicLinks";
import TourRow from "@/components/settings/TourRow";

// Settings, Help and privacy (overnight 2 Phases 5 and 6): where a student's
// words go, in plain words, then the policies and how to reach a person.
// Every line matches the code: Anthropic for text (lib/ai), Deepgram for voice
// with mip_opt_out on every request (lib/deepgram.ts, hooks/useVoiceCapture.ts).

export default function HelpPrivacySettingsPage() {
  return (
    <>
      <SettingsPageHeader page="privacy" />

      <SettingsSection id="where-words-go" title="Where your words go" description="Only to run Tangent for you. No ads, and nothing is sold.">
        <SettingRow
          label="What you type"
          help="Goes to Anthropic's Claude, with the tasks and facts that request needs, to write answers and plans. Anthropic doesn't train on it and deletes it within 30 days."
        />
        <SettingRow
          label="What you say"
          help="Your voice goes to Deepgram to become text. Every request opts out of Deepgram's model training, and Tangent doesn't keep the audio."
        />
        <SettingRow
          label="What Tangent keeps"
          help={
            <>
              Your plans, the facts in <Link href="/settings/context">What Tangent knows</Link>, and short codes for how steps went. See it all, download it or delete
              it in <Link href="/settings/data">Your data</Link>.
            </>
          }
        />
      </SettingsSection>

      {/* Overnight 2, Phase 6: the three controls, in plain words. */}
      <SettingsSection id="your-controls" title="What you can take back" description="Each one works on its own, any time.">
        <SettingRow
          label="Habits Tangent noticed"
          help={
            <>
              From what you do with steps (done, skipped, moved) Tangent learns your pace, best hours and days. It never reads what your steps say. See them under
              Tangent noticed in <Link href="/settings/context">What Tangent knows</Link>, and forget any one.
            </>
          }
        />
        <SettingRow
          label="Disconnect Canvas"
          help={
            <>
              In <Link href="/settings/schedule#connections">Connections</Link>. Tangent deletes your feed link right away and asks whether the Canvas items go too.
            </>
          }
        />
        <SettingRow
          label="Forget everything"
          help={
            <>
              At the bottom of <Link href="/settings/context">What Tangent knows</Link>. Deletes every fact and the habits Tangent noticed. Your tasks, projects and
              chats stay. To delete your whole account, use <Link href="/settings/data">Your data</Link>.
            </>
          }
        />
      </SettingsSection>

      <SettingsSection id="policies" title="Policies">
        <SettingRow label="Privacy policy" help="What Tangent collects, why, and how to delete it.">
          <Link href="/privacy" className="ui-button ui-button--secondary ui-button--sm" aria-label="Read the privacy policy">
            Read
          </Link>
        </SettingRow>
        <SettingRow label="Terms of use" help="The rules for using Tangent during the pilot.">
          <Link href="/terms" className="ui-button ui-button--secondary ui-button--sm" aria-label="Read the terms of use">
            Read
          </Link>
        </SettingRow>
        <SettingRow label="For parents" help="A page to share with a parent or guardian.">
          <Link href="/parents" className="ui-button ui-button--secondary ui-button--sm" aria-label="Read the page for parents">
            Read
          </Link>
        </SettingRow>
      </SettingsSection>

      <SettingsSection id="help" title="Get help">
        <TourRow />
        <SettingRow label="Email us" help={`Questions, a bug, or a deletion request: ${CONTACT_EMAIL}. A person replies.`}>
          <a href={`mailto:${CONTACT_EMAIL}`} className="ui-button ui-button--secondary ui-button--sm">
            Email
          </a>
        </SettingRow>
      </SettingsSection>
    </>
  );
}
