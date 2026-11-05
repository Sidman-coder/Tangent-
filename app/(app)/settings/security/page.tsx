"use client";

import { useAppState } from "@/components/AppStateProvider";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SecuritySettings from "@/components/settings/SecuritySettings";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";

export default function SecuritySettingsPage() {
  const { state } = useAppState();
  return (
    <>
      <SettingsPageHeader page="security" />
      <SecuritySettings email={state?.user.email ?? ""} />
      <SettingsSection id="sign-in-methods" title="Ways to sign in" description="These always work, with or without a password.">
        <SettingRow label="Email code" help="A 6-digit code sent to your email. Nothing to remember." />
        <SettingRow label="Google" help="If your email is a Google account, sign in with Google." />
      </SettingsSection>
    </>
  );
}
