import { z } from "zod";

export const noteLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL cannot be empty")
    .max(2048, "URL must be at most 2048 characters"),
  title: z
    .string()
    .trim()
    .max(120, "Title must be at most 120 characters")
    .optional()
    .default(""),
});

export type NoteLink = z.infer<typeof noteLinkSchema>;

export type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: NoteLink[];
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title must be at most 255 characters"),
  content: z.string().default(""),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(30, "Tag must be at most 30 characters"),
    )
    .max(20, "At most 20 tags are allowed")
    .default([]),
  links: z.array(noteLinkSchema).max(50, "At most 50 links are allowed").default([]),
  isPinned: z.boolean().default(false),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title must be at most 255 characters")
    .optional(),
  content: z.string().optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(30, "Tag must be at most 30 characters"),
    )
    .max(20, "At most 20 tags are allowed")
    .optional(),
  links: z.array(noteLinkSchema).max(50, "At most 50 links are allowed").optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const noteFilterSchema = z.object({
  q: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  isPinned: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "boolean" ? val : val === "true"))
    .optional(),
  isArchived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "boolean" ? val : val === "true"))
    .optional(),
  sort: z.enum(["updated_desc", "updated_asc", "title_asc"]).default("updated_desc"),
});

export type NoteFilter = z.infer<typeof noteFilterSchema>;

export type NotesSummary = {
  totalCount: number;
  pinnedCount: number;
  archivedCount: number;
  tagsCount: number;
};
