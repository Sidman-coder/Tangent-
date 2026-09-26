import Link from "next/link";

export const metadata = { title: "Invite-only · Tangent" };

export default function InviteOnlyPage() {
  return (
    <>
      <h1>TANGENT is invite-only right now</h1>
      <p className="auth-lede">
        Thanks for your interest! We&apos;re letting students in a few at a time while we test. That account
        isn&apos;t on the list yet, so we&apos;ve signed you out.
      </p>
      <Link className="auth-link" href="/signin">Try a different account</Link>
    </>
  );
}
