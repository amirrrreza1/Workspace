import { expect, test } from "@playwright/test";

import { BASE_URL, seedSession } from "./auth-helpers";

const note = {
  id: "f64b6750-c4a8-4f64-b269-5443a7ce9500",
  title: "API example",
  content: "```typescript\nconst total = 6 * 7;\nconsole.log(total);\n```",
  tags: ["code"],
  isPinned: false,
  isArchived: false,
  createdAt: "2026-09-13T08:00:00.000Z",
  updatedAt: "2026-09-13T08:00:00.000Z",
};

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
  await seedSession(page);
  await page.route("**/api/v1/notes?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [note],
        summary: { totalCount: 1, pinnedCount: 0, archivedCount: 0, tagsCount: 1 },
      }),
    }),
  );
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: note.title })).toBeVisible();
});

test("copies a fenced code block from the opened note", async ({ page }) => {
  const card = page.locator(".note-card", { hasText: note.title });
  await card.click();

  const dialog = page.getByRole("dialog", { name: note.title });
  const copyButton = dialog.getByRole("button", { name: "Copy: typescript code" });

  await expect(dialog.locator("pre code")).toHaveCSS("user-select", "text");
  await copyButton.click();

  await expect(dialog.getByRole("button", { name: "Copied: typescript code" })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () =>
      (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"),
    )
    .toBe("const total = 6 * 7;\nconsole.log(total);");
});
