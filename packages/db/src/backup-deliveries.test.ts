import { describe, expect, it } from "vitest";

import { dueNightlyBackup } from "./backup-deliveries.js";

describe("dueNightlyBackup", () => {
  const runtime = { timeZone: "Asia/Tehran", sendTime: "02:00" };

  it("waits until the configured local time", () => {
    expect(dueNightlyBackup(new Date("2026-09-12T22:29:59.000Z"), runtime)).toBeNull();
  });

  it("returns the local backup date at and after the configured time", () => {
    expect(dueNightlyBackup(new Date("2026-09-12T22:30:00.000Z"), runtime)).toEqual({
      backupDate: "2026-09-13",
      scheduledFor: new Date("2026-09-12T22:30:00.000Z"),
    });
  });
});
