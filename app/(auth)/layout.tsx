import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page" id="main-content">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">T</span>
          <span className="auth-brand-word">Tangent</span>
        </div>
        {children}
      </div>
    </main>
  );
}
