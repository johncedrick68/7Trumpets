import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-main">
      <section className="auth-card">
        <h1>Page not found</h1>
        <p>The requested page or record is unavailable.</p>
        <Link href="/">Return to storefront</Link>
      </section>
    </main>
  );
}
