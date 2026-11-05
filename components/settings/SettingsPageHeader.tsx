import PageHeader from "@/components/ui/PageHeader";
import type { SettingsPage } from "@/lib/settings/routes";
import { settingsMeta } from "./SettingsNav";

/** Each Settings page's title and one-line description. */
export default function SettingsPageHeader({ page }: { page: SettingsPage }) {
  const meta = settingsMeta(page);
  return <PageHeader title={meta.label} description={meta.description} />;
}
