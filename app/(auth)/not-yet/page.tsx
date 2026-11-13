import SignOutForm from "@/components/auth/SignOutForm";

export const metadata = { title: "Tangent is for students 13 and up" };

// Shown when a student says they're under 13 on the first onboarding screen
// (Round 4, 1.2). Every page comes here and every API answers 403; only a
// yes/no flag is kept (app_metadata.under_13). No "change my answer": the
// Round 5 plan (docs/tangent/ROUND5-PLAN.md) covers the full under-13 flow.
export default function NotYetPage() {
  return (
    <>
      <h1>Tangent is for students 13 and up</h1>
      <p className="auth-lede">Thanks for being honest. We hope to see you when you&apos;re 13.</p>
      <SignOutForm />
    </>
  );
}
