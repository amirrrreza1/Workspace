-- Phase 3 migration: Notes, Projects, Environments, and Secrets

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null check (length(btrim(title)) between 1 and 255),
  content text not null default '',
  tags jsonb not null default '[]'::jsonb,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_pinned_order on notes (is_pinned, is_archived, updated_at desc);
create index if not exists notes_archived_idx on notes (is_archived);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null check (length(btrim(name)) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name varchar(60) not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_environments_project_name on project_environments (project_id, name);

create table if not exists project_secrets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  environment_id uuid not null references project_environments(id) on delete cascade,
  key varchar(255) not null check (length(btrim(key)) between 1 and 255),
  encrypted_value text not null,
  iv varchar(64) not null,
  auth_tag varchar(64) not null,
  comment text,
  is_secret boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_secrets_env_key on project_secrets (environment_id, key);
create index if not exists project_secrets_project_env on project_secrets (project_id, environment_id);
