"use client";

import { Bell, FileText, KeyRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceIcon } from "./workspace-icon";

export function AppHeader() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname?.startsWith("/login/")) {
    return null;
  }

  const isReminders = pathname === "/" || pathname?.startsWith("/reminders");
  const isExpenses = pathname?.startsWith("/expenses");
  const isNotes = pathname?.startsWith("/notes");
  const isSecrets = pathname?.startsWith("/secrets");

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-top">
          <Link href="/" className="app-brand" aria-label="Workspace Home">
            <div className="app-logo-box">
              <WorkspaceIcon size={36} />
            </div>
            <div className="app-title-group">
              <span className="app-title">Workspace</span>
            </div>
          </Link>

          <div className="app-header-theme">
            <ThemeToggle />
          </div>
        </div>

        <nav className="app-nav" aria-label="Main Navigation">
          <Link
            href="/"
            className={`app-nav-item ${isReminders ? "app-nav-item--active" : ""}`}
            aria-current={isReminders ? "page" : undefined}
          >
            <Bell aria-hidden="true" size={17} />
            <span>Reminders</span>
          </Link>

          <Link
            href="/expenses"
            className={`app-nav-item ${isExpenses ? "app-nav-item--active" : ""}`}
            aria-current={isExpenses ? "page" : undefined}
          >
            <Wallet aria-hidden="true" size={17} />
            <span>Expenses</span>
          </Link>

          <Link
            href="/notes"
            className={`app-nav-item ${isNotes ? "app-nav-item--active" : ""}`}
            aria-current={isNotes ? "page" : undefined}
          >
            <FileText aria-hidden="true" size={17} />
            <span>Notes</span>
          </Link>

          <Link
            href="/secrets"
            className={`app-nav-item ${isSecrets ? "app-nav-item--active" : ""}`}
            aria-current={isSecrets ? "page" : undefined}
          >
            <KeyRound aria-hidden="true" size={17} />
            <span>
              <span className="nav-label-prefix">Project </span>Secrets
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
