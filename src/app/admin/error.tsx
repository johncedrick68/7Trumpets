"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="admin-card">
      <h1>Operational data unavailable</h1>
      <p>The admin request failed safely. No empty result should be assumed.</p>
      <button type="button" onClick={reset}>Try again</button>
    </section>
  );
}
