import {
  formatGregorianDate,
  notificationTime,
  parseSendTime,
  todayInTimezone,
} from "@reminder/domain";
import type { Sql } from "postgres";

import { createSql } from "./index.js";

export type NightlyBackupRuntimeConfig = {
  timeZone: string;
  sendTime: string;
};

export type NightlyBackupSchedule = {
  backupDate: string;
  scheduledFor: Date;
};

export type ClaimedNightlyBackup = NightlyBackupSchedule & {
  attemptCount: number;
};

type ClaimRow = {
  backup_date: Date | string;
  scheduled_for: Date;
  attempt_count: number;
};

const LEASE_SECONDS = 90;

function dateOnly(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

export function dueNightlyBackup(
  now: Date,
  runtime: NightlyBackupRuntimeConfig,
): NightlyBackupSchedule | null {
  const today = todayInTimezone(now, runtime.timeZone);
  const scheduledFor = notificationTime(
    today,
    0,
    parseSendTime(runtime.sendTime),
    runtime.timeZone,
  );
  if (scheduledFor.getTime() > now.getTime()) return null;
  return { backupDate: formatGregorianDate(today), scheduledFor };
}

/** Durable queue for one backup per local calendar day. */
export class NightlyBackupRepository {
  constructor(
    private readonly databaseUrl: string,
    private readonly runtime: NightlyBackupRuntimeConfig,
  ) {}

  private async withSql<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const sql = await createSql(this.databaseUrl);
    try {
      return await work(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async schedule(now = new Date()): Promise<boolean> {
    const due = dueNightlyBackup(now, this.runtime);
    if (!due) return false;
    return this.withSql(async (sql) => {
      const rows = await sql<{ backup_date: Date | string }[]>`
        insert into nightly_backup_deliveries (
          backup_date, scheduled_for, status, next_attempt_at
        ) values (${due.backupDate}, ${due.scheduledFor}, 'pending', ${now})
        on conflict (backup_date) do nothing
        returning backup_date
      `;
      return rows.length > 0;
    });
  }

  async claim(workerId: string, now = new Date()): Promise<ClaimedNightlyBackup | null> {
    return this.withSql(async (sql) =>
      sql.begin(async (tx) => {
        await tx`
          update nightly_backup_deliveries
          set status = 'retry', next_attempt_at = ${now}, lease_owner = null,
              lease_expires_at = null, last_error_code = 'LEASE_EXPIRED',
              last_error_detail = 'A previous worker lease expired before Telegram confirmed delivery.'
          where status = 'processing' and lease_expires_at <= ${now}
        `;
        const rows = await tx<ClaimRow[]>`
          with candidate as (
            select backup_date
            from nightly_backup_deliveries
            where status in ('pending', 'retry') and next_attempt_at <= ${now}
            order by next_attempt_at, backup_date
            for update skip locked
            limit 1
          )
          update nightly_backup_deliveries as delivery
          set status = 'processing', attempt_count = delivery.attempt_count + 1,
              next_attempt_at = null, lease_owner = ${workerId},
              lease_expires_at = ${new Date(now.getTime() + LEASE_SECONDS * 1000)}
          from candidate
          where delivery.backup_date = candidate.backup_date
          returning delivery.backup_date, delivery.scheduled_for, delivery.attempt_count
        `;
        const row = rows[0];
        return row
          ? {
              backupDate: dateOnly(row.backup_date),
              scheduledFor: row.scheduled_for,
              attemptCount: row.attempt_count,
            }
          : null;
      }),
    );
  }

  async markSent(
    backupDate: string,
    workerId: string,
    receipt: { providerMessageId?: string; acceptedAt: string },
  ): Promise<void> {
    await this.withSql(async (sql) => {
      await sql`
        update nightly_backup_deliveries
        set status = 'sent', sent_at = ${new Date(receipt.acceptedAt)},
            provider_message_id = ${receipt.providerMessageId ?? null}, next_attempt_at = null,
            lease_owner = null, lease_expires_at = null,
            last_error_code = null, last_error_detail = null
        where backup_date = ${backupDate} and status = 'processing' and lease_owner = ${workerId}
      `;
    });
  }

  async markFailure(input: {
    backupDate: string;
    workerId: string;
    retry: boolean;
    nextAttemptAt?: Date;
    code: string;
    detail: string;
  }): Promise<void> {
    await this.withSql(async (sql) => {
      await sql`
        update nightly_backup_deliveries
        set status = ${input.retry ? "retry" : "failed"},
            next_attempt_at = ${input.retry ? (input.nextAttemptAt ?? new Date()) : null},
            lease_owner = null, lease_expires_at = null,
            last_error_code = ${input.code}, last_error_detail = ${input.detail.slice(0, 500)}
        where backup_date = ${input.backupDate}
          and status = 'processing' and lease_owner = ${input.workerId}
      `;
    });
  }
}
