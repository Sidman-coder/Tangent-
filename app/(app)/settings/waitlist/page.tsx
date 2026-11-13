import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/access";
import { listWaitlist } from "@/lib/auth/waitlist";
import { waitlistAdmin } from "@/lib/auth/waitlist-server";
import PageHeader from "@/components/ui/PageHeader";
import WaitlistAdmin from "@/components/settings/WaitlistAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waitlist · Tangent" };

// Owner only (OWNER_EMAIL). Everyone else gets the normal 404, so the page
// can't be told apart from one that doesn't exist.
export default async function WaitlistSettingsPage() {
  const { data } = await createClient().auth.getUser();
  if (!isOwnerEmail(data.user?.email)) notFound();
  const view = await listWaitlist(waitlistAdmin()).catch(() => ({ waiting: [], approved: [] }));
  return (
    <>
      <PageHeader title="Waitlist" description="Approve people to let them in. They get a sign-in link by email." />
      <WaitlistAdmin initial={{ waiting: view.waiting, approved: view.approved }} />
    </>
  );
}
