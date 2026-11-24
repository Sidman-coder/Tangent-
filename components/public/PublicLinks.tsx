// The public links (overnight 2 Phase 5): Privacy, Terms, For parents and the
// contact address. One list, used by the public footer, the sign-in footer row
// and Settings → Help and privacy, so the three never drift.
import Link from "next/link";

export const CONTACT_EMAIL = "tangentai.admin@gmail.com";

export const PUBLIC_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/parents", label: "For parents" },
] as const;

/** One row of small links, with the contact address last. */
export default function PublicLinks({ className = "public-links" }: { className?: string }) {
  return (
    <nav className={className} aria-label="Privacy, terms and contact">
      {PUBLIC_LINKS.map((l) => (
        <Link key={l.href} href={l.href}>
          {l.label}
        </Link>
      ))}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </nav>
  );
}
