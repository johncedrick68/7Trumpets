"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Service Unavailable | 1968 Clothing</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{
        margin: 0,
        padding: "2rem",
        backgroundColor: "#ffffff",
        color: "#0a0a0a",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        boxSizing: "border-box"
      }}>
        <main style={{ maxWidth: "440px", textAlign: "center" }}>
          <p style={{
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "#737373",
            margin: "0 0 0.5rem"
          }}>
            1968 Clothing · Service
          </p>
          <h1 style={{
            fontSize: "2rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0 0 0.75rem",
            color: "#0a0a0a"
          }}>
            Temporarily Unavailable
          </h1>
          <p style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#525252",
            margin: "0 0 1.75rem"
          }}>
            Our service is experiencing a temporary disruption. Please refresh or try again in a few moments.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: "48px",
              padding: "0 1.5rem",
              backgroundColor: "#0a0a0a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
