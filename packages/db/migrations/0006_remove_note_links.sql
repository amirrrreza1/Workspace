-- Migration: Remove links column from notes
alter table notes drop column if exists links;
