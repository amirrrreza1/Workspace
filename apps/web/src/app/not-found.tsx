import Link from "next/link";
import { WorkspaceIcon } from "./workspace-icon";

export default function NotFound() {
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
        <div
          style={{
            width: "64px",
            height: "64px",
            background: "var(--color-surface-raised)",
            border: "var(--border-strong)",
            borderRadius: "var(--radius-control)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "3px 3px 0 var(--color-shadow)",
            marginBottom: "1.5rem",
          }}
        >
          <WorkspaceIcon size={44} />
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-ink)", margin: 0 }}>
          Page Not Found
        </h2>
        <p style={{ marginTop: "0.75rem", color: "var(--color-ink-muted)", fontSize: "0.9375rem" }}>
          The requested resource could not be found.
        </p>
        <Link
          href="/"
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
            textDecoration: "none",
          }}
        >
          Return to Workspace
        </Link>
      </div>
    </main>
  );
}
