import { describe, expect, it } from "vitest";

import { createNoteSchema, noteFilterSchema, updateNoteSchema } from "./notes.js";

describe("notes domain", () => {
  it("validates a valid create note input", () => {
    const parsed = createNoteSchema.parse({
      title: "My First Note",
      content: "Hello world!",
      tags: ["work", "ideas"],
      isPinned: true,
    });
    expect(parsed.title).toBe("My First Note");
    expect(parsed.tags).toEqual(["work", "ideas"]);
    expect(parsed.isPinned).toBe(true);
  });

  it("fails if title is empty", () => {
    expect(() => createNoteSchema.parse({ title: "   " })).toThrow();
  });

  it("validates update note input", () => {
    const parsed = updateNoteSchema.parse({
      title: "Updated Title",
      isArchived: true,
    });
    expect(parsed.title).toBe("Updated Title");
    expect(parsed.isArchived).toBe(true);
  });

  it("parses filter schema with string booleans", () => {
    const filter = noteFilterSchema.parse({
      isPinned: "true",
      isArchived: "false",
      sort: "title_asc",
    });
    expect(filter.isPinned).toBe(true);
    expect(filter.isArchived).toBe(false);
    expect(filter.sort).toBe("title_asc");
  });

  it("validates links in create and update note inputs", () => {
    const parsedCreate = createNoteSchema.parse({
      title: "Note with links",
      links: [
        { url: "https://example.com", title: "Example" },
        { url: "https://github.com" },
      ],
    });
    expect(parsedCreate.links).toEqual([
      { url: "https://example.com", title: "Example" },
      { url: "https://github.com", title: "" },
    ]);

    const parsedUpdate = updateNoteSchema.parse({
      links: [{ url: "https://docs.google.com", title: "Docs" }],
    });
    expect(parsedUpdate.links).toEqual([
      { url: "https://docs.google.com", title: "Docs" },
    ]);

    expect(() =>
      createNoteSchema.parse({
        title: "Invalid link note",
        links: [{ url: "   " }],
      }),
    ).toThrow();
  });
});
