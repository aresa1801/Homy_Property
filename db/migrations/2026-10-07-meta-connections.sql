-- Homy Property — Koneksi Meta (Instagram Graph API + Threads API)
-- Auto-publish tetap approve-first: token disimpan server-side (service-role only),
-- client tidak pernah menerima token.

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  channel text not null unique check (channel in ('instagram', 'threads')),
  account_id text,
  username text,
  page_id text,
  page_name text,
  access_token text not null,
  token_expires_at timestamptz,
  scopes text,
  status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  last_error text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_connections enable row level security;

create index if not exists meta_connections_channel_idx on public.meta_connections (channel);
