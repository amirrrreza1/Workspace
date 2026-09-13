"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Tooltip } from "@reminder/ui";
import { useTheme } from "@/lib/theme-provider";

export function ThemeToggle() {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button type="button" className="theme-toggle-btn" aria-label="Theme: Light" disabled>
        <Sun size={16} aria-hidden="true" />
        <span className="theme-toggle-label">Theme</span>
      </button>
    );
  }

  const nextMode = theme === "light" ? "Dark" : theme === "dark" ? "System" : "Light";

  const displayLabel =
    theme === "system"
      ? `System (${resolvedTheme === "dark" ? "Dark" : "Light"})`
      : theme === "dark"
        ? "Dark"
        : "Light";

  const buttonText = theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  return (
    <Tooltip
      content={`Current: ${displayLabel}. Click to switch to ${nextMode} mode.`}
      side="bottom"
    >
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={toggleTheme}
        aria-label={`Current theme: ${displayLabel}. Click to switch to ${nextMode} mode.`}
      >
        {theme === "system" ? (
          <Monitor size={16} aria-hidden="true" />
        ) : resolvedTheme === "dark" ? (
          <Moon size={16} aria-hidden="true" />
        ) : (
          <Sun size={16} aria-hidden="true" />
        )}
        <span className="theme-toggle-label">{buttonText}</span>
      </button>
    </Tooltip>
  );
}
