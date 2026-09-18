import { describe, expect, it } from "vitest";
import { workspaceBackupSchema } from "@reminder/domain";

import { createDemoBackup } from "./demo-data.js";

describe("createDemoBackup", () => {
  it("creates a backup payload conforming strictly to workspaceBackupSchema", () => {
    const backup = createDemoBackup("test-master-key");
    const parsed = workspaceBackupSchema.safeParse(backup);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      console.error(parsed.error);
      return;
    }

    expect(parsed.data.data.reminders.length).toBeGreaterThanOrEqual(5);
    expect(parsed.data.data.notes.length).toBeGreaterThanOrEqual(3);
    expect(parsed.data.data.projects.length).toBeGreaterThanOrEqual(2);
    expect(parsed.data.data.expenseCategories.length).toBeGreaterThanOrEqual(4);
    expect(parsed.data.data.regularExpenseItems.length).toBeGreaterThanOrEqual(3);
    expect(parsed.data.data.expenses.length).toBeGreaterThanOrEqual(4);
  });
});
