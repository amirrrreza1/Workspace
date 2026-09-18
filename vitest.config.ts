import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@reminder/config/client": path.resolve(rootDir, "packages/config/src/client.ts"),
      "@reminder/config": path.resolve(rootDir, "packages/config/src/index.ts"),
      "@reminder/domain": path.resolve(rootDir, "packages/domain/src/index.ts"),
      "@reminder/db": path.resolve(rootDir, "packages/db/src/index.ts"),
      "@reminder/notifications": path.resolve(rootDir, "packages/notifications/src/index.ts"),
      "@reminder/ui": path.resolve(rootDir, "packages/ui/src/index.ts"),
      "@": path.resolve(rootDir, "apps/web/src"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
