// Must stay first: it populates process.env before any module reads it.
import "./load-root-env.js";

import { loadConfig } from "@reminder/config";

import { ensureSettings, isDatabaseEmpty, runMigrations, seedDemoData } from "./index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const result = await runMigrations(config.DATABASE_URL);
  await ensureSettings(config.DATABASE_URL, {
    calendarSystem: config.DEFAULT_CALENDAR_SYSTEM,
    defaultCurrency: config.DEFAULT_CURRENCY,
    emailEnabled: config.DEFAULT_EMAIL_ENABLED,
    telegramEnabled: config.DEFAULT_TELEGRAM_ENABLED,
  });

  if (config.demoMode) {
    const empty = await isDatabaseEmpty(config.DATABASE_URL);
    if (empty) {
      const seedResult = await seedDemoData(config.DATABASE_URL, config.SECRETS_MASTER_KEY);
      console.log(
        JSON.stringify({
          level: "info",
          event: "db.demo_data_seeded",
          restored: seedResult.restored,
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "db.migration_completed",
      applied: result.applied,
      alreadyApplied: result.alreadyApplied,
      demoMode: config.demoMode,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Migration failed";
  const detail =
    error && typeof error === "object" && "detail" in error ? String(error.detail) : undefined;
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event: "db.migration_failed",
      message,
      detail,
      stack,
    }),
  );
  process.exitCode = 1;
});
