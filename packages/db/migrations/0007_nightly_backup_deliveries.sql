-- Durable, once-per-local-day delivery ledger for automated Telegram backups.

create table if not exists nightly_backup_deliveries (
  backup_date date primary key,
  scheduled_for timestamptz not null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  lease_owner varchar(100),
  lease_expires_at timestamptz,
  provider_message_id varchar(255),
  last_error_code varchar(80),
  last_error_detail varchar(500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nightly_backup_delivery_claim_state_check check (
    (status in ('pending', 'retry') and next_attempt_at is not null and lease_owner is null and lease_expires_at is null)
    or (status = 'processing' and lease_owner is not null and lease_expires_at is not null)
    or (status in ('sent', 'failed') and next_attempt_at is null and lease_owner is null and lease_expires_at is null)
  )
);

create index if not exists nightly_backup_deliveries_claim
  on nightly_backup_deliveries (next_attempt_at, backup_date)
  where status in ('pending', 'retry');

create index if not exists nightly_backup_deliveries_lease_recovery
  on nightly_backup_deliveries (lease_expires_at, backup_date)
  where status = 'processing';

drop trigger if exists nightly_backup_deliveries_set_updated_at on nightly_backup_deliveries;
create trigger nightly_backup_deliveries_set_updated_at
  before update on nightly_backup_deliveries
  for each row execute function set_updated_at();
