-- Phase 1: persist each clinic's selected application language without
-- changing or removing any existing tenant data.
alter table public.clinic_settings
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ar'));

-- clinic_settings already has tenant-scoped RLS policies and explicit Data API
-- privileges in the initial schema; the additive column inherits that security.
