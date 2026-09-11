import { z } from "zod";

import {
  calendarSystems,
  currencies,
  recurrenceFrequencies,
  reminderStates,
  reminderTypes,
} from "./reminder.js";

export const backupSettingsSchema = z
  .object({
    calendarSystem: z.enum(calendarSystems),
    defaultCurrency: z.enum(currencies),
    emailEnabled: z.boolean(),
    telegramEnabled: z.boolean(),
    backupTelegramChatId: z.string().max(120).nullable().optional(),
  })
  .strict();

export const backupReminderSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(120),
    description: z.string().max(2000).nullable().optional(),
    type: z.enum(reminderTypes),
    customTypeLabel: z.string().max(40).nullable().optional(),
    state: z.enum(reminderStates),
    recurrenceCalendar: z.enum(calendarSystems),
    anchorYear: z.number().int(),
    anchorMonth: z.number().int(),
    anchorDay: z.number().int(),
    anchorWasLastDay: z.boolean().default(false),
    frequency: z.enum(recurrenceFrequencies),
    recurrenceInterval: z.number().int().min(1).max(99),
    nextOccurrenceDate: z.string().nullable().optional(),
    nextNotificationAt: z.string().nullable().optional(),
    remindBeforeDays: z.number().int().min(0).max(365),
    amountMinor: z.union([z.string(), z.number(), z.bigint()]).nullable().optional(),
    currency: z.enum(currencies).nullable().optional(),
    emailEnabled: z.boolean().default(false),
    telegramEnabled: z.boolean().default(false),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const backupNoteSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(255),
    content: z.string().default(""),
    tags: z.array(z.string()).default([]),
    isPinned: z.boolean().default(false),
    isArchived: z.boolean().default(false),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const backupSecretSchema = z
  .object({
    id: z.string().uuid().optional(),
    key: z.string().min(1).max(255),
    encryptedValue: z.string(),
    iv: z.string(),
    authTag: z.string(),
    comment: z.string().nullable().optional(),
    isSecret: z.boolean().default(true),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const backupEnvironmentSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(60),
    secrets: z.array(backupSecretSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const backupProjectSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    description: z.string().nullable().optional(),
    environments: z.array(backupEnvironmentSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const workspaceBackupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string(),
    appName: z.string().default("Workspace"),
    data: z
      .object({
        settings: backupSettingsSchema.optional(),
        reminders: z.array(backupReminderSchema).default([]),
        notes: z.array(backupNoteSchema).default([]),
        projects: z.array(backupProjectSchema).default([]),
      })
      .strict(),
  })
  .strict();

export type WorkspaceBackup = z.infer<typeof workspaceBackupSchema>;

export type BackupSummary = {
  remindersCount: number;
  notesCount: number;
  projectsCount: number;
  environmentsCount: number;
  secretsCount: number;
};

export type BackupRestoreResult = {
  success: boolean;
  restored: BackupSummary;
};
