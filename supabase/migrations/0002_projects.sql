-- Phase 2: persistent projects + durable media storage for UnrealAdz
-- Run in the Supabase SQL editor after 0001. Idempotent.

-- ============================================================
-- 1. projects table (replaces the localStorage "ugc_projects")
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled ad',
  type text not null default 'video' check (type in ('image', 'video')),
  status text not null default 'ready' check (status in ('draft', 'rendering', 'ready', 'failed')),
  -- Original provider (KIE) URL: works immediately but expires
  source_url text,
  -- Durable copy in Supabase Storage (path within the 'media' bucket)
  media_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id, created_at desc);

alter table public.projects enable row level security;

-- Owners manage their own project rows. This is metadata, not credits,
-- so client-side writes scoped by auth.uid() are safe.
drop policy if exists "projects select own" on public.projects;
drop policy if exists "projects insert own" on public.projects;
drop policy if exists "projects update own" on public.projects;
drop policy if exists "projects delete own" on public.projects;

create policy "projects select own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects insert own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects update own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects delete own" on public.projects
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh (update_updated_at_column() exists from 0001/db setup)
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- 2. Private 'media' storage bucket for generated assets
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Files are stored at "{user_id}/{...}"; the first path segment is the owner.
drop policy if exists "media read own" on storage.objects;
drop policy if exists "media insert own" on storage.objects;
drop policy if exists "media update own" on storage.objects;
drop policy if exists "media delete own" on storage.objects;

create policy "media read own" on storage.objects
  for select using (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "media insert own" on storage.objects
  for insert with check (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "media update own" on storage.objects
  for update using (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "media delete own" on storage.objects
  for delete using (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );
