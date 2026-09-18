import { randomUUID } from "node:crypto";
import type { WorkspaceBackup } from "@reminder/domain";

import { BackupRepository } from "./backup-repository.js";
import { encryptSecret } from "./crypto.js";
import { createSql } from "./index.js";

function getRelativeDate(daysOffset: number): {
  iso: string;
  dateOnly: string;
  year: number;
  month: number;
  day: number;
} {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const dateOnly = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return {
    iso: date.toISOString(),
    dateOnly,
    year,
    month,
    day,
  };
}

export function createDemoBackup(masterKey = "workspace-demo-master-key"): WorkspaceBackup {
  const catCloudId = randomUUID();
  const catSaasId = randomUUID();
  const catOfficeId = randomUUID();
  const catFoodId = randomUUID();
  const catPersonalId = randomUUID();

  const d1 = getRelativeDate(3);
  const d2 = getRelativeDate(5);
  const d3 = getRelativeDate(9);
  const d4 = getRelativeDate(14);
  const d5 = getRelativeDate(22);
  const past1 = getRelativeDate(-2);
  const past2 = getRelativeDate(-5);
  const past3 = getRelativeDate(-11);
  const past4 = getRelativeDate(-18);

  const backup: WorkspaceBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: "Workspace",
    data: {
      settings: {
        calendarSystem: "jalali",
        defaultCurrency: "IRR",
        emailEnabled: true,
        telegramEnabled: true,
        backupTelegramChatId: null,
      },
      reminders: [
        {
          id: randomUUID(),
          title: "Server SSL Certificate Renewal",
          description: "Automated renewal check for production & demo SSL certificates on the VPS.",
          type: "maintenance",
          customTypeLabel: "DevOps",
          state: "active",
          recurrenceCalendar: "gregorian",
          anchorYear: d1.year,
          anchorMonth: d1.month,
          anchorDay: d1.day,
          anchorWasLastDay: false,
          frequency: "monthly",
          recurrenceInterval: 3,
          nextOccurrenceDate: d1.dateOnly,
          nextNotificationAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          remindBeforeDays: 3,
          amountMinor: "1500", // $15.00
          currency: "USD",
          emailEnabled: true,
          telegramEnabled: true,
        },
        {
          id: randomUUID(),
          title: "Figma & GitHub Copilot Subscriptions",
          description: "Monthly design & developer tool licensing for the team.",
          type: "subscription",
          customTypeLabel: null,
          state: "active",
          recurrenceCalendar: "gregorian",
          anchorYear: d2.year,
          anchorMonth: d2.month,
          anchorDay: d2.day,
          anchorWasLastDay: false,
          frequency: "monthly",
          recurrenceInterval: 1,
          nextOccurrenceDate: d2.dateOnly,
          nextNotificationAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          remindBeforeDays: 2,
          amountMinor: "3900", // $39.00
          currency: "USD",
          emailEnabled: true,
          telegramEnabled: false,
        },
        {
          id: randomUUID(),
          title: "Apartment Rent",
          description: "Monthly rent payment to landlord via bank transfer.",
          type: "rent",
          customTypeLabel: null,
          state: "active",
          recurrenceCalendar: "jalali",
          anchorYear: 1405,
          anchorMonth: 1,
          anchorDay: 1,
          anchorWasLastDay: false,
          frequency: "monthly",
          recurrenceInterval: 1,
          nextOccurrenceDate: d3.dateOnly,
          nextNotificationAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          remindBeforeDays: 3,
          amountMinor: "45000000", // 45,000,000 IRR
          currency: "IRR",
          emailEnabled: false,
          telegramEnabled: true,
        },
        {
          id: randomUUID(),
          title: "Mom's Birthday 🎉",
          description: "Order flowers and organize family dinner.",
          type: "birthday",
          customTypeLabel: null,
          state: "active",
          recurrenceCalendar: "gregorian",
          anchorYear: d4.year,
          anchorMonth: d4.month,
          anchorDay: d4.day,
          anchorWasLastDay: false,
          frequency: "yearly",
          recurrenceInterval: 1,
          nextOccurrenceDate: d4.dateOnly,
          nextNotificationAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          remindBeforeDays: 4,
          amountMinor: null,
          currency: null,
          emailEnabled: false,
          telegramEnabled: true,
        },
        {
          id: randomUUID(),
          title: "Clean Water Filter Replacement",
          description: "Inspect stage 1 sediment and stage 2 carbon block cartridges.",
          type: "maintenance",
          customTypeLabel: null,
          state: "active",
          recurrenceCalendar: "gregorian",
          anchorYear: d5.year,
          anchorMonth: d5.month,
          anchorDay: d5.day,
          anchorWasLastDay: false,
          frequency: "monthly",
          recurrenceInterval: 6,
          nextOccurrenceDate: d5.dateOnly,
          nextNotificationAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          remindBeforeDays: 1,
          amountMinor: "2500000", // 2,500,000 IRR
          currency: "IRR",
          emailEnabled: true,
          telegramEnabled: false,
        },
      ],
      notes: [
        {
          id: randomUUID(),
          title: "🚀 Welcome to Workspace Demo!",
          content: `# Welcome to Workspace

This instance is running in **Demo Mode**. You have full access to explore the features of this self-hosted personal productivity suite.

### ✨ What you can explore:
- **🔔 Reminders**: Multi-calendar recurring tasks with lead-time notifications via Email & Telegram.
- **👛 Expenses**: Income and expense tracking with multiple currencies (USD & Iranian Rial) and auto-conversion.
- **📝 Notes**: Clean markdown editor with tags, pinning, and instant search.
- **🔑 Project Secrets**: AES-256-GCM encrypted environment variables for developer projects.

---

### 💡 Demo Tips:
- Try creating a new reminder or editing an existing one.
- You can reset this workspace to its pristine demo state at any time using the **Reset Demo Data** button in the top banner.
- Restoring arbitrary backup files is disabled in Demo Mode for security.`,
          tags: ["demo", "welcome", "guide"],
          isPinned: true,
          isArchived: false,
        },
        {
          id: randomUUID(),
          title: "📋 VPS Production Checklist",
          content: `# VPS Production Checklist

- [x] Provision Docker & Docker Compose v2 on Ubuntu 24.04 LTS
- [x] Setup Caddy or Nginx reverse proxy with Let's Encrypt TLS
- [x] Configure automated daily volume backups
- [ ] Review SSH access keys & disable password authentication
- [ ] Set up UFW firewall: open ports 80, 443, 22`,
          tags: ["devops", "vps", "deployment"],
          isPinned: false,
          isArchived: false,
        },
        {
          id: randomUUID(),
          title: "💡 Architecture & Future Ideas",
          content: `# Ideas for Workspace

1. **Mobile Quick Capture**: Add PWA offline caching for quick note-taking.
2. **Weekly Spending Digest**: Summary email sent every Monday morning.
3. **Webhook Notifications**: Integrate Discord or Slack webhooks alongside Telegram.`,
          tags: ["planning", "ideas"],
          isPinned: false,
          isArchived: false,
        },
      ],
      projects: [
        {
          id: randomUUID(),
          name: "Demo Web Application",
          description: "Next.js frontend with PostgreSQL backend",
          environments: [
            {
              id: randomUUID(),
              name: "Production",
              secrets: [
                {
                  id: randomUUID(),
                  key: "DATABASE_URL",
                  ...encryptSecret(
                    "postgresql://app_user:p@ssw0rd99@prod-db.internal:5432/app_db",
                    masterKey,
                  ),
                  comment: "Primary database cluster",
                  isSecret: true,
                },
                {
                  id: randomUUID(),
                  key: "NEXT_PUBLIC_APP_URL",
                  ...encryptSecret("https://demo.example.com", masterKey),
                  comment: "Public facing URL",
                  isSecret: false,
                },
                {
                  id: randomUUID(),
                  key: "STRIPE_PUBLISHABLE_KEY",
                  ...encryptSecret("pk_live_51M0demo99xyz123", masterKey),
                  comment: null,
                  isSecret: false,
                },
                {
                  id: randomUUID(),
                  key: "STRIPE_SECRET_KEY",
                  ...encryptSecret("sk_live_51M0secretkey99demo8877", masterKey),
                  comment: "Payment gateway secret",
                  isSecret: true,
                },
                {
                  id: randomUUID(),
                  key: "JWT_SIGNING_SECRET",
                  ...encryptSecret("super_secure_jwt_secret_token_12345", masterKey),
                  comment: "Auth token HMAC key",
                  isSecret: true,
                },
              ],
            },
            {
              id: randomUUID(),
              name: "Staging",
              secrets: [
                {
                  id: randomUUID(),
                  key: "DATABASE_URL",
                  ...encryptSecret(
                    "postgresql://staging_user:staging_pass@127.0.0.1:5432/staging_db",
                    masterKey,
                  ),
                  comment: "Staging database",
                  isSecret: true,
                },
                {
                  id: randomUUID(),
                  key: "NEXT_PUBLIC_APP_URL",
                  ...encryptSecret("https://staging.example.com", masterKey),
                  comment: null,
                  isSecret: false,
                },
                {
                  id: randomUUID(),
                  key: "STRIPE_PUBLISHABLE_KEY",
                  ...encryptSecret("pk_test_51M0staging123", masterKey),
                  comment: null,
                  isSecret: false,
                },
              ],
            },
          ],
        },
        {
          id: randomUUID(),
          name: "Workspace Notification Worker",
          description: "Background worker handling email & Telegram dispatches",
          environments: [
            {
              id: randomUUID(),
              name: "Default",
              secrets: [
                {
                  id: randomUUID(),
                  key: "TELEGRAM_BOT_TOKEN",
                  ...encryptSecret("789123456:ABC-DemoTelegramBotToken_XYZ", masterKey),
                  comment: "BotFather token for worker",
                  isSecret: true,
                },
                {
                  id: randomUUID(),
                  key: "SMTP_PASSWORD",
                  ...encryptSecret("app_pass_demo_smtp_secure_123", masterKey),
                  comment: "App password for transactional mail",
                  isSecret: true,
                },
              ],
            },
          ],
        },
      ],
      expenseCategories: [
        {
          id: catCloudId,
          name: "Cloud & Hosting",
          color: "#3b82f6",
          icon: "server",
          isDefault: false,
        },
        {
          id: catSaasId,
          name: "SaaS & Subscriptions",
          color: "#8b5cf6",
          icon: "tag",
          isDefault: false,
        },
        {
          id: catOfficeId,
          name: "Office & Hardware",
          color: "#10b981",
          icon: "laptop",
          isDefault: false,
        },
        {
          id: catFoodId,
          name: "Food & Drinks",
          color: "#f59e0b",
          icon: "coffee",
          isDefault: false,
        },
        {
          id: catPersonalId,
          name: "Personal & Health",
          color: "#ef4444",
          icon: "heart",
          isDefault: true,
        },
      ],
      regularExpenseItems: [
        {
          id: randomUUID(),
          title: "Hetzner Cloud VPS",
          categoryId: catCloudId,
          amountMinor: "990", // $9.90
          currency: "USD",
          icon: "server",
        },
        {
          id: randomUUID(),
          title: "ChatGPT Plus Subscription",
          categoryId: catSaasId,
          amountMinor: "2000", // $20.00
          currency: "USD",
          icon: "tag",
        },
        {
          id: randomUUID(),
          title: "High-speed Fiber Internet",
          categoryId: catOfficeId,
          amountMinor: "1500000", // 1,500,000 IRR
          currency: "IRR",
          icon: "laptop",
        },
        {
          id: randomUUID(),
          title: "Coffee & Snacks",
          categoryId: catFoodId,
          amountMinor: "250000", // 250,000 IRR
          currency: "IRR",
          icon: "coffee",
        },
      ],
      expenses: [
        {
          id: randomUUID(),
          title: "Hetzner CX22 Cloud VPS",
          categoryId: catCloudId,
          amountMinor: "990", // $9.90
          currency: "USD",
          spentAt: past1.iso,
          note: "Monthly VPS server hosting Workspace demo",
        },
        {
          id: randomUUID(),
          title: "ChatGPT Plus Renewal",
          categoryId: catSaasId,
          amountMinor: "2000", // $20.00
          currency: "USD",
          spentAt: past2.iso,
          note: "AI research and development assistant",
        },
        {
          id: randomUUID(),
          title: "Team Lunch & Espresso",
          categoryId: catFoodId,
          amountMinor: "2800000", // 2,800,000 IRR
          currency: "IRR",
          spentAt: past3.iso,
          note: "Celebrated milestone release",
        },
        {
          id: randomUUID(),
          title: "Ergonomic Desk Monitor Arm",
          categoryId: catOfficeId,
          amountMinor: "4500", // $45.00
          currency: "USD",
          spentAt: past4.iso,
          note: "Dual screen mount for workspace",
        },
      ],
    },
  };

  return backup;
}

export async function isDatabaseEmpty(databaseUrl: string): Promise<boolean> {
  const sql = await createSql(databaseUrl);
  try {
    const [{ count: reminderCount }] = await sql<
      [{ count: string }]
    >`select count(*) from reminders`;
    const [{ count: noteCount }] = await sql<[{ count: string }]>`select count(*) from notes`;
    const [{ count: projectCount }] = await sql<[{ count: string }]>`select count(*) from projects`;
    return Number(reminderCount) === 0 && Number(noteCount) === 0 && Number(projectCount) === 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function seedDemoData(databaseUrl: string, masterKey?: string) {
  const backup = createDemoBackup(masterKey || databaseUrl);
  const repo = new BackupRepository(databaseUrl);
  return await repo.restoreBackup(backup);
}
