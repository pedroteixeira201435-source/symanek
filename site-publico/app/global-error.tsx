"use client";

// Catches unhandled errors in the public site so testers see a recover screen
// instead of a broken page. Must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Something went wrong</h1>
            <p style={{ color: "#5b6b78", fontSize: 14, margin: "0 0 16px" }}>
              Please try again. If it keeps happening, contact the college office.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#254e73", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
