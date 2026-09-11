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
});

