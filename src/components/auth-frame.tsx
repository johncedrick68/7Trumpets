export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="auth-storefront-shell">
      <section className="auth-storefront-panel" aria-label="Customer account">
        <p className="auth-storefront-wordmark" aria-hidden="true">1968</p>
        {children}
      </section>
    </main>
  );
}
