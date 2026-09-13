import { expect, test } from "@playwright/test";

import { BASE_URL, seedSession } from "./auth-helpers";

const note = {
  id: "f64b6750-c4a8-4f64-b269-5443a7ce9500",
  title: "API example",
  content:
    "```typescript\nconst total = 6 * 7;\nconsole.log(total);\n```\n\n- [ ] Buy milk\n- [x] Ship update",
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

test("keeps notes readable and touch-friendly on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await expect(
    page.getByRole("navigation", { name: "Main Navigation" }).getByText("Notes"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Notes" })).toHaveCSS("min-height", "44px");
  await expect(page.getByRole("button", { name: "Add note" })).toHaveCSS("min-height", "48px");
  await expect(page.getByLabel("Search", { exact: true })).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("button", { name: "Show filters" })).toHaveCSS("min-height", "48px");
  await expect(page.getByText("Filters", { exact: true })).toBeVisible();
  await expect(page.locator(".summary-card").first()).toHaveCSS("min-height", "92px");
  await expect(page.locator(".summary-card").first().locator("span")).toHaveCSS(
    "font-size",
    "13px",
  );
  await expect(page.locator(".note-card .icon-button").first()).toHaveCSS("width", "44px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.locator(".note-card", { hasText: note.title }).click();
  const detail = page.getByRole("dialog", { name: note.title });
  await expect(detail.locator(".note-markdown")).toHaveCSS("font-size", "16px");
  await expect(detail.getByRole("button", { name: "Copy: typescript code" })).toHaveCSS(
    "min-height",
    "44px",
  );

  await detail.getByRole("button", { name: "Edit note" }).click();
  const editor = page.getByRole("dialog", { name: "Edit note" });
  await expect(editor.getByRole("button", { name: "Heading 1" })).toHaveCSS("width", "44px");
  await expect(editor.getByPlaceholder("Write your note here using Markdown…")).toHaveCSS(
    "font-size",
    "16px",
  );
});

test("renders compact checklist controls in the note editor preview", async ({ page }) => {
  await page.locator(".note-card", { hasText: note.title }).click();
  await page
    .getByRole("dialog", { name: note.title })
    .getByRole("button", { name: "Edit note" })
    .click();

  const editor = page.getByRole("dialog", { name: "Edit note" });
  const preview = editor.locator(".editor-preview-panel");
  const checkboxes = preview.getByRole("checkbox");

  await expect(checkboxes).toHaveCount(2);
  await expect(checkboxes.first()).toHaveCSS("width", "20px");
  await expect(checkboxes.first()).toHaveCSS("min-height", "20px");
  await expect(checkboxes.first()).toHaveCSS("padding", "0px");
  await expect(checkboxes.first()).toHaveCSS("box-shadow", "none");
  await expect(checkboxes.nth(1)).toBeChecked();

  await checkboxes.first().click();
  await expect(checkboxes.first()).toBeChecked();
});
