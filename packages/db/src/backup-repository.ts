import { randomUUID } from "node:crypto";
import {
  workspaceBackupSchema,
  type BackupRestoreResult,
  type WorkspaceBackup,
} from "@reminder/domain";
import type { Sql } from "postgres";

import { createSql } from "./index.js";

type RawReminderRow = {
  id: string;
  title: string;
  description: string | null;
  type: WorkspaceBackup["data"]["reminders"][number]["type"];
  custom_type_label: string | null;
  state: WorkspaceBackup["data"]["reminders"][number]["state"];
  recurrence_calendar: WorkspaceBackup["data"]["reminders"][number]["recurrenceCalendar"];
  anchor_year: number;
  anchor_month: number;
  anchor_day: number;
  anchor_was_last_day: boolean;
  frequency: WorkspaceBackup["data"]["reminders"][number]["frequency"];
  recurrence_interval: number;
  next_occurrence_date: string | null;
  next_notification_at: Date | null;
  remind_before_days: number;
  amount_minor: bigint | null;
  currency: WorkspaceBackup["data"]["reminders"][number]["currency"] | null;
  email_enabled: boolean;
  telegram_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type RawNoteRow = {
  id: string;
  title: string;
  content: string;
  tags: string[] | string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

type RawProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

type RawEnvironmentRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

type RawSecretRow = {
  id: string;
  project_id: string;
  environment_id: string;
  key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  comment: string | null;
  is_secret: boolean;
  created_at: Date;
  updated_at: Date;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1).toString().padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`;
}

function parseJsonArray<T>(raw: T[] | string | null | undefined): T[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class BackupRepository {
  constructor(private readonly databaseUrl: string) {}

  private async withSql<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const sql = await createSql(this.databaseUrl);
    try {
      return await work(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async exportBackup(): Promise<WorkspaceBackup> {
    return this.withSql(async (sql) => {
      // 1. Settings
      const settingsRows = await sql<
        {
          calendar_system: "gregorian" | "jalali";
          default_currency: "IRR" | "USD";
          email_enabled: boolean;
          telegram_enabled: boolean;
          backup_telegram_chat_id: string | null;
        }[]
      >`select calendar_system, default_currency, email_enabled, telegram_enabled, backup_telegram_chat_id from settings where id = 1`;
      const settingsRow = settingsRows[0];

      // 2. Reminders
      const reminderRows = await sql<RawReminderRow[]>`
        select
          id, title, description, type, custom_type_label, state,
          recurrence_calendar, anchor_year, anchor_month, anchor_day,
          anchor_was_last_day, frequency, recurrence_interval,
          next_occurrence_date, next_notification_at, remind_before_days,
          amount_minor, currency, email_enabled, telegram_enabled,
          created_at, updated_at
        from reminders
        order by next_occurrence_date asc nulls last, id asc
      `;

      // 3. Notes
      const noteRows = await sql<RawNoteRow[]>`
        select id, title, content, tags, is_pinned, is_archived, created_at, updated_at
        from notes
        order by is_pinned desc, updated_at desc, id desc
      `;

      // 4. Projects, Environments, Secrets
      const projectRows = await sql<RawProjectRow[]>`
        select id, name, description, created_at, updated_at
        from projects
        order by name asc
      `;
      const envRows = await sql<RawEnvironmentRow[]>`
        select id, project_id, name, created_at, updated_at
        from project_environments
        order by name asc
      `;
      const secretRows = await sql<RawSecretRow[]>`
        select id, project_id, environment_id, key, encrypted_value, iv, auth_tag, comment, is_secret, created_at, updated_at
        from project_secrets
        order by key asc
      `;

      const secretsByEnv = new Map<string, RawSecretRow[]>();
      for (const secret of secretRows) {
        const list = secretsByEnv.get(secret.environment_id) ?? [];
        list.push(secret);
        secretsByEnv.set(secret.environment_id, list);
      }

      const envsByProject = new Map<string, RawEnvironmentRow[]>();
      for (const env of envRows) {
        const list = envsByProject.get(env.project_id) ?? [];
        list.push(env);
        envsByProject.set(env.project_id, list);
      }

      // 5. Expenses, Categories, Regular Items
      const categoryRows = await sql<
        {
          id: string;
          name: string;
          color: string;
          icon: string;
          is_default: boolean;
          created_at: Date;
          updated_at: Date;
        }[]
      >`select id, name, color, icon, is_default, created_at, updated_at from expense_categories order by created_at asc`;

      const regularItemRows = await sql<
        {
          id: string;
          title: string;
          category_id: string | null;
          amount_minor: bigint;
          currency: "IRR" | "USD";
          icon: string | null;
          created_at: Date;
          updated_at: Date;
        }[]
      >`select id, title, category_id, amount_minor, currency, icon, created_at, updated_at from regular_expense_items order by created_at asc`;

      const expenseRows = await sql<
        {
          id: string;
          title: string;
          category_id: string | null;
          amount_minor: bigint;
          currency: "IRR" | "USD";
          spent_at: Date;
          note: string | null;
          created_at: Date;
          updated_at: Date;
        }[]
      >`select id, title, category_id, amount_minor, currency, spent_at, note, created_at, updated_at from expenses order by spent_at asc`;

      const backup: WorkspaceBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appName: "Workspace",
        data: {
          settings: settingsRow
            ? {
                calendarSystem: settingsRow.calendar_system,
                defaultCurrency: settingsRow.default_currency,
                emailEnabled: settingsRow.email_enabled,
                telegramEnabled: settingsRow.telegram_enabled,
                backupTelegramChatId: settingsRow.backup_telegram_chat_id,
              }
            : undefined,
          reminders: reminderRows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            type: r.type,
            customTypeLabel: r.custom_type_label,
            state: r.state,
            recurrenceCalendar: r.recurrence_calendar,
            anchorYear: r.anchor_year,
            anchorMonth: r.anchor_month,
            anchorDay: r.anchor_day,
            anchorWasLastDay: r.anchor_was_last_day,
            frequency: r.frequency,
            recurrenceInterval: r.recurrence_interval,
            nextOccurrenceDate: dateOnly(r.next_occurrence_date),
            nextNotificationAt: r.next_notification_at ? iso(r.next_notification_at) : null,
            remindBeforeDays: r.remind_before_days,
            amountMinor: r.amount_minor !== null ? r.amount_minor.toString() : null,
            currency: r.currency,
            emailEnabled: r.email_enabled,
            telegramEnabled: r.telegram_enabled,
            createdAt: iso(r.created_at),
            updatedAt: iso(r.updated_at),
          })),
          notes: noteRows.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: parseJsonArray<string>(n.tags),
            isPinned: n.is_pinned,
            isArchived: n.is_archived,
            createdAt: iso(n.created_at),
            updatedAt: iso(n.updated_at),
          })),
          projects: projectRows.map((p) => {
            const envs = envsByProject.get(p.id) ?? [];
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              createdAt: iso(p.created_at),
              updatedAt: iso(p.updated_at),
              environments: envs.map((e) => {
                const secrets = secretsByEnv.get(e.id) ?? [];
                return {
                  id: e.id,
                  name: e.name,
                  createdAt: iso(e.created_at),
                  updatedAt: iso(e.updated_at),
                  secrets: secrets.map((s) => ({
                    id: s.id,
                    key: s.key,
                    encryptedValue: s.encrypted_value,
                    iv: s.iv,
                    authTag: s.auth_tag,
                    comment: s.comment,
                    isSecret: s.is_secret,
                    createdAt: iso(s.created_at),
                    updatedAt: iso(s.updated_at),
                  })),
                };
              }),
            };
          }),
          expenseCategories: categoryRows.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            isDefault: c.is_default,
            createdAt: iso(c.created_at),
            updatedAt: iso(c.updated_at),
          })),
          regularExpenseItems: regularItemRows.map((r) => ({
            id: r.id,
            title: r.title,
            categoryId: r.category_id,
            amountMinor: r.amount_minor.toString(),
            currency: r.currency,
            icon: r.icon,
            createdAt: iso(r.created_at),
            updatedAt: iso(r.updated_at),
          })),
          expenses: expenseRows.map((e) => ({
            id: e.id,
            title: e.title,
            categoryId: e.category_id,
            amountMinor: e.amount_minor.toString(),
            currency: e.currency,
            spentAt: iso(e.spent_at),
            note: e.note,
            createdAt: iso(e.created_at),
            updatedAt: iso(e.updated_at),
          })),
        },
      };

      return workspaceBackupSchema.parse(backup);
    });
  }

  async restoreBackup(payload: WorkspaceBackup): Promise<BackupRestoreResult> {
    const backup = workspaceBackupSchema.parse(payload);

    return this.withSql(async (sql) => {
      return await sql.begin(async (tx) => {
        // 1. Wipe existing entities in safe order (respecting foreign keys)
        await tx`delete from expenses`;
        await tx`delete from regular_expense_items`;
        await tx`delete from expense_categories`;
        await tx`delete from project_secrets`;
        await tx`delete from project_environments`;
        await tx`delete from projects`;
        await tx`delete from notes`;
        await tx`delete from notification_deliveries`;
        await tx`delete from reminders`;

        let remindersCount = 0;
        let notesCount = 0;
        let projectsCount = 0;
        let environmentsCount = 0;
        let secretsCount = 0;
        let expenseCategoriesCount = 0;
        let regularExpenseItemsCount = 0;
        let expensesCount = 0;

        // 2. Restore Projects, Environments, Secrets
        for (const project of backup.data.projects) {
          const projectId = project.id ?? randomUUID();
          const pCreated = project.createdAt ? new Date(project.createdAt) : new Date();
          const pUpdated = project.updatedAt ? new Date(project.updatedAt) : new Date();

          await tx`
            insert into projects (id, name, description, created_at, updated_at)
            values (${projectId}, ${project.name}, ${project.description ?? null}, ${pCreated}, ${pUpdated})
          `;
          projectsCount++;

          for (const env of project.environments) {
            const envId = env.id ?? randomUUID();
            const eCreated = env.createdAt ? new Date(env.createdAt) : new Date();
            const eUpdated = env.updatedAt ? new Date(env.updatedAt) : new Date();

            await tx`
              insert into project_environments (id, project_id, name, created_at, updated_at)
              values (${envId}, ${projectId}, ${env.name}, ${eCreated}, ${eUpdated})
            `;
            environmentsCount++;

            for (const secret of env.secrets) {
              const secretId = secret.id ?? randomUUID();
              const sCreated = secret.createdAt ? new Date(secret.createdAt) : new Date();
              const sUpdated = secret.updatedAt ? new Date(secret.updatedAt) : new Date();

              await tx`
                insert into project_secrets (
                  id, project_id, environment_id, key, encrypted_value, iv, auth_tag,
                  comment, is_secret, created_at, updated_at
                ) values (
                  ${secretId}, ${projectId}, ${envId}, ${secret.key}, ${secret.encryptedValue},
                  ${secret.iv}, ${secret.authTag}, ${secret.comment ?? null}, ${secret.isSecret},
                  ${sCreated}, ${sUpdated}
                )
              `;
              secretsCount++;
            }
          }
        }

        // 3. Restore Notes
        for (const note of backup.data.notes) {
          const noteId = note.id ?? randomUUID();
          const nCreated = note.createdAt ? new Date(note.createdAt) : new Date();
          const nUpdated = note.updatedAt ? new Date(note.updatedAt) : new Date();

          await tx`
            insert into notes (
              id, title, content, tags, is_pinned, is_archived, created_at, updated_at
            ) values (
              ${noteId}, ${note.title}, ${note.content}, ${tx.json(note.tags)},
              ${note.isPinned}, ${note.isArchived},
              ${nCreated}, ${nUpdated}
            )
          `;
          notesCount++;
        }

        // 4. Restore Reminders
        for (const r of backup.data.reminders) {
          const reminderId = r.id ?? randomUUID();
          const rCreated = r.createdAt ? new Date(r.createdAt) : new Date();
          const rUpdated = r.updatedAt ? new Date(r.updatedAt) : new Date();
          const nextNotification = r.nextNotificationAt ? new Date(r.nextNotificationAt) : null;
          const amountMinor =
            r.amountMinor !== null && r.amountMinor !== undefined ? String(r.amountMinor) : null;

          await tx`
            insert into reminders (
              id, title, description, type, custom_type_label, state,
              recurrence_calendar, anchor_year, anchor_month, anchor_day,
              anchor_was_last_day, frequency, recurrence_interval,
              next_occurrence_date, next_notification_at, remind_before_days,
              amount_minor, currency, email_enabled, telegram_enabled,
              created_at, updated_at
            ) values (
              ${reminderId}, ${r.title}, ${r.description ?? null}, ${r.type},
              ${r.customTypeLabel ?? null}, ${r.state}, ${r.recurrenceCalendar},
              ${r.anchorYear}, ${r.anchorMonth}, ${r.anchorDay},
              ${r.anchorWasLastDay}, ${r.frequency}, ${r.recurrenceInterval},
              ${r.nextOccurrenceDate ?? null}, ${nextNotification}, ${r.remindBeforeDays},
              ${amountMinor}, ${r.currency ?? null}, ${r.emailEnabled}, ${r.telegramEnabled},
              ${rCreated}, ${rUpdated}
            )
          `;
          remindersCount++;
        }

        // 5. Restore Expense Categories
        if (backup.data.expenseCategories) {
          for (const cat of backup.data.expenseCategories) {
            const catId = cat.id ?? randomUUID();
            const cCreated = cat.createdAt ? new Date(cat.createdAt) : new Date();
            const cUpdated = cat.updatedAt ? new Date(cat.updatedAt) : new Date();

            await tx`
              insert into expense_categories (id, name, color, icon, is_default, created_at, updated_at)
              values (${catId}, ${cat.name}, ${cat.color}, ${cat.icon}, ${cat.isDefault}, ${cCreated}, ${cUpdated})
            `;
            expenseCategoriesCount++;
          }
        }

        // 6. Restore Regular Expense Items
        if (backup.data.regularExpenseItems) {
          for (const item of backup.data.regularExpenseItems) {
            const itemId = item.id ?? randomUUID();
            const iCreated = item.createdAt ? new Date(item.createdAt) : new Date();
            const iUpdated = item.updatedAt ? new Date(item.updatedAt) : new Date();

            await tx`
              insert into regular_expense_items (id, title, category_id, amount_minor, currency, icon, created_at, updated_at)
              values (
                ${itemId}, ${item.title}, ${item.categoryId ?? null},
                ${String(item.amountMinor)}, ${item.currency},
                ${item.icon ?? null}, ${iCreated}, ${iUpdated}
              )
            `;
            regularExpenseItemsCount++;
          }
        }

        // 7. Restore Expenses
        if (backup.data.expenses) {
          for (const exp of backup.data.expenses) {
            const expId = exp.id ?? randomUUID();
            const spentAt = new Date(exp.spentAt);
            const eCreated = exp.createdAt ? new Date(exp.createdAt) : new Date();
            const eUpdated = exp.updatedAt ? new Date(exp.updatedAt) : new Date();

            await tx`
              insert into expenses (id, title, category_id, amount_minor, currency, spent_at, note, created_at, updated_at)
              values (
                ${expId}, ${exp.title}, ${exp.categoryId ?? null},
                ${String(exp.amountMinor)}, ${exp.currency},
                ${spentAt}, ${exp.note ?? null}, ${eCreated}, ${eUpdated}
              )
            `;
            expensesCount++;
          }
        }

        // 8. Restore Settings if present
        if (backup.data.settings) {
          const s = backup.data.settings;
          await tx`
            update settings
            set
              calendar_system = ${s.calendarSystem},
              default_currency = ${s.defaultCurrency},
              email_enabled = ${s.emailEnabled},
              telegram_enabled = ${s.telegramEnabled},
              backup_telegram_chat_id = ${s.backupTelegramChatId ?? null},
              updated_at = now()
            where id = 1
          `;
        }

        return {
          success: true,
          restored: {
            remindersCount,
            notesCount,
            projectsCount,
            environmentsCount,
            secretsCount,
            expenseCategoriesCount,
            regularExpenseItemsCount,
            expensesCount,
          },
        };
      });
    });
  }
}
