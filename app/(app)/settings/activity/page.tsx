"use client";

import AiActivity from "@/components/settings/AiActivity";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsSection from "@/components/ui/SettingsSection";
import SettingRow from "@/components/ui/SettingRow";
import { usePipelineV2 } from "@/components/PipelineFlag";

export default function ActivitySettingsPage() {
  const v2 = usePipelineV2();
  return (
    <>
      <SettingsPageHeader page="activity" />
      {v2 ? (
        <AiActivity />
      ) : (
        <SettingsSection title="Change history">
          <SettingRow label="Not on for your account yet" help="When it is, every change Tangent makes shows up here with an undo." />
        </SettingsSection>
      )}
    </>
  );
}
