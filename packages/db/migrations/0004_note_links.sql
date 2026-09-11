-- Phase 4 migration: Add links to notes
alter table notes add column if not exists links jsonb not null default '[]'::jsonb;
