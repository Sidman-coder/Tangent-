import SignInForm from "./SignInForm";

export const metadata = { title: "Sign in · Tangent" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link didn't work or has expired. Request a new one.",
};

export default function SignInPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <>
      <h1>Sign in</h1>
      <p className="auth-lede">Say it. Capture it. Build it.</p>
      <SignInForm next={searchParams.next ?? "/"} initialError={searchParams.error ? ERRORS[searchParams.error] ?? null : null} />
    </>
  );
}
