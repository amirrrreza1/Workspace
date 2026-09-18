import { describe, expect, it } from "vitest";

import { workspaceBackupSchema, type WorkspaceBackup } from "./backup.js";

describe("workspaceBackupSchema", () => {
  const validBackup: WorkspaceBackup = {
    version: 1,
    exportedAt: "2026-09-11T03:30:00.000Z",
    appName: "Workspace",
    data: {
      settings: {
        calendarSystem: "jalali",
        defaultCurrency: "IRR",
        emailEnabled: false,
        telegramEnabled: true,
        backupTelegramChatId: "@backup_channel",
      },
      reminders: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          title: "Insurance payment",
          description: "Car insurance due",
          type: "insurance",
          customTypeLabel: null,
          state: "active",
          recurrenceCalendar: "jalali",
          anchorYear: 1403,
          anchorMonth: 7,
          anchorDay: 15,
          anchorWasLastDay: false,
          frequency: "yearly",
          recurrenceInterval: 1,
          nextOccurrenceDate: "2024-10-06",
          nextNotificationAt: "2024-10-05T06:30:00.000Z",
          remindBeforeDays: 1,
          amountMinor: "50000000",
          currency: "IRR",
          emailEnabled: false,
          telegramEnabled: true,
        },
      ],
      notes: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          title: "Project Ideas",
          content: "Markdown content here",
          tags: ["ideas", "work"],
          isPinned: true,
          isArchived: false,
        },
      ],
      projects: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          name: "API Server",
          description: "Backend services",
          environments: [
            {
              id: "44444444-4444-4444-4444-444444444444",
              name: "production",
              secrets: [
                {
                  id: "55555555-5555-5555-5555-555555555555",
                  key: "DATABASE_URL",
                  encryptedValue: "enc_data",
                  iv: "iv_data",
                  authTag: "tag_data",
                  comment: "Production DB",
                  isSecret: true,
                },
              ],
            },
          ],
        },
      ],
      expenseCategories: [
        {
          id: "66666666-6666-6666-6666-666666666666",
          name: "Snacks and food",
          color: "#10b981",
          icon: "utensils",
          isDefault: true,
        },
      ],
      regularExpenseItems: [
        {
          id: "77777777-7777-7777-7777-777777777777",
          title: "Gasoline",
          categoryId: "66666666-6666-6666-6666-666666666666",
          amountMinor: "600000",
          currency: "IRR",
        },
      ],
      expenses: [
        {
          id: "88888888-8888-8888-8888-888888888888",
          title: "Lunch",
          categoryId: "66666666-6666-6666-6666-666666666666",
          amountMinor: "150000",
          currency: "IRR",
          spentAt: "2026-09-15T12:00:00.000Z",
        },
      ],
    },
  };

  it("validates a complete, compliant workspace backup", () => {
    const result = workspaceBackupSchema.safeParse(validBackup);
    expect(result.success).toBe(true);
  });

  it("rejects invalid backup version", () => {
    const invalid = { ...validBackup, version: 2 };
    const result = workspaceBackupSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid reminder frequency or calendar", () => {
    const invalid = {
      ...validBackup,
      data: {
        ...validBackup.data,
        reminders: [
          {
            ...validBackup.data.reminders[0],
            recurrenceCalendar: "invalid_calendar",
          },
        ],
      },
    };
    const result = workspaceBackupSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("handles missing optional settings gracefully", () => {
    const minimal: WorkspaceBackup = {
      version: 1,
      exportedAt: "2026-09-11T03:30:00.000Z",
      appName: "Workspace",
      data: {
        reminders: [],
        notes: [],
        projects: [],
        expenseCategories: [],
        regularExpenseItems: [],
        expenses: [],
      },
    };
    const result = workspaceBackupSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
