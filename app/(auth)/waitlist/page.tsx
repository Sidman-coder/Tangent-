import { createClient } from "@/lib/supabase/server";
import SignOutForm from "@/components/auth/SignOutForm";

export const metadata = { title: "You're on the list · Tangent" };
export const dynamic = "force-dynamic";

// Where a signed-in account that isn't on ALLOWED_EMAILS lands (Round 4, 1.2).
// The session stays; middleware sends every other page here and every API
// answers 403 (lib/auth/gate.ts). The marketing landing page comes later.
export default async function WaitlistPage() {
  const { data } = await createClient().auth.getUser();
  const email = data.user?.email ?? null;
  return (
    <>
      <h1>You&apos;re on the list</h1>
      <p className="auth-lede">We&apos;ll email you when your spot opens.</p>
      {email && (
        <p className="auth-note">
          Signed in as <strong>{email}</strong>
        </p>
      )}
      <SignOutForm />
    </>
  );
}
