"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="auth-main">
      <section className="auth-card">
        <h1>Something went wrong</h1>
        <p>We could not complete that request. Please try again.</p>
        <button type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
