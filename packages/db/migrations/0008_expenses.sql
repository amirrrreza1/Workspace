-- Phase 8 migration: Financial expenses, categories, and regular items

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null check (length(btrim(name)) between 1 and 80),
  color varchar(30) not null default '#6366f1',
  icon varchar(40) not null default 'tag',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed user's primary categories
insert into expense_categories (name, color, icon, is_default)
values
  ('Snacks and food', '#10b981', 'utensils', true),
  ('Subscriptions', '#3b82f6', 'repeat', true),
  ('Internet and bills', '#f59e0b', 'receipt', true),
  ('Fun', '#8b5cf6', 'sparkles', true),
  ('Health', '#ec4899', 'heart-pulse', true),
  ('Others', '#64748b', 'more-horizontal', true)
on conflict do nothing;

create table if not exists regular_expense_items (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null check (length(btrim(title)) between 1 and 120),
  category_id uuid references expense_categories(id) on delete set null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency currency not null default 'IRR',
  icon varchar(40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists regular_expense_items_category_idx on regular_expense_items (category_id);

-- Starter regular items in IRR
insert into regular_expense_items (title, category_id, amount_minor, currency, icon)
select 'Water', id, 150000, 'IRR', 'droplet'
from expense_categories where name = 'Snacks and food' limit 1;

insert into regular_expense_items (title, category_id, amount_minor, currency, icon)
select 'Gasoline', id, 600000, 'IRR', 'fuel'
from expense_categories where name = 'Others' limit 1;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title varchar(150) not null check (length(btrim(title)) between 1 and 150),
  category_id uuid references expense_categories(id) on delete set null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency currency not null default 'IRR',
  spent_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_spent_at_idx on expenses (spent_at desc);
create index if not exists expenses_category_idx on expenses (category_id);
