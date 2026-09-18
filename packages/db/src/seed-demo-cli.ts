// Must stay first: it populates process.env before any module reads it.
import "./load-root-env.js";

import { loadConfig } from "@reminder/config";

import { seedDemoData } from "./demo-data.js";

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(
    JSON.stringify({
      level: "info",
      event: "db.seed_demo_started",
      demoMode: config.demoMode,
    }),
  );

  const result = await seedDemoData(config.DATABASE_URL, config.SECRETS_MASTER_KEY);

  console.log(
    JSON.stringify({
      level: "info",
      event: "db.seed_demo_completed",
      restored: result.restored,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Demo seeding failed";
  console.error(
    JSON.stringify({
      level: "error",
      event: "db.seed_demo_failed",
      message,
    }),
  );
  process.exitCode = 1;
});
