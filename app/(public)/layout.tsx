import Link from "next/link";
import TangentLogo from "@/components/TangentLogo";
import PublicLinks from "@/components/public/PublicLinks";
import "./public.css";

// The public site (overnight 2 Phase 5): the landing page and the Privacy,
// Terms and For parents pages. Anyone can read these, signed in or not
// (lib/auth/gate.ts PUBLIC_PAGES), so nothing here loads the app or its data.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub">
      <a className="pub-skip" href="#main-content">
        Skip to content
      </a>
      <header className="pub-header">
        <Link href="/" className="pub-brand" aria-label="Tangent home">
          <TangentLogo size={28} />
          <span>Tangent</span>
        </Link>
        <nav className="pub-header-nav" aria-label="Account">
          <Link href="/signin" className="pub-header-link">
            Sign in
          </Link>
          <Link href="/signin?mode=create" className="ui-button ui-button--primary ui-button--sm">
            Request an invite
          </Link>
        </nav>
      </header>
      <main id="main-content" className="pub-main">
        {children}
      </main>
      <footer className="pub-footer">
        <div className="pub-footer-brand">
          <TangentLogo size={22} />
          <span>Tangent, the planner for high school students.</span>
        </div>
        <PublicLinks className="pub-footer-links" />
      </footer>
    </div>
  );
}
