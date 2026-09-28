"use client";

import "./globals.css";

/**
 * The last resort: this replaces the root layout, so it brings its own html and body and
 * can't lean on the theme provider or any shared component.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#fafaf8",
            color: "#1c1b19",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Architect hit an unexpected error</h1>
          <p style={{ margin: 0, maxWidth: "26rem", fontSize: "0.875rem", opacity: 0.7 }}>
            Reloading usually clears it. Your projects are saved.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              height: "2.25rem",
              padding: "0 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#d4441a",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
