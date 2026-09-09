"use client";

import { useEffect } from "react";
import { WorkspaceIcon } from "./workspace-icon";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main style={{ padding: "5rem 1.5rem", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          padding: "2.5rem 2rem",
          textAlign: "center",
          background: "var(--color-surface)",
          border: "var(--border-strong)",
          borderRadius: "var(--radius-card)",
          boxShadow: "4px 4px 0 var(--color-shadow)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <WorkspaceIcon size={56} />
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-ink)", margin: 0 }}>
          Something went wrong!
        </h2>
        <p style={{ marginTop: "0.75rem", color: "var(--color-ink-muted)", fontSize: "0.9375rem" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.625rem 1.25rem",
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "#fff",
            backgroundColor: "var(--color-accent)",
            border: "var(--border-strong)",
            borderRadius: "var(--radius-control)",
            boxShadow: "2px 2px 0 var(--color-shadow)",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
