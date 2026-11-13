import Link from "next/link";

export const metadata = { title: "Your account is deleted · Tangent" };

// The last page of "Delete my account" (Round 5A, 1.4). Public: by the time you
// see it, the account, its data and the session are gone.
export default function GoodbyePage() {
  return (
    <>
      <h1>Your account is deleted</h1>
      <p className="auth-lede">Your tasks, projects, chats and everything Tangent knew about you are gone, and you&apos;re signed out.</p>
      <p className="auth-note">
        Changed your mind? You can <Link href="/signin">start fresh</Link> any time.
      </p>
    </>
  );
}
