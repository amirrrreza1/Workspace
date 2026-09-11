-- Add optional separate Telegram channel/chat ID for backups
alter table settings add column if not exists backup_telegram_chat_id varchar(120);
