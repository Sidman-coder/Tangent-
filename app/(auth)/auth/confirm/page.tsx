import ConfirmSignIn from "./ConfirmSignIn";

export const metadata = { title: "Signing in · Tangent" };

// Where the email sign-in link lands (via /auth/callback). The page verifies
// the link with a POST after it loads, so email scanners that only GET the link
// don't use it up.
export default function ConfirmPage({ searchParams }: { searchParams: { token_hash?: string; type?: string; next?: string } }) {
  return <ConfirmSignIn tokenHash={searchParams.token_hash ?? ""} type={searchParams.type ?? "email"} next={searchParams.next ?? "/"} />;
}
