import Link from "next/link";
import TangentLogo from "@/components/TangentLogo";

// Anything that isn't a page: a quiet, branded way back instead of Next's default.
export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-card">
        <TangentLogo size={48} />
        <h1>This page isn&apos;t here.</h1>
        <p>The link may be old, or the thing it pointed to was deleted.</p>
        <Link href="/" className="not-found-home">
          Back to Today
        </Link>
      </div>
    </main>
  );
}
