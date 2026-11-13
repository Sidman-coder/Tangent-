import { createClient } from "@/lib/supabase/server";
import SignOutForm from "@/components/auth/SignOutForm";
import { recordWaitlist } from "@/lib/auth/waitlist-server";

export const metadata = { title: "You're on the waitlist · Tangent" };
export const dynamic = "force-dynamic";

// Where a signed-in account that isn't allowed in yet lands (Round 4, 1.2).
// The session stays; middleware sends every other page here and every API
// answers 403 (lib/auth/gate.ts). Round 5A, 1.5: they are on a real waitlist,
// added once, and the owner approves them from /settings/waitlist.
export default async function WaitlistPage() {
  const { data } = await createClient().auth.getUser();
  const user = data.user;
  const email = user?.email ?? null;
  // Covers an account that was already waiting before the waitlist existed.
  // Safe to repeat: the row is added once.
  if (user) await recordWaitlist(user);
  return (
    <>
      <h1>You&apos;re on the waitlist</h1>
      <p className="auth-lede">
        {email ? (
          <>
            You&apos;re on the waitlist. We&apos;ll email you at <strong>{email}</strong> when you&apos;re in.
          </>
        ) : (
          <>You&apos;re on the waitlist. We&apos;ll email you when you&apos;re in.</>
        )}
      </p>
      <SignOutForm />
    </>
  );
}
