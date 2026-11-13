import Button from "@/components/ui/Button";

/** A plain POST to /auth/signout (no client JS), which clears the session and
 *  goes back to /signin. */
export default function SignOutForm({ label = "Sign out" }: { label?: string }) {
  return (
    <form action="/auth/signout" method="post" className="auth-stack">
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}
