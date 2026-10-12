import Link from "next/link";

export const metadata = { title: "Invite-only · Tangent" };

export default function InviteOnlyPage() {
  return (
    <>
      <h1>You&apos;re early</h1>
      <p className="auth-lede">
        Tangent is opening to students a few at a time while we make it great. That account isn&apos;t on the list
        yet, so we&apos;ve signed you out.
      </p>
      <ul className="auth-points">
        <li>Got an invite? Sign in with the exact email it was sent to.</li>
        <li>No invite yet? Ask whoever shared Tangent with you to get you added.</li>
      </ul>
      <Link className="auth-link" href="/signin">Sign in with another account</Link>
    </>
  );
}
