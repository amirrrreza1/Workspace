import { describe, expect, it } from "vitest";

import {
  createEnvironmentSchema,
  createProjectSchema,
  formatEnvFile,
  parseEnvFile,
  updateEnvironmentSchema,
  upsertSecretSchema,
} from "./secrets.js";

describe("secrets domain", () => {
  it("validates project creation", () => {
    const parsed = createProjectSchema.parse({
      name: "Workspace App",
      description: "Main workspace",
    });
    expect(parsed.name).toBe("Workspace App");
    expect(parsed.defaultEnvironments).toEqual(["development", "staging", "production"]);
  });

  it("validates environment name regex", () => {
    expect(createEnvironmentSchema.parse({ name: "staging-eu_1" })).toEqual({ name: "staging-eu_1" });
    expect(() => createEnvironmentSchema.parse({ name: "staging space" })).toThrow();
  });

  it("validates update environment schema", () => {
    expect(updateEnvironmentSchema.parse({ name: "production_us-east" })).toEqual({
      name: "production_us-east",
    });
    expect(() => updateEnvironmentSchema.parse({ name: "invalid name!" })).toThrow();
    expect(() => updateEnvironmentSchema.parse({ name: "" })).toThrow();
  });

  it("validates secret key format", () => {
    expect(upsertSecretSchema.parse({ key: "DATABASE_URL", value: "postgres://localhost" })).toEqual({
      key: "DATABASE_URL",
      value: "postgres://localhost",
      isSecret: true,
    });
    expect(() => upsertSecretSchema.parse({ key: "123_INVALID", value: "test" })).toThrow();
  });

  describe("parseEnvFile", () => {
    it("parses unquoted, quoted, and commented variables", () => {
      const raw = `
# Global Config
APP_PORT=3000
DATABASE_URL="postgres://user:pass@localhost:5432/db" # DB string

# Auth settings
SECRET_KEY='super_secret_jwt'
EMPTY_VAL=""
MULTILINE="first line
second line"
export API_ENABLED=true
`;
      const entries = parseEnvFile(raw);
      expect(entries).toEqual([
        { key: "APP_PORT", value: "3000", comment: "Global Config" },
        { key: "DATABASE_URL", value: "postgres://user:pass@localhost:5432/db", comment: "DB string" },
        { key: "SECRET_KEY", value: "super_secret_jwt", comment: "Auth settings" },
        { key: "EMPTY_VAL", value: "" },
        { key: "MULTILINE", value: "first line\nsecond line" },
        { key: "API_ENABLED", value: "true" },
      ]);
    });
  });

  describe("formatEnvFile", () => {
    it("serializes entries to a clean .env format", () => {
      const entries = [
        { key: "PORT", value: "3000", comment: "Web server port" },
        { key: "DATABASE_URL", value: "postgres://localhost:5432/db", comment: null },
        { key: "GREETING", value: "Hello World", comment: undefined },
      ];
      const output = formatEnvFile(entries);
      expect(output).toContain("# Web server port\nPORT=3000");
      expect(output).toContain("DATABASE_URL=postgres://localhost:5432/db");
      expect(output).toContain('GREETING="Hello World"');
    });
  });
});
