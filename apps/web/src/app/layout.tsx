import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/styles/globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { themeInitScript } from "@/lib/theme-script";
import { AppHeader } from "./app-header";
import { AppProviders } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Workspace - Notes, Reminders & Secrets",
  description: "Personal productivity workspace for your reminders, notes, and project environment secrets.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={GeistSans.className}>
        <ThemeProvider>
          <AppProviders>
            <AppHeader />
            {children}
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

