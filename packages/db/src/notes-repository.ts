import type {
  CreateNoteInput,
  Note,
  NoteFilter,
  NotesSummary,
  UpdateNoteInput,
} from "@reminder/domain";
import type { Sql } from "postgres";

import { NotFoundError, StaleWriteError } from "./errors.js";
import { createSql } from "./index.js";

type NoteRow = {
  id: string;
  title: string;
  content: string;
  tags: string[] | string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

function parseTags(tags: string[] | string): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parseTags(row.tags),
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class NotesRepository {
  constructor(private readonly databaseUrl: string) {}

  private async withSql<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const sql = await createSql(this.databaseUrl);
    try {
      return await work(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async list(filter: NoteFilter = { sort: "updated_desc" }): Promise<Note[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<NoteRow[]>`
        select id, title, content, tags, is_pinned, is_archived, created_at, updated_at
        from notes
        where (
          ${filter.isArchived === undefined ? sql`true` : sql`is_archived = ${filter.isArchived}`}
        )
        and (
          ${filter.isPinned === undefined ? sql`true` : sql`is_pinned = ${filter.isPinned}`}
        )
        order by
          is_pinned desc,
          ${filter.sort === "updated_asc" ? sql`updated_at asc` : filter.sort === "title_asc" ? sql`title asc` : sql`updated_at desc`},
          id desc
      `;

      let notes = rows.map(rowToNote);

      if (filter.q) {
        const query = filter.q.toLowerCase();
        notes = notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query) ||
            note.tags.some((t) => t.toLowerCase().includes(query)),
        );
      }

      if (filter.tag) {
        const targetTag = filter.tag.toLowerCase();
        notes = notes.filter((note) => note.tags.some((t) => t.toLowerCase() === targetTag));
      }

      return notes;
    });
  }

  async getById(id: string): Promise<Note | null> {
    return this.withSql(async (sql) => {
      const rows = await sql<NoteRow[]>`
        select id, title, content, tags, is_pinned, is_archived, created_at, updated_at
        from notes
        where id = ${id}
        limit 1
      `;
      const row = rows[0];
      return row ? rowToNote(row) : null;
    });
  }

  async create(data: CreateNoteInput): Promise<Note> {
    return this.withSql(async (sql) => {
      const rows = await sql<NoteRow[]>`
        insert into notes (title, content, tags, is_pinned, is_archived)
        values (
          ${data.title},
          ${data.content},
          ${sql.json(data.tags)},
          ${data.isPinned},
          false
        )
        returning id, title, content, tags, is_pinned, is_archived, created_at, updated_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Could not insert note.");
      return rowToNote(row);
    });
  }

  async update(id: string, data: UpdateNoteInput): Promise<Note> {
    return this.withSql(async (sql) => {
      const existingRows = await sql<NoteRow[]>`
        select id, title, content, tags, is_pinned, is_archived, created_at, updated_at
        from notes
        where id = ${id}
        limit 1
      `;
      const existing = existingRows[0];
      if (!existing) throw new NotFoundError("Note not found.");

      if (data.expectedUpdatedAt && existing.updated_at.toISOString() !== data.expectedUpdatedAt) {
        throw new StaleWriteError(rowToNote(existing), "Note was modified by another request.");
      }

      const rows = await sql<NoteRow[]>`
        update notes
        set
          title = ${data.title !== undefined ? data.title : existing.title},
          content = ${data.content !== undefined ? data.content : existing.content},
          tags = ${data.tags !== undefined ? sql.json(data.tags) : sql.json(parseTags(existing.tags))},
          is_pinned = ${data.isPinned !== undefined ? data.isPinned : existing.is_pinned},
          is_archived = ${data.isArchived !== undefined ? data.isArchived : existing.is_archived},
          updated_at = now()
        where id = ${id}
        returning id, title, content, tags, is_pinned, is_archived, created_at, updated_at
      `;
      const updated = rows[0];
      if (!updated) throw new NotFoundError("Note not found.");
      return rowToNote(updated);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.withSql(async (sql) => {
      const result = await sql`
        delete from notes
        where id = ${id}
      `;
      return result.count > 0;
    });
  }

  async listTags(): Promise<string[]> {
    return this.withSql(async (sql) => {
      const rows = await sql<{ tags: string[] | string }[]>`
        select tags from notes where is_archived = false
      `;
      const tagSet = new Set<string>();
      for (const row of rows) {
        for (const tag of parseTags(row.tags)) {
          tagSet.add(tag);
        }
      }
      return Array.from(tagSet).sort();
    });
  }

  async getSummary(): Promise<NotesSummary> {
    return this.withSql(async (sql) => {
      const rows = await sql<
        {
          total_count: string;
          pinned_count: string;
          archived_count: string;
        }[]
      >`
        select
          count(*) filter (where is_archived = false) as total_count,
          count(*) filter (where is_pinned = true and is_archived = false) as pinned_count,
          count(*) filter (where is_archived = true) as archived_count
        from notes
      `;

      const tags = await this.listTags();

      const summary = rows[0] ?? { total_count: "0", pinned_count: "0", archived_count: "0" };
      return {
        totalCount: Number(summary.total_count),
        pinnedCount: Number(summary.pinned_count),
        archivedCount: Number(summary.archived_count),
        tagsCount: tags.length,
      };
    });
  }
}
