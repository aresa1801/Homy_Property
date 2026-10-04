-- ==========================================================================
-- Homy AI Workforce — Fase 2
-- Target harian/mingguan/bulanan + riwayat chat COO + aktivasi karyawan fase 2.
-- Ditulis 2026-10-06. Idempoten (boleh dijalankan ulang).
-- ==========================================================================

-- 1) Target & KPI yang ditetapkan Boss bersama COO
create table if not exists ai_targets (
  id uuid primary key default gen_random_uuid(),
  period text not null default 'weekly',      -- daily | weekly | monthly
  title text not null,
  metric text,                                 -- nama metrik yang diukur
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  unit text,
  owner_slug text,                             -- karyawan penanggung jawab
  status text not null default 'active',       -- active | achieved | missed | archived
  source text not null default 'boss',         -- boss | coo
  notes text,
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_targets_status_idx on ai_targets (status, period, created_at desc);

-- 2) Riwayat percakapan dengan COO
create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null,                          -- user | assistant
  content text not null,
  actor_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_created_idx on ai_chat_messages (created_at desc);

alter table ai_targets enable row level security;
alter table ai_chat_messages enable row level security;

-- 3) Aktifkan karyawan Fase 2 (Growth, Content, Listing) bila masih "planned"
update ai_employees
   set status = 'active', updated_at = now()
 where slug in ('growth', 'content', 'listing') and status = 'planned';
