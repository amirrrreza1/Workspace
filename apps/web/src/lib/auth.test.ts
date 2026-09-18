import { describe, expect, it } from "vitest";

import {
  authPassword,
  createSessionToken,
  isDemoMode,
  isPublicPath,
  safeRedirectPath,
  secretsMatch,
  verifySessionToken,
} from "./auth.js";

const PASSWORD = "a-long-enough-test-password";

describe("secretsMatch", () => {
  it("accepts an identical secret", async () => {
    await expect(secretsMatch(PASSWORD, PASSWORD)).resolves.toBe(true);
  });

  it("rejects a different secret", async () => {
    await expect(secretsMatch("wrong", PASSWORD)).resolves.toBe(false);
  });

  it("rejects a matching prefix", async () => {
    await expect(secretsMatch(PASSWORD.slice(0, -1), PASSWORD)).resolves.toBe(false);
  });

  it("never matches when no password is configured", async () => {
    await expect(secretsMatch("", "")).resolves.toBe(false);
  });
});

describe("verifySessionToken", () => {
  it("accepts a token it just issued", async () => {
    const token = await createSessionToken(PASSWORD);
    await expect(verifySessionToken(token, PASSWORD)).resolves.toBe(true);
  });

  it("rejects a token signed with a different password", async () => {
    const token = await createSessionToken(PASSWORD);
    await expect(verifySessionToken(token, "another-long-password")).resolves.toBe(false);
  });

  it("rejects a tampered issue time", async () => {
    const now = 1_760_000_000_000;
    const token = await createSessionToken(PASSWORD, now);
    const signature = token.split(".")[2] ?? "";
    await expect(verifySessionToken(`v1.${now - 1000}.${signature}`, PASSWORD)).resolves.toBe(
      false,
    );
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken(PASSWORD, 1_760_000_000_000);
    const [version, issuedAt] = token.split(".");
    await expect(verifySessionToken(`${version}.${issuedAt}.abcd`, PASSWORD)).resolves.toBe(false);
  });

  it("rejects a token past the absolute maximum age", async () => {
    const now = 1_760_000_000_000;
    const eightDays = 8 * 24 * 60 * 60 * 1000;
    const token = await createSessionToken(PASSWORD, now - eightDays);
    await expect(verifySessionToken(token, PASSWORD, now)).resolves.toBe(false);
  });

  it("rejects a token issued in the future", async () => {
    const now = 1_760_000_000_000;
    const token = await createSessionToken(PASSWORD, now + 10 * 60 * 1000);
    await expect(verifySessionToken(token, PASSWORD, now)).resolves.toBe(false);
  });

  it("rejects malformed and missing tokens", async () => {
    await expect(verifySessionToken(undefined, PASSWORD)).resolves.toBe(false);
    await expect(verifySessionToken("", PASSWORD)).resolves.toBe(false);
    await expect(verifySessionToken("not-a-token", PASSWORD)).resolves.toBe(false);
    await expect(verifySessionToken("v2.1.abc", PASSWORD)).resolves.toBe(false);
  });

  it("rejects every token when no password is configured", async () => {
    const token = await createSessionToken(PASSWORD);
    await expect(verifySessionToken(token, "")).resolves.toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeRedirectPath("/?state=paused")).toBe("/?state=paused");
  });

  it("falls back to the root for anything off-origin or looping", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
    expect(safeRedirectPath("//evil.example.com")).toBe("/");
    expect(safeRedirectPath("https://evil.example.com")).toBe("/");
    expect(safeRedirectPath("/login?next=/")).toBe("/");
  });
});

describe("isPublicPath", () => {
  it("allows static assets used on login and public pages", () => {
    expect(isPublicPath("/icons/workspace-layers-trio-512.png")).toBe(true);
    expect(isPublicPath("/Shabnam/Shabnam.woff2")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(isPublicPath("/icon.png")).toBe(true);
    expect(isPublicPath("/icon.svg")).toBe(true);
    expect(isPublicPath("/icon-192.png")).toBe(true);
    expect(isPublicPath("/icon-512.png")).toBe(true);
    expect(isPublicPath("/apple-touch-icon.png")).toBe(true);
    expect(isPublicPath("/manifest.json")).toBe(true);
  });

  it("allows auth routes and health checks", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
    expect(isPublicPath("/api/health/live")).toBe(true);
    expect(isPublicPath("/api/health/ready")).toBe(true);
  });

  it("denies access to protected dashboard pages and sensitive APIs", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/notes")).toBe(false);
    expect(isPublicPath("/secrets")).toBe(false);
    expect(isPublicPath("/reminders")).toBe(false);
    expect(isPublicPath("/api/v1/reminders")).toBe(false);
    expect(isPublicPath("/api/v1/notes")).toBe(false);
    expect(isPublicPath("/api/v1/secrets.png")).toBe(false);
  });
});

describe("isDemoMode & authPassword", () => {
  it("detects DEMO_MODE when set to true or 1", () => {
    const original = process.env.DEMO_MODE;
    try {
      process.env.DEMO_MODE = "true";
      expect(isDemoMode()).toBe(true);

      process.env.DEMO_MODE = "1";
      expect(isDemoMode()).toBe(true);

      process.env.DEMO_MODE = "false";
      expect(isDemoMode()).toBe(false);

      delete process.env.DEMO_MODE;
      expect(isDemoMode()).toBe(false);
    } finally {
      if (original !== undefined) process.env.DEMO_MODE = original;
      else delete process.env.DEMO_MODE;
    }
  });

  it("uses default demo password when in demo mode and password is empty", () => {
    const originalDemo = process.env.DEMO_MODE;
    const originalPass = process.env.AUTH_PASSWORD;
    try {
      process.env.DEMO_MODE = "true";
      delete process.env.AUTH_PASSWORD;
      expect(authPassword()).toBe("workspace_demo_pass");

      process.env.AUTH_PASSWORD = "custom_demo_password";
      expect(authPassword()).toBe("custom_demo_password");
    } finally {
      if (originalDemo !== undefined) process.env.DEMO_MODE = originalDemo;
      else delete process.env.DEMO_MODE;
      if (originalPass !== undefined) process.env.AUTH_PASSWORD = originalPass;
      else delete process.env.AUTH_PASSWORD;
    }
  });
});
